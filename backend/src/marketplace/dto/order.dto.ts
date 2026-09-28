import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  shopId: string;

  @IsString()
  @IsNotEmpty()
  shippingAddress: string;

  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @IsString()
  @IsNotEmpty()
  districtId: string;

  /** Buyer's full name for the delivery address. */
  @IsString()
  @IsOptional()
  buyerName?: string;

  /** Sub-district (upazila) for the delivery address. */
  @IsString()
  @IsOptional()
  upazila?: string;

  /**
   * cash_on_delivery, online (SSLCommerz cards and banks), or mobile_banking
   * (bKash, Nagad, Rocket through SSLCommerz). The server prices the order.
   */
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
