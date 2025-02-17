import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { PeerInfo } from './dto/create-discovery.dto';
import { WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io'

@Injectable()
export class DiscoveryService {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(DiscoveryService.name);
  private readonly PEER_CLEANUP_INTERVAL = 300000; // 5 minutos
  private readonly MAX_PEERS_SHARE = 10;

  private readonly MIN_SCORE = -100;
  private readonly MAX_SCORE = 100;

  constructor(private readonly redis: RedisService) { }

  async getPeers() {
    return { peers: await this.redis.hGetAll('peers') };
  }

  @Interval(60000)
  async sharePeerList() {
    try {
      const peers = await this.getActivePeers();
      if (Object.keys(peers).length === 0) return;

      // Seleccionar subset aleatorio de peers para compartir
      const peerList = this.getRandomPeers(peers, this.MAX_PEERS_SHARE);

      // Emitir lista a todos los nodos conectados
      this.server.emit('peerDiscovery', {
        type: 'PEER_LIST',
        peers: peerList,
        timestamp: Date.now()
      });

      this.logger.log(`Compartida lista de ${Object.keys(peerList).length} peers`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error compartiendo lista de peers: ${error.message}`);
      }
    }
  }

  @Interval(300000)
  async cleanupInactivePeers() {
    try {
      const peers = await this.redis.hGetAll('peers');
      const now = Date.now();

      for (const [ip, peerData] of Object.entries(peers)) {
        const peer = JSON.parse(peerData);
        if (now - peer.lastSeen > this.PEER_CLEANUP_INTERVAL) {
          await this.redis.hDel('peers', ip);
          this.logger.log(`Eliminado peer inactivo: ${ip}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error en limpieza de peers: ${error.message}`);
    }
  }

  // Obtener peers activos
  private async getActivePeers(): Promise<Record<string, PeerInfo>> {
    const peers = await this.redis.hGetAll('peers');
    const activePeers: Record<string, PeerInfo> = {};

    for (const [ip, data] of Object.entries(peers)) {
      const peer = JSON.parse(data);
      if (Date.now() - peer.lastSeen < this.PEER_CLEANUP_INTERVAL) {
        activePeers[ip] = peer;
      }
    }

    return activePeers;
  }

  // Seleccionar peers aleatorios
  private getRandomPeers(peers: Record<string, PeerInfo>, count: number): Record<string, PeerInfo> {
    const peerList = Object.entries(peers);
    const selectedPeers: Record<string, PeerInfo> = {};

    while (Object.keys(selectedPeers).length < count && peerList.length > 0) {
      const index = Math.floor(Math.random() * peerList.length);
      const [ip, peer] = peerList.splice(index, 1)[0];
      selectedPeers[ip] = peer;
    }

    return selectedPeers;
  }

  // Registrar nuevo peer
  async registerPeer(ip: string, info: Partial<PeerInfo>): Promise<void> {
    const peerInfo: PeerInfo = {
      ip,
      role: info.role || 'normal',
      lastSeen: Date.now(),
      region: info.region,
      version: info.version
    };

    await this.redis.hSet('peers', ip, JSON.stringify(peerInfo));
    this.logger.log(`Registrado nuevo peer: ${ip}`);
  }

  // Reputation peer methods
  async updatePeerScore(ip: string, behavior: 'good' | 'bad'): Promise<void> {
    const peerDataRaw = await this.redis.hGet('peers', ip);
    if (!peerDataRaw) return;

    const peer = JSON.parse(peerDataRaw);
    peer.reputation = peer.reputation || { score: 0, lastUpdate: Date.now(), violations: 0, uptime: 0 };

    peer.reputation.score += behavior === 'good' ? 1 : -5;
    peer.reputation.score = Math.max(this.MIN_SCORE, Math.min(this.MAX_SCORE, peer.reputation.score));
    peer.reputation.lastUpdate = Date.now();

    if (behavior === 'bad') peer.reputation.violations += 1;

    await this.redis.hSet('peers', ip, JSON.stringify(peer));
  }
}
