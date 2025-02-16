import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io'
import { RedisService } from 'src/redis/redis.service';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class HeartbeatService {
  @WebSocketServer()
  server: Server

  private logger = new Logger(HeartbeatService.name);
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 segundos
  private readonly INACTIVE_THRESHOLD = 90000; // 90 segundos (3 intervalos)

  constructor(private readonly redis: RedisService) { }

  @Interval(30000) // Ejecutar cada 30 segundos
  async checkNodesActivity() {
    try {
      // Obtener todos los nodos registrados
      const peersData = await this.redis.hGetAll('peers');
      const currentTime = Date.now();

      for (const [clientIP, data] of Object.entries(peersData)) {
        try {
          // Intentamos parsear los datos (ahora guardamos JSON con timestamp)
          const peerInfo = JSON.parse(data);
          const lastHeartbeat = peerInfo.lastHeartbeat || 0;

          // Si el último heartbeat es más antiguo que el umbral, eliminar el nodo
          if (currentTime - lastHeartbeat > this.INACTIVE_THRESHOLD) {
            this.logger.warn(`Nodo inactivo detectado: ${clientIP}. Último heartbeat: ${new Date(lastHeartbeat).toISOString()}`);

            // Eliminar el nodo de Redis
            await this.redis.hDel('peers', clientIP);

            // Notificar a todos los clientes que este nodo ha sido eliminado
            this.server.emit('peerDiscovery', { disconnectedPeer: clientIP, reason: 'inactive' });

            this.logger.log(`✅ Nodo inactivo eliminado: ${clientIP}`);
          }
        } catch (error) {
          // Si los datos no son JSON válido, actualizar al nuevo formato
          this.logger.warn(`Datos de peer en formato antiguo para ${clientIP}, actualizando...`);
          const role = data; // En el formato antiguo, el valor era solo el rol
          await this.redis.hSet('peers', clientIP, JSON.stringify({
            role,
            lastHeartbeat: currentTime
          }));
        }
      }
    } catch (error) {
      this.logger.error(`Error al verificar actividad de nodos: ${error.message}`);
    }
  }
}
