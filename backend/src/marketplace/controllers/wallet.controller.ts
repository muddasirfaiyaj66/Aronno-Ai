import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../auth/auth.types';
import { WalletService } from '../services/wallet.service';

class PayoutDto {
  @IsInt()
  @Min(100)
  @Max(1_000_000)
  amountBdt!: number;

  @IsIn(['bank', 'bkash', 'nagad'])
  channel!: 'bank' | 'bkash' | 'nagad';

  @IsString()
  @MinLength(2)
  accountName!: string;

  @IsString()
  @MinLength(8)
  accountNumber!: string;

  @IsOptional()
  @IsString()
  bankName?: string;
}

@Controller('marketplace/wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  async summary(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.wallet.summary(user.id) };
  }

  @Post('payouts')
  async payout(@CurrentUser() user: AuthUser, @Body() dto: PayoutDto) {
    return { success: true, data: await this.wallet.requestPayout(user.id, dto) };
  }
}
