import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { CreateDiscoveryDto } from './dto/create-discovery.dto';
import { UpdateDiscoveryDto } from './dto/update-discovery.dto';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) { }

  @Get('peers')
  getPeers() {
    return this.discoveryService.getPeers();
  }
}
