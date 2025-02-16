import { PartialType } from '@nestjs/mapped-types';
import { CreateDiscoveryDto } from './create-discovery.dto';

export class UpdateDiscoveryDto extends PartialType(CreateDiscoveryDto) {}
