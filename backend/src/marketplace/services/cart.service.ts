import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddCartItemDto, UpdateCartItemDto } from '../dto/cart.dto';
import { ProductAvailabilityService } from './product-availability.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private availability(): ProductAvailabilityService {
    return ProductAvailabilityService.getInstance();
  }

  async getCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId, items: [] },
      });
    }

    if (!cart.items.length) {
      return { id: cart.id, shopId: null, shopName: null, items: [], totalBdt: 0 };
    }

    const productIds = cart.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        shop: { select: { id: true, name: true, isActive: true } },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    const enrichedItems = cart.items
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product || !this.availability().isListed(product)) return null;
        const currentPrice = product.pricePerUnit;
        const totalPrice = currentPrice * item.quantity;
        return {
          productId: item.productId,
          productName: product.name,
          unit: product.unit,
          pricePerUnit: currentPrice,
          quantity: item.quantity,
          availableQuantity: product.availableQuantity,
          minOrderQuantity: product.minOrderQuantity,
          imageUrl: product.images[0]?.url ?? null,
          shopId: product.shopId,
          shopName: product.shop.name,
          totalPrice,
        };
      })
      .filter(Boolean);

    const totalBdt = enrichedItems.reduce((acc, curr) => acc + (curr?.totalPrice ?? 0), 0);
    const shopId = enrichedItems[0]?.shopId ?? null;
    const shopName = enrichedItems[0]?.shopName ?? null;

    return {
      id: cart.id,
      shopId,
      shopName,
      items: enrichedItems,
      totalBdt,
    };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { shop: true },
    });

    if (!product || !product.shop) {
      throw new NotFoundException('Product not found or shop is unavailable.');
    }
    this.availability().ensurePurchasable(product, dto.quantity);

    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
          items: [
            {
              productId: dto.productId,
              quantity: dto.quantity,
              priceAtAdd: product.pricePerUnit,
            },
          ],
        },
      });
    } else if (cart.items.length > 0) {
      // Find current shop of items in cart
      const existingProductIds = cart.items.map((i) => i.productId);
      const existingProducts = await this.prisma.product.findMany({
        where: { id: { in: existingProductIds } },
        include: { shop: { select: { id: true, name: true } } },
      });

      const differentShopProduct = existingProducts.find(
        (p) => p.shopId !== product.shopId,
      );

      if (differentShopProduct) {
        if (dto.clearPreviousCart) {
          // Replace cart items with new item
          cart = await this.prisma.cart.update({
            where: { userId },
            data: {
              items: [
                {
                  productId: dto.productId,
                  quantity: dto.quantity,
                  priceAtAdd: product.pricePerUnit,
                },
              ],
            },
          });
        } else {
          // Throw conflict exception for mobile app to show Bangla confirmation modal
          const existingShopName = differentShopProduct.shop?.name ?? 'অন্য একটি দোকান';
          throw new ConflictException({
            code: 'SHOP_MISMATCH',
            message: 'Cart contains products from another shop.',
            existingShopName,
          });
        }
      } else {
        // Same shop or empty cart items
        const existingIndex = cart.items.findIndex(
          (i) => i.productId === dto.productId,
        );
        const updatedItems = [...cart.items];

        if (existingIndex >= 0) {
          const newQty = updatedItems[existingIndex].quantity + dto.quantity;
          this.availability().ensurePurchasable(product, newQty);
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: newQty,
            priceAtAdd: product.pricePerUnit,
          };
        } else {
          updatedItems.push({
            productId: dto.productId,
            quantity: dto.quantity,
            priceAtAdd: product.pricePerUnit,
          });
        }

        cart = await this.prisma.cart.update({
          where: { userId },
          data: { items: updatedItems },
        });
      }
    } else {
      // Cart exists but items array is empty
      cart = await this.prisma.cart.update({
        where: { userId },
        data: {
          items: [
            {
              productId: dto.productId,
              quantity: dto.quantity,
              priceAtAdd: product.pricePerUnit,
            },
          ],
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItemQuantity(userId: string, productId: string, dto: UpdateCartItemDto) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart not found.');

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product unavailable.');
    }
    this.availability().ensurePurchasable(product, dto.quantity);

    const updatedItems = cart.items.map((item) =>
      item.productId === productId
        ? { ...item, quantity: dto.quantity, priceAtAdd: product.pricePerUnit }
        : item,
    );

    await this.prisma.cart.update({
      where: { userId },
      data: { items: updatedItems },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) return { id: '', items: [], totalBdt: 0 };

    const updatedItems = cart.items.filter((i) => i.productId !== productId);

    await this.prisma.cart.update({
      where: { userId },
      data: { items: updatedItems },
    });

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    await this.prisma.cart.update({
      where: { userId },
      data: { items: [] },
    });
    return { items: [], totalBdt: 0 };
  }
}
