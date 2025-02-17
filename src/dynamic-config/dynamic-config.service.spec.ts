import { Test, TestingModule } from '@nestjs/testing';
import { DynamicConfigService } from './dynamic-config.service';

describe('DynamicConfigService', () => {
  let service: DynamicConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DynamicConfigService],
    }).compile();

    service = module.get<DynamicConfigService>(DynamicConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
