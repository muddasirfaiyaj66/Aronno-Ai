import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService],
  exports: [AuthService, PasswordService, JwtModule],
})
export class AuthModule {}
