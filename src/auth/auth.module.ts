import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RedisModule } from 'src/redis/redis.module';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [RedisModule],
})
export class AuthModule {}
