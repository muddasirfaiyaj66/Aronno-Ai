import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddCartItemDto, UpdateCartItemDto } from '../dto/cart.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

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
      return { id: cart.id, items: [], totalBdt: 0 };
    }

    const productIds = cart.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        shop: { select: { id: true, name: true } },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    const enrichedItems = cart.items
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product || product.status !== 'active') return null;
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
          imageUrl: product.images[0] ?? null,
          shopId: product.shopId,
          shopName: product.shop.name,
          totalPrice,
        };
      })
      .filter(Boolean);

    const totalBdt = enrichedItems.reduce((acc, curr) => acc + (curr?.totalPrice ?? 0), 0);

    return {
      id: cart.id,
      items: enrichedItems,
      totalBdt,
    };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product || product.status !== 'active') {
      throw new NotFoundException('Product not found or unavailable.');
    }

    if (dto.quantity < product.minOrderQuantity) {
      throw new BadRequestException(
        `Minimum order quantity for this product is ${product.minOrderQuantity} ${product.unit}.`,
      );
    }

    if (dto.quantity > product.availableQuantity) {
      throw new BadRequestException(
        `Only ${product.availableQuantity} ${product.unit} available in stock.`,
      );
    }

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
    } else {
      const existingIndex = cart.items.findIndex(
        (i) => i.productId === dto.productId,
      );
      const updatedItems = [...cart.items];

      if (existingIndex >= 0) {
        const newQty = updatedItems[existingIndex].quantity + dto.quantity;
        if (newQty > product.availableQuantity) {
          throw new BadRequestException(
            `Cannot add ${dto.quantity}. Only ${product.availableQuantity} in stock.`,
          );
        }
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

    return this.getCart(userId);
  }

  async updateItemQuantity(userId: string, productId: string, dto: UpdateCartItemDto) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart not found.');

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== 'active') {
      throw new NotFoundException('Product unavailable.');
    }

    if (dto.quantity < product.minOrderQuantity) {
      throw new BadRequestException(
        `Minimum order quantity is ${product.minOrderQuantity} ${product.unit}.`,
      );
    }

    if (dto.quantity > product.availableQuantity) {
      throw new BadRequestException(`Only ${product.availableQuantity} in stock.`);
    }

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
