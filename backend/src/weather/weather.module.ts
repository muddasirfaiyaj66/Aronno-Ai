import { Module } from '@nestjs/common';
import { WEATHER } from '../ai/ai.tokens';
import { OpenMeteoWeatherAdapter } from './open-meteo.adapter';
import { WeatherController } from './weather.controller';
import { WeatherLocationService } from './weather-location.service';

@Module({
  controllers: [WeatherController],
  providers: [
    WeatherLocationService,
    { provide: WEATHER, useClass: OpenMeteoWeatherAdapter },
  ],
  exports: [WEATHER, WeatherLocationService],
})
export class WeatherModule {}
