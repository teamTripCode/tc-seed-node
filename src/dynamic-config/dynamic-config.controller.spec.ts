import { Test, TestingModule } from '@nestjs/testing';
import { DynamicConfigController } from './dynamic-config.controller';
import { DynamicConfigService } from './dynamic-config.service';

describe('DynamicConfigController', () => {
  let controller: DynamicConfigController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DynamicConfigController],
      providers: [DynamicConfigService],
    }).compile();

    controller = module.get<DynamicConfigController>(DynamicConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
