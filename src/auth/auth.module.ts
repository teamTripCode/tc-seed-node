import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  providers: [AuthService],
  imports: [RedisModule],
})
export class AuthModule {}
