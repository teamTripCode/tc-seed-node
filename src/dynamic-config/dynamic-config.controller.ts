import { Controller } from '@nestjs/common';
import { DynamicConfigService } from './dynamic-config.service';
import { Interval } from '@nestjs/schedule';
import { WebSocketServer } from '@nestjs/websockets';
import { Server } from "socket.io"

@Controller('dynamic-config')
export class DynamicConfigController {

  @WebSocketServer()
  server: Server;

  constructor(private readonly dynamicConfigService: DynamicConfigService) {}
  
  private config: Record<string, any> = {};

  @Interval(60000)
  async updateConfig() {
    const newConfig = await this.fetchConfigFromCentralRegistry();

    if (this.shouldUpdateConfig(newConfig)) {
      await this.applyNewConfig(newConfig);
      await this.notifyPeersOfConfigUpdate();
    }
  }

  private async fetchConfigFromCentralRegistry() {
    // Obtener nueva configuración
    return {};
  }

  private shouldUpdateConfig(newConfig: any): boolean {
    return JSON.stringify(newConfig) !== JSON.stringify(this.config);
  }

  private async applyNewConfig(newConfig: any) {
    this.config = newConfig;
  }

  private async notifyPeersOfConfigUpdate() {
    this.server.emit('CONFIG_UPDATE', this.config);
  }
}
