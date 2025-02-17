import { Module } from '@nestjs/common';
import { P2PGateway } from './p2p.gateway';
import { RedisModule } from 'src/redis/redis.module';
import { SignatureModule } from 'src/signature/signature.module';
import { HealthModule } from 'src/health/health.module';

@Module({
  providers: [P2PGateway],
  exports: [P2PGateway],
  imports: [
    RedisModule,
    SignatureModule,
    HealthModule,
  ],
})
export class P2PModule {}