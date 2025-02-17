import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { RedisService } from 'src/redis/redis.service';
import { Interval } from '@nestjs/schedule';
import { PingResponse, promise as pingPromise } from 'ping';

interface PeerInfo {
  role: string;
  lastHeartbeat: number;
  latency?: number;
}

@Injectable()
export class HeartbeatService {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(HeartbeatService.name);
  private readonly HEARTBEAT_CHECK_INTERVAL = 10000; // 10 segundos
  private readonly INACTIVE_CHECK_INTERVAL = 30000; // 30 segundos
  private readonly INACTIVE_THRESHOLD = 90000; // 90 segundos
  private readonly MAX_RETRY_COUNT = 3;
  private readonly PING_TIMEOUT = 5; // 5 segundos
  private readonly adaptiveIntervals = new Map<string, number>();
  private readonly pingFailureCounter = new Map<string, number>();

  constructor(private readonly redis: RedisService) { }

  @Interval('inactivityCheck', 30000)
  async checkNodesActivity() {
    try {
      // Obtener todos los nodos registrados
      const peersData = await this.redis.hGetAll('peers');
      const currentTime = Date.now();
      const updatePromises: Promise<any>[] = [];

      for (const [clientIP, data] of Object.entries(peersData)) {
        try {
          // Intentamos parsear los datos
          const peerInfo: PeerInfo = JSON.parse(data);
          const lastHeartbeat = peerInfo.lastHeartbeat || 0;

          // Si el último heartbeat es más antiguo que el umbral, eliminar el nodo
          if (currentTime - lastHeartbeat > this.INACTIVE_THRESHOLD) {
            this.logger.warn(
              `Nodo inactivo detectado: ${clientIP}. Último heartbeat: ${new Date(
                lastHeartbeat,
              ).toISOString()}`,
            );

            // Eliminar el nodo de Redis
            updatePromises.push(this.redis.hDel('peers', clientIP));

            // Limpiar datos del nodo eliminado
            this.adaptiveIntervals.delete(clientIP);
            this.pingFailureCounter.delete(clientIP);

            // Notificar a todos los clientes que este nodo ha sido eliminado
            this.server.emit('peerDiscovery', {
              disconnectedPeer: clientIP,
              reason: 'inactive',
              timestamp: currentTime,
            });

            this.logger.log(`Nodo inactivo eliminado: ${clientIP}`);
          }
        } catch (error) {
          // Si los datos no son JSON válido, actualizar al nuevo formato
          this.logger.warn(
            `Datos de peer en formato antiguo para ${clientIP}, actualizando...`,
          );
          const role = data.toString(); // En el formato antiguo, el valor era solo el rol
          updatePromises.push(
            this.redis.hSet(
              'peers',
              clientIP,
              JSON.stringify({
                role,
                lastHeartbeat: currentTime,
              } as PeerInfo),
            ),
          );
        }
      }

      // Esperar a que todas las actualizaciones se completen
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    } catch (error) {
      this.logger.error(
        `Error al verificar actividad de nodos: ${error.message}`,
      );
    }
  }

  @Interval('heartbeatCheck', 10000)
  async checkHeartbeat() {
    try {
      const peers = await this.redis.hGetAll('peers');
      const updatePromises: Promise<any>[] = [];

      for (const [ip, data] of Object.entries(peers)) {
        updatePromises.push(this.checkPeerConnectivity(ip, data));
      }

      // Esperar a que todas las actualizaciones terminen
      if (updatePromises.length > 0) {
        await Promise.allSettled(updatePromises);
      }
    } catch (error) {
      this.logger.error(`Error en la verificación de heartbeat: ${error.message}`);
    }
  }

  private async checkPeerConnectivity(ip: string, data: string): Promise<void> {
    try {
      const peer: PeerInfo = JSON.parse(data);
      const pingResult = await this.measureLatency(ip);

      if (pingResult.alive) {
        // Reiniciar contador de fallos si está vivo
        this.pingFailureCounter.delete(ip);

        // Parsear y validar el tiempo de latencia
        const latencyValue = this.parseLatency(pingResult.time);

        // Actualizar la latencia en la información del peer
        peer.latency = latencyValue;

        // Ajustar el intervalo adaptativo (mínimo 5 segundos, máximo 30 segundos)
        const newInterval = Math.max(5000, Math.min(30000, latencyValue * 3));
        this.adaptiveIntervals.set(ip, newInterval);

        // Actualizar el timestamp del último heartbeat
        peer.lastHeartbeat = Date.now();

        // Guardar en Redis
        await this.redis.hSet('peers', ip, JSON.stringify(peer));
      } else {
        // Incrementar contador de fallos
        const failCount = (this.pingFailureCounter.get(ip) || 0) + 1;
        this.pingFailureCounter.set(ip, failCount);

        if (failCount >= this.MAX_RETRY_COUNT) {
          this.logger.warn(`Nodo ${ip} no responde después de ${failCount} intentos`);
        }
      }
    } catch (error) {
      this.logger.error(`Error al verificar conectividad para ${ip}: ${error.message}`);
    }
  }

  private parseLatency(time: number | string): number {
    if (typeof time === 'number') {
      return time;
    }

    if (time === 'unknown') {
      return 1000; // Valor predeterminado para latencia desconocida
    }

    // Intenta convertir la cadena a número
    const parsedTime = parseFloat(time);
    return isNaN(parsedTime) ? 1000 : parsedTime;
  }

  private async measureLatency(ip: string): Promise<PingResponse> {
    try {
      return await pingPromise.probe(ip, {
        timeout: this.PING_TIMEOUT,
        min_reply: 1,      // Solo necesitamos una respuesta
        extra: ['-i', '2'] // Intervalo entre pings de 2 segundos
      });
    } catch (error) {
      this.logger.error(`Error al medir la latencia para ${ip}: ${error.message}`);

      // Crear una respuesta de ping completa para el caso de error
      const errorResponse: PingResponse = {
        host: ip,
        alive: false,
        time: 1000,
        output: `Error: ${error.message}`,

        // Campos adicionales requeridos por la interfaz PingResponse
        inputHost: ip,
        times: [],
        min: 'unknown',
        max: 'unknown',
        avg: 'unknown',
        stddev: 'unknown',
        packetLoss: '100.000', // 100% de pérdida de paquetes
        numeric_host: ip
      };

      return errorResponse;
    }
  }
}