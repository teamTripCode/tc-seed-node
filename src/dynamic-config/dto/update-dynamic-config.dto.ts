import { PartialType } from '@nestjs/mapped-types';
import { CreateDynamicConfigDto } from './create-dynamic-config.dto';

export class UpdateDynamicConfigDto extends PartialType(CreateDynamicConfigDto) {}
