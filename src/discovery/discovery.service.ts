import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class DiscoveryService {

  constructor(private readonly redis: RedisService) { }

  async getPeers() {
    return { peers: await this.redis.hGetAll('peers') };
  }
}
