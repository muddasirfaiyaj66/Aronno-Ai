import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [PlanningController],
})
export class PlanningModule {}
