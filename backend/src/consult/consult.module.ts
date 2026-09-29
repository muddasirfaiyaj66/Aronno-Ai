import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConsultController } from './consult.controller';
import { ConsultInternalController } from './consult-internal.controller';
import { ConsultService } from './consult.service';
import { CallClient } from './call-client';

@Module({
  imports: [MailModule, NotificationsModule, JwtModule.register({})],
  controllers: [ConsultController, ConsultInternalController],
  providers: [ConsultService, CallClient],
})
export class ConsultModule {}
