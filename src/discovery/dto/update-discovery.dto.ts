import { PartialType } from '@nestjs/mapped-types';
import { PeerInfo } from './create-discovery.dto';

export class UpdateDiscoveryDto extends PartialType(PeerInfo) {}
