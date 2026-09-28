import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminInsightsService } from './admin-insights.service';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [AuthModule, NotificationsModule, MarketplaceModule],
  controllers: [AdminController],
  providers: [AdminService, AdminInsightsService],
})
export class AdminModule {}
