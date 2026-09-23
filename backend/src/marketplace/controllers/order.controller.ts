import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../auth/auth.types';
import { OrderService } from '../services/order.service';
import { ReviewService } from '../services/review.service';
import { CreateOrderDto, UpdateOrderStatusDto } from '../dto/order.dto';
import { CreateReviewDto } from '../dto/review.dto';

@Controller('marketplace/orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly reviewService: ReviewService,
  ) {}

  @Post()
  async checkout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
  ) {
    const data = await this.orderService.createOrder(user.id, dto);
    return { success: true, data };
  }

  @Get('my-orders')
  async getMyOrders(@CurrentUser() user: AuthUser) {
    const data = await this.orderService.getBuyerOrders(user.id);
    return { success: true, data };
  }

  @Get('shop-orders')
  async getShopOrders(@CurrentUser() user: AuthUser) {
    const data = await this.orderService.getShopOrders(user.id);
    return { success: true, data };
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const data = await this.orderService.updateOrderStatus(user.id, id, dto);
    return { success: true, data };
  }

  @Post(':id/reviews')
  async createReview(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
  ) {
    const data = await this.reviewService.createReview(user.id, {
      ...dto,
      orderId: id,
    });
    return { success: true, data };
  }
}
