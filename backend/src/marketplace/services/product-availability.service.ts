import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type StockLine = {
  productId: string;
  quantity: number;
};

type SellableProduct = {
  id: string;
  name: string;
  status: string;
  availableQuantity: number;
  unit: string;
  pricePerUnit: number;
  minOrderQuantity: number;
  shopId: string;
  images: { url: string }[];
  shop?: { isActive: boolean } | null;
};

/**
 * Single place that decides whether a product can be sold and that moves stock.
 * Nest constructs one instance; the constructor keeps that instance for getInstance().
 */
@Injectable()
export class ProductAvailabilityService {
  private static instance: ProductAvailabilityService | undefined;

  constructor(private readonly prisma: PrismaService) {
    if (ProductAvailabilityService.instance) {
      return ProductAvailabilityService.instance;
    }
    ProductAvailabilityService.instance = this;
  }

  static getInstance(): ProductAvailabilityService {
    const instance = ProductAvailabilityService.instance;
    if (!instance) {
      throw new Error('ProductAvailabilityService has not been created.');
    }
    return instance;
  }

  isListed(product: {
    status: string;
    shop?: { isActive: boolean } | null;
  }): boolean {
    return product.status === 'active' && product.shop?.isActive !== false;
  }

  ensurePurchasable(product: SellableProduct, quantity: number): void {
    if (!this.isListed(product)) {
      throw new BadRequestException(`Product "${product.name}" is no longer available.`);
    }
    if (quantity < product.minOrderQuantity) {
      throw new BadRequestException(
        `Minimum order quantity for "${product.name}" is ${product.minOrderQuantity} ${product.unit}.`,
      );
    }
    if (quantity > product.availableQuantity) {
      throw new BadRequestException(
        `Insufficient stock for "${product.name}". Available: ${product.availableQuantity} ${product.unit}.`,
      );
    }
  }

  lineTotal(pricePerUnit: number, quantity: number): number {
    return pricePerUnit * quantity;
  }

  /** Reserve every line, or put back anything already reserved. */
  async reserveAll(lines: StockLine[]): Promise<void> {
    const reserved: StockLine[] = [];
    try {
      for (const line of lines) {
        const ok = await this.reserveOne(line.productId, line.quantity);
        if (!ok) {
          throw new BadRequestException('Insufficient stock for one of the products.');
        }
        reserved.push(line);
      }
    } catch (error) {
      await this.releaseAll(reserved);
      throw error;
    }
  }

  async releaseAll(lines: StockLine[]): Promise<void> {
    for (const line of lines) {
      await this.releaseOne(line.productId, line.quantity);
    }
  }

  private async reserveOne(productId: string, quantity: number): Promise<boolean> {
    const taken = await this.prisma.product.updateMany({
      where: {
        id: productId,
        status: 'active',
        availableQuantity: { gte: quantity },
      },
      data: { availableQuantity: { decrement: quantity } },
    });
    if (taken.count !== 1) return false;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { availableQuantity: true, status: true },
    });
    if (product && product.availableQuantity <= 0 && product.status === 'active') {
      await this.prisma.product.update({
        where: { id: productId },
        data: { status: 'out_of_stock' },
      });
    }
    return true;
  }

  private async releaseOne(productId: string, quantity: number): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { status: true },
    });
    if (!product) return;
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        availableQuantity: { increment: quantity },
        ...(product.status === 'out_of_stock' ? { status: 'active' as const } : {}),
      },
    });
  }
}
