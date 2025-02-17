import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
// import { BackupController } from './backup.controller';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [RedisModule],
  // controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
