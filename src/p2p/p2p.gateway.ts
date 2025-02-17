import { Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from 'src/redis/redis.service';
import { SignatureService } from 'src/signature/signature.service';
import { HealthService } from 'src/health/health.service';

@WebSocketGateway(Number(process.env.WS_PORT) || 8081, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket'],
  namespace: '/',
})
export class P2PGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(P2PGateway.name);

  private lastFailoverTime = 0;
  private readonly FAIL_OVER_COOLDOWN = 300000; // 5 minutos

  constructor(
    private readonly redis: RedisService,
    private readonly signature: SignatureService,
    private readonly healthService: HealthService,
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

      // Guardar la información del nodo en Redis
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

      // Obtener todos los peers
      const peersData = await this.redis.hGetAll('peers');

      // Convertir el hash a un objeto para mantener consistencia
      const peers = Object.entries(peersData).reduce((acc, [ip, data]) => {
        acc[ip] = JSON.parse(data).role;
        return acc;
      }, {});

      // Notificar al nuevo cliente sobre los peers existentes
      client.emit('peerDiscovery', { peers });

      // Notificar a los clientes existentes sobre el nuevo peer
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
      // Remover el peer del hash en Redis
      await this.redis.hDel('peers', clientIP);

      // Notificar a todos los clientes sobre el peer desconectado
      this.server.emit('peerDiscovery', { disconnectedPeer: clientIP });

      this.logger.log(`✅ Nodo eliminado: ${clientIP}`);
    } catch (error) {
      this.logger.error(`Error al eliminar nodo en Redis: ${error.message}`);
    }
  }

  async getPeers(): Promise<Record<string, string>> {
    try {
      // Obtener todos los peers de Redis
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

  // Método para chequear la salud del sistema cada 5 segundos.
  @Interval(5000)
  async checkHealth() {
    const healthStatus = await this.performHealthCheck();

    if (!healthStatus.isHealthy) {
      await this.initiateFailover();
    }
  }

  // Utiliza HealthService para determinar si el sistema está saludable.
  private async performHealthCheck(): Promise<{ isHealthy: boolean; details: any }> {
    // Se obtiene el estado de salud actual.
    const health = this.healthService.isOk();
    // Umbrales definidos para considerar el sistema como saludable.
    const cpuThreshold = 90; // 80%
    const memoryThreshold = 90; // 80%

    const cpuUsage = health.metrics.cpu;
    const memoryUsage = health.metrics.memory;

    const isHealthy = cpuUsage < cpuThreshold && memoryUsage < memoryThreshold;

    this.logger.debug(`Health Check - CPU: ${cpuUsage}%, Memoria: ${memoryUsage}%, Healthy: ${isHealthy}`);

    return { isHealthy, details: health };
  }

  // Inicia el proceso de failover en caso de detectar problemas de salud.
  private async initiateFailover() {
    const currentTime = Date.now();
    if (currentTime - this.lastFailoverTime < this.FAIL_OVER_COOLDOWN) {
      this.logger.warn('Failover ignorado debido al enfriamiento.');
      return;
    }

    this.lastFailoverTime = currentTime;
    this.logger.warn('Iniciando failover debido a problemas de salud detectados.');
    this.server.emit('FAILOVER_INITIATED');
    await this.transferActiveConnections();
    await this.syncState();
  }

  // Simula la transferencia de conexiones activas a otro nodo.
  private async transferActiveConnections() {
    this.logger.log('Transfiriendo conexiones activas...');
    // Implementa la lógica para que cada cliente se reconecte a un nuevo endpoint.
    this.server.emit('TRANSFER_CONNECTIONS', { message: 'Por favor, reconéctate a un nuevo servidor.' });
  }

  // Sincroniza el estado actual (por ejemplo, la lista de peers) con el nuevo nodo principal.
  private async syncState() {
    this.logger.log('Sincronizando estado con el nuevo nodo principal...');
    const peers = await this.getPeers();
    this.server.emit('STATE_SYNC', { peers });
  }
}
