import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from 'src/redis/redis.service';
import { SignatureService } from 'src/signature/signature.service';

@WebSocketGateway(Number(process.env.WS_PORT) || 8081, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket'],
  namespace: '/',
})
export class P2PGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(P2PGateway.name);

  constructor(
    private readonly redis: RedisService,
    private readonly signature: SignatureService,
  ) { }

  async handleConnection(client: Socket) {
    const clientIP = client.handshake.address;
    const token = String(client.handshake.query.token || '');
    const role = String(client.handshake.query.role || 'normal');

    this.logger.log(`Intentando conectar nodo: ${client.id} - IP: ${clientIP} - Rol: ${role}`);

    const { clientId, isValid } = await this.redis.authenticatePeer(clientIP, token);

    if (!isValid) {
      this.logger.warn(`Conexión rechazada para ${clientIP}: Token inválido`);
      client.disconnect();
      return;
    }

    try {
      const currentTime = Date.now();

      // Firmar los datos del nodo
      const nodeData = JSON.stringify({ role, lastHeartbeat: currentTime });
      const signature = this.signature.signMessage(nodeData);

      // Store peer info in Redis hash
      await this.redis.hSet(
        'peers',
        clientIP,
        JSON.stringify({
          clientId,
          role,
          lastHeartbeat: currentTime,
          signature,
        }),
      );

      // Get all peers
      const peersData = await this.redis.hGetAll('peers');

      // Convert hash to object format for consistency
      const peers = Object.entries(peersData).reduce((acc, [ip, data]) => {
        acc[ip] = JSON.parse(data).role;
        return acc;
      }, {});

      // Notify the new client about existing peers
      client.emit('peerDiscovery', { peers });

      // Notify existing clients about the new peer
      client.broadcast.emit('peerDiscovery', { newPeer: { ip: clientIP, role } });

      this.logger.log(`Nodo conectado: ${clientIP} con rol: ${role}`);
    } catch (error) {
      this.logger.error(`Error al registrar nodo en Redis: ${error.message}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const clientIP = client.handshake.address;
    this.logger.log(`Nodo desconectado: ${clientIP}`);

    try {
      // Remove peer from Redis hash
      await this.redis.hDel('peers', clientIP);

      // Notify all clients about disconnected peer
      this.server.emit('peerDiscovery', { disconnectedPeer: clientIP });

      this.logger.log(`✅ Nodo eliminado: ${clientIP}`);
    } catch (error) {
      this.logger.error(`Error al eliminar nodo en Redis: ${error.message}`);
    }
  }

  async getPeers(): Promise<Record<string, string>> {
    try {
      // Get all peers from Redis hash
      return await this.redis.hGetAll('peers');
    } catch (error) {
      this.logger.error(`Error al obtener peers: ${error.message}`);
      return {};
    }
  }

  async handleHeartbeat(client: Socket) {
    const clientIP = client.handshake.address;

    try {
      const peerData = await this.redis.hGet('peers', clientIP);
      if (!peerData) return;

      const peerInfo = JSON.parse(peerData);
      peerInfo.lastHeartbeat = Date.now();

      await this.redis.hSet('peers', clientIP, JSON.stringify(peerInfo));

      this.logger.log(`Heartbeat recibido de ${clientIP}`);
    } catch (error) {
      this.logger.error(`Error al procesar heartbeat de ${clientIP}: ${error.message}`);
    }
  }
}