import { Module } from '@nestjs/common';
import { CostController } from './cost.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [CostController],
})
export class CostModule {}
