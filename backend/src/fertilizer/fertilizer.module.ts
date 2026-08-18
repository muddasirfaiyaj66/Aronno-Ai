import { Module } from '@nestjs/common';
import { FertilizerController } from './fertilizer.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [FertilizerController],
})
export class FertilizerModule {}
