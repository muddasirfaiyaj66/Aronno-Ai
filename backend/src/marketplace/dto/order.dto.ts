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
   * Payment method for v1. Only 'cash_on_delivery' is supported.
   * Defaults to 'cash_on_delivery' if omitted.
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
