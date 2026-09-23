import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsBoolean()
  @IsOptional()
  clearPreviousCart?: boolean;
}

export class UpdateCartItemDto {
  @IsNumber()
  @Min(0.01)
  quantity: number;
}
