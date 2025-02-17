import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class BackupService {
  constructor(private readonly redis: RedisService) { }

  @Interval(3600000) // Cada Hora
  async backupPeerData() {
    const peers = await this.redis.hGetAll('peers');
    const backupData = {
      timestamp: Date.now(),
      peers,
      metadata: {
        version: process.env.APP_VERSION,
        backupType: 'hourly',
      }
    }

    // Guardar backup en Redis
    await this.redis.set(`backup:${Date.now()}`, JSON.stringify(backupData));
  }

  async recover() {
    const backups = await this.redis.keys('backup:*');
    const latestBackupKey = backups.sort().pop();
    if (latestBackupKey) {
      const backupData = await this.redis.get(latestBackupKey);
      const parsedBackup = JSON.parse(backupData);
      await this.redis.hSetMultiple('peers', parsedBackup.peers);
    }
  }
}
