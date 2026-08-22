import { Controller, Get, Inject, Query } from '@nestjs/common';
import { WEATHER } from '../ai/ai.tokens';
import type { WeatherPort } from './weather.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { WeatherLocationService } from './weather-location.service';

@Controller('weather')
export class WeatherController {
  constructor(
    @Inject(WEATHER) private readonly weather: WeatherPort,
    private readonly locations: WeatherLocationService,
  ) {}

  @Get('current')
  async current(
    @CurrentUser() user: AuthUser,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
  ) {
    const point = await this.locations.forUser(user.id, lat, lon);
    return this.weather.current(point);
  }
}
