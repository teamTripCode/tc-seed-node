import { Module } from '@nestjs/common';
import { P2PGateway } from './p2p.gateway';
import { RedisModule } from 'src/redis/redis.module';
import { SignatureModule } from 'src/signature/signature.module';

@Module({
  providers: [P2PGateway],
  exports: [P2PGateway],
  imports: [RedisModule, SignatureModule],
})
export class P2PModule {}