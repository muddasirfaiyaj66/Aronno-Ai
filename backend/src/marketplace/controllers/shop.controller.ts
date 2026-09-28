import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../auth/auth.types';
import { ShopService } from '../services/shop.service';
import { CreateShopDto, FilterShopsDto, UpdateShopDto } from '../dto/shop.dto';

@Controller('marketplace/shops')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Public()
  @Get()
  async getShops(@Query() query: FilterShopsDto) {
    const data = await this.shopService.filterShops(query);
    return { success: true, data };
  }

  @Post()
  async createShop(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateShopDto,
  ) {
    const data = await this.shopService.createShop(user.id, dto);
    return { success: true, data };
  }

  @Get('me')
  async getMyShop(@CurrentUser() user: AuthUser) {
    const data = await this.shopService.getShopByOwner(user.id);
    return { success: true, data };
  }

  @Patch('me')
  async updateMyShop(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateShopDto,
  ) {
    const data = await this.shopService.updateShop(user.id, dto);
    return { success: true, data };
  }

  @Post(':id/report')
  async reportShop(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { reason?: string; details?: string },
  ) {
    const reason = body?.reason?.trim() ?? '';
    if (reason.length < 2) {
      throw new BadRequestException('রিপোর্টের কারণ লিখুন।');
    }
    const data = await this.shopService.reportShop(user.id, id, reason, body.details);
    return { success: true, data };
  }

  @Public()
  @Get(':id')
  async getPublicShop(@Param('id') id: string) {
    const data = await this.shopService.getPublicShopById(id);
    return { success: true, data };
  }
}
