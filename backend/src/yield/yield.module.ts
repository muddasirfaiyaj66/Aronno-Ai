import { Module } from '@nestjs/common';
import { YieldController } from './yield.controller';
import { AiModule } from '../ai/ai.module';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [AiModule, WeatherModule],
  controllers: [YieldController],
})
export class YieldModule {}
