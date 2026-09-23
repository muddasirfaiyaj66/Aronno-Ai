import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from '../dto/order.dto';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveDistrict(districtIdOrSlug: string) {
    if (!districtIdOrSlug) return null;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(districtIdOrSlug);
    if (isObjectId) {
      const d = await this.prisma.district.findUnique({ where: { id: districtIdOrSlug } });
      if (d) return d;
    }
    return this.prisma.district.findUnique({ where: { slug: districtIdOrSlug } });
  }

  async createOrder(buyerUserId: string, dto: CreateOrderDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: dto.shopId },
    });
    if (!shop || !shop.isActive) {
      throw new NotFoundException('Shop not found or inactive.');
    }

    if (shop.ownerUserId === buyerUserId) {
      throw new BadRequestException('You cannot purchase products from your own shop.');
    }

    const district = await this.resolveDistrict(dto.districtId);
    if (!district) {
      throw new BadRequestException('Invalid district ID.');
    }

    const cart = await this.prisma.cart.findUnique({
      where: { userId: buyerUserId },
    });

    if (!cart || !cart.items.length) {
      throw new BadRequestException('Your cart is empty.');
    }

    const productIds = cart.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, shopId: dto.shopId },
    });

    if (!products.length) {
      throw new BadRequestException('No items in cart belong to this shop.');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const orderItems: Array<{
      productId: string;
      productName: string;
      unit: any;
      pricePerUnit: number;
      quantity: number;
      totalPrice: number;
      imageUrl: string | null;
    }> = [];

    let subtotalBdt = 0;
    const itemsToRemoveFromCart: string[] = [];

    for (const item of cart.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;

      if (product.status !== 'active') {
        throw new BadRequestException(`Product "${product.name}" is no longer available.`);
      }

      if (item.quantity > product.availableQuantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.availableQuantity} ${product.unit}.`,
        );
      }

      const itemTotal = product.pricePerUnit * item.quantity;
      subtotalBdt += itemTotal;
      itemsToRemoveFromCart.push(item.productId);

      orderItems.push({
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        pricePerUnit: product.pricePerUnit,
        quantity: item.quantity,
        totalPrice: itemTotal,
        imageUrl: product.images[0]?.url ?? null,
      });
    }

    if (!orderItems.length) {
      throw new BadRequestException('No valid items found for checkout.');
    }

    const deliveryFeeBdt = 60; // Flat delivery fee
    const totalBdt = subtotalBdt + deliveryFeeBdt;
    const orderNumber = `ARN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Build payment status from submitted payment method
    const paymentStatusValue =
      dto.paymentMethod === 'cash_on_delivery' || !dto.paymentMethod
        ? 'cash_on_delivery'
        : 'pending';

    // Build a full shipping address string including upazila & buyer name
    const fullAddress = [
      dto.buyerName ? `প্রাপক: ${dto.buyerName}` : null,
      dto.shippingAddress,
      dto.upazila ? `উপজেলা: ${dto.upazila}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        buyerUserId,
        shopId: shop.id,
        sellerUserId: shop.ownerUserId,
        items: orderItems,
        subtotalBdt,
        deliveryFeeBdt,
        totalBdt,
        shippingAddress: fullAddress,
        contactPhone: dto.contactPhone,
        districtId: district.id,
        paymentStatus: paymentStatusValue as any,
        notes: dto.notes,
      },
      include: {
        shop: { select: { id: true, name: true, phone: true } },
        district: true,
      },
    });

    // Deduct stock for each product
    for (const item of orderItems) {
      const p = productMap.get(item.productId)!;
      const newStock = p.availableQuantity - item.quantity;
      await this.prisma.product.update({
        where: { id: item.productId },
        data: {
          availableQuantity: newStock,
          ...(newStock <= 0 && { status: 'out_of_stock' }),
        },
      });
    }

    // Remove purchased items from Cart
    const remainingCartItems = cart.items.filter(
      (i) => !itemsToRemoveFromCart.includes(i.productId),
    );
    await this.prisma.cart.update({
      where: { userId: buyerUserId },
      data: { items: remainingCartItems },
    });

    return order;
  }

  async getBuyerOrders(buyerUserId: string) {
    return this.prisma.order.findMany({
      where: { buyerUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { id: true, name: true, phone: true, logoUrl: true } },
        district: true,
      },
    });
  }

  async getShopOrders(sellerUserId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerUserId: sellerUserId },
    });
    if (!shop) throw new ForbiddenException('You do not own a shop.');

    return this.prisma.order.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { id: true, displayName: true, phone: true, avatarUrl: true } },
        district: true,
      },
    });
  }

  /** Seller-allowed status state machine transitions */
  private static readonly SELLER_TRANSITIONS: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
  };

  async updateOrderStatus(
    userId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    const isSeller = order.sellerUserId === userId;
    const isBuyer = order.buyerUserId === userId;

    if (!isSeller && !isBuyer) {
      throw new ForbiddenException('You do not have permission to view or update this order.');
    }

    // Buyer can only cancel a pending order
    if (isBuyer) {
      if (dto.status !== 'cancelled') {
        throw new ForbiddenException('Buyers can only cancel orders.');
      }
      if (order.status !== 'pending') {
        throw new BadRequestException('Buyers can only cancel orders that are still pending.');
      }
    }

    // Seller must follow the state machine
    if (isSeller) {
      const allowed = OrderService.SELLER_TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition order from "${order.status}" to "${dto.status}". ` +
            `Allowed next statuses: [${allowed.join(', ') || 'none'}].`,
        );
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: dto.status,
        ...(dto.status === 'delivered' && { paymentStatus: 'paid' }),
      },
      include: {
        shop: true,
        district: true,
      },
    });

    // If order was cancelled, restore stock
    if (dto.status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
        });
        if (product) {
          const restoredStock = product.availableQuantity + item.quantity;
          await this.prisma.product.update({
            where: { id: item.productId },
            data: {
              availableQuantity: restoredStock,
              ...(product.status === 'out_of_stock' && restoredStock > 0
                ? { status: 'active' }
                : {}),
            },
          });
        }
      }
    }

    return updated;
  }
}
