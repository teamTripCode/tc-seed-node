import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import * as osUtils from 'node-os-utils';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private metrics = {
    activeConnections: 0,
    failedConnections: 0,
    messageLatency: new Map<string, number[]>(),
    resourceUsage: { memory: 0, cpu: 0 },
    systemInfo: {
      uptime: 0,
      loadAverage: [0, 0, 0],
      freeMemory: 0,
      totalMemory: 0,
      cpuCount: 0,
    },
  };

  constructor() {
    // Inicializar información estática del sistema
    this.initSystemInfo();
  }

  private async initSystemInfo() {
    try {
      const cpu = osUtils.cpu;
      const mem = osUtils.mem;
      const os = osUtils.os;

      // Obtenemos información que no cambia frecuentemente
      this.metrics.systemInfo.cpuCount = cpu.count();
      this.metrics.systemInfo.totalMemory = await mem.info().then(info => info.totalMemMb);
    } catch (error) {
      this.logger.error(`Error al inicializar información del sistema: ${error.message}`);
    }
  }

  @Interval(5000)
  async collectMetrics() {
    try {
      this.metrics.resourceUsage = await this.getSystemMetrics();
      this.metrics.systemInfo.uptime = osUtils.os.uptime();
      this.metrics.systemInfo.loadAverage = require('os').loadavg();
      await this.exportMetrics();
    } catch (error) {
      this.logger.error(`Error al recolectar métricas: ${error.message}`);
    }
  }

  isOk() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      metrics: {
        cpu: this.metrics.resourceUsage.cpu,
        memory: this.metrics.resourceUsage.memory,
        uptime: this.metrics.systemInfo.uptime,
      },
    };
  }

  getDetailedMetrics() {
    return {
      ...this.metrics,
      messageLatency: Object.fromEntries(this.metrics.messageLatency),
      timestamp: new Date().toISOString(),
    };
  }

  private async getSystemMetrics(): Promise<{ memory: number; cpu: number }> {
    try {
      const cpu = osUtils.cpu;
      const mem = osUtils.mem;

      // Obtener uso de CPU (porcentaje)
      const cpuUsage = await cpu.usage();

      // Obtener uso de memoria (porcentaje)
      const memInfo = await mem.info();
      const memoryUsage = 100 - memInfo.freeMemPercentage;

      this.logger.debug(`CPU Usage: ${cpuUsage}, Memory Usage: ${memoryUsage}`);

      // Actualizar información adicional
      this.metrics.systemInfo.freeMemory = memInfo.freeMemMb;

      return {
        memory: parseFloat(memoryUsage.toFixed(2)),
        cpu: parseFloat(cpuUsage.toFixed(2)),
      };
    } catch (error) {
      this.logger.error(`Error al obtener métricas del sistema: ${error.message}`);
      return { memory: 0, cpu: 0 };
    }
  }

  private async exportMetrics() {
    try {
      // Aquí podrías integrar con Prometheus, DataDog, etc.
      this.logger.debug(`Métricas: CPU ${this.metrics.resourceUsage.cpu}%, Memoria ${this.metrics.resourceUsage.memory}%`);
    } catch (error) {
      this.logger.error(`Error al exportar métricas: ${error.message}`);
    }
  }

  // Métodos para que otros servicios actualicen las métricas
  reportConnection(success: boolean) {
    if (success) {
      this.metrics.activeConnections++;
    } else {
      this.metrics.failedConnections++;
    }
  }

  reportDisconnection() {
    if (this.metrics.activeConnections > 0) {
      this.metrics.activeConnections--;
    }
  }

  reportLatency(clientId: string, latencyMs: number) {
    if (!this.metrics.messageLatency.has(clientId)) {
      this.metrics.messageLatency.set(clientId, []);
    }

    const latencies = this.metrics.messageLatency.get(clientId);
    // Mantener solo las últimas 100 mediciones para evitar uso excesivo de memoria
    if (latencies.length >= 100) {
      latencies.shift();
    }
    latencies.push(latencyMs);
  }
}
