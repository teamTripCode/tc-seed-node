import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { RedisService } from 'src/redis/redis.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  imports: [RedisModule],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
