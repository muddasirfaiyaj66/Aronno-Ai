import {
  Body,
  Controller,
  Delete,
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
import { ProductService } from '../services/product.service';
import {
  CreateProductDto,
  FilterProductsDto,
  UpdateProductDto,
} from '../dto/product.dto';

@Controller('marketplace/products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Public()
  @Get()
  async getProducts(@Query() query: FilterProductsDto) {
    const data = await this.productService.filterProducts(query);
    return { success: true, data };
  }

  @Get('my-products')
  async getMyProducts(@CurrentUser() user: AuthUser) {
    const data = await this.productService.getProductsBySeller(user.id);
    return { success: true, data };
  }

  @Public()
  @Get(':id')
  async getProduct(@Param('id') id: string) {
    const data = await this.productService.getProductById(id);
    return { success: true, data };
  }

  @Post()
  async createProduct(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductDto,
  ) {
    const data = await this.productService.createProduct(user.id, dto);
    return { success: true, data };
  }

  @Patch(':id')
  async updateProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const data = await this.productService.updateProduct(user.id, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  async deleteProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.productService.deleteProduct(user.id, id);
    return { success: true, data };
  }
}
