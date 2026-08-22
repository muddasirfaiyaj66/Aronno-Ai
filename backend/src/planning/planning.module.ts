import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { AiModule } from '../ai/ai.module';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [AiModule, WeatherModule],
  controllers: [PlanningController],
})
export class PlanningModule {}
