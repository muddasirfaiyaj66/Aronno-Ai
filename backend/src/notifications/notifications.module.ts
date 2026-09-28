import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MarketModule } from '../market/market.module';
import { WeatherModule } from '../weather/weather.module';
import { NotificationHub } from './notification-hub';
import { NotificationLiveServer } from './notification-live.server';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [JwtModule.register({}), MarketModule, WeatherModule],
  controllers: [NotificationsController],
  providers: [NotificationHub, NotificationsService, NotificationLiveServer],
  exports: [NotificationsService],
})
export class NotificationsModule {}
