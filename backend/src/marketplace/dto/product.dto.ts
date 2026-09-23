import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductCategory, ProductGrade, ProductStatus, ProductUnit } from '@prisma/client';

export class ProductImageDto {
  @IsString()
  url: string;

  @IsString()
  @IsOptional()
  publicId?: string;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @IsString()
  @IsOptional()
  cropId?: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  pricePerUnit: number;

  @IsEnum(ProductUnit)
  unit: ProductUnit;

  @IsNumber()
  @Min(0)
  availableQuantity: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  minOrderQuantity?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  @IsOptional()
  images?: ProductImageDto[];

  @IsString()
  districtId: string;

  @IsString()
  @IsOptional()
  harvestDate?: string;

  @IsEnum(ProductGrade)
  @IsOptional()
  grade?: ProductGrade;

  @IsBoolean()
  @IsOptional()
  isOrganic?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @IsString()
  @IsOptional()
  cropId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  pricePerUnit?: number;

  @IsEnum(ProductUnit)
  @IsOptional()
  unit?: ProductUnit;

  @IsNumber()
  @Min(0)
  @IsOptional()
  availableQuantity?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  minOrderQuantity?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  @IsOptional()
  images?: ProductImageDto[];

  @IsString()
  @IsOptional()
  districtId?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsString()
  @IsOptional()
  harvestDate?: string;

  @IsEnum(ProductGrade)
  @IsOptional()
  grade?: ProductGrade;

  @IsBoolean()
  @IsOptional()
  isOrganic?: boolean;
}

export class FilterProductsDto {
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @IsString()
  @IsOptional()
  districtId?: string;

  @IsString()
  @IsOptional()
  cropId?: string;

  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @IsOptional()
  maxPrice?: number;

  @IsString()
  @IsOptional()
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'rating';

  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;
}
