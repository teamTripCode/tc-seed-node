import { Module } from '@nestjs/common';
import { DynamicConfigService } from './dynamic-config.service';
import { DynamicConfigController } from './dynamic-config.controller';

@Module({
  controllers: [DynamicConfigController],
  providers: [DynamicConfigService],
})
export class DynamicConfigModule {}
