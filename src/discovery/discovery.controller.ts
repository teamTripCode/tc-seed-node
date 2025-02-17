import { Controller, Get } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) { }

  @Get('peers')
  getPeers() {
    return this.discoveryService.getPeers();
  }
}
