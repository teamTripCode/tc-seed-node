import { PartialType } from '@nestjs/mapped-types';
import { CreateHeartbeatDto } from './create-heartbeat.dto';

export class UpdateHeartbeatDto extends PartialType(CreateHeartbeatDto) {}
