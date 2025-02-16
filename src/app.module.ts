import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { P2PGateway } from './p2p/p2p.gateway';
import { HealthModule } from './health/health.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HeartbeatModule } from './heartbeat/heartbeat.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { RedisModule } from './redis/redis.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SignatureModule } from './signature/signature.module';

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    DiscoveryModule,
    RedisModule,
    HeartbeatModule,
    SignatureModule,
  ],
  controllers: [AppController],
  providers: [AppService, P2PGateway],
})
export class AppModule { }
