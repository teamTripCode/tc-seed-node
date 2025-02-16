import { Module } from '@nestjs/common';
import { HeartbeatService } from './heartbeat.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  providers: [HeartbeatService],
  imports: [RedisModule],
})
export class HeartbeatModule {}
