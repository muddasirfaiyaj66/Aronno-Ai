import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../auth/auth.types';
import { CartService } from '../services/cart.service';
import { AddCartItemDto, UpdateCartItemDto } from '../dto/cart.dto';

@Controller('marketplace/cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser() user: AuthUser) {
    const data = await this.cartService.getCart(user.id);
    return { success: true, data };
  }

  @Post('items')
  async addItem(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddCartItemDto,
  ) {
    const data = await this.cartService.addItem(user.id, dto);
    return { success: true, data };
  }

  @Patch('items/:productId')
  async updateQuantity(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const data = await this.cartService.updateItemQuantity(user.id, productId, dto);
    return { success: true, data };
  }

  @Delete('items/:productId')
  async removeItem(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    const data = await this.cartService.removeItem(user.id, productId);
    return { success: true, data };
  }

  @Delete()
  async clearCart(@CurrentUser() user: AuthUser) {
    const data = await this.cartService.clearCart(user.id);
    return { success: true, data };
  }
}
