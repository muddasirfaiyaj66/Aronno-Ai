import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from '../dto/order.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { ProductAvailabilityService } from './product-availability.service';
import { PaymentService } from './payment.service';
import { DeliverySettingsService } from './delivery-settings.service';

const PAYMENT_METHODS = new Set(['cash_on_delivery', 'online', 'mobile_banking']);
const CLIENT_MONEY_FIELDS = ['totalBdt', 'subtotalBdt', 'deliveryFeeBdt', 'amount', 'total_amount'];

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentService,
    private readonly delivery: DeliverySettingsService,
  ) {}

  private availability(): ProductAvailabilityService {
    return ProductAvailabilityService.getInstance();
  }

  private async resolveDistrict(districtIdOrSlug: string) {
    if (!districtIdOrSlug) return null;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(districtIdOrSlug);
    if (isObjectId) {
      const d = await this.prisma.district.findUnique({ where: { id: districtIdOrSlug } });
      if (d) return d;
    }
    return this.prisma.district.findUnique({ where: { slug: districtIdOrSlug } });
  }

  async quote(buyerUserId: string, shopId: string, destinationDistrictId: string) {
    const priced = await this.priceCart(buyerUserId, shopId, destinationDistrictId);
    return {
      currency: 'BDT' as const,
      subtotalBdt: priced.subtotalBdt,
      deliveryFeeBdt: priced.deliveryFeeBdt,
      totalBdt: priced.totalBdt,
      sameCity: priced.sameCity,
      items: priced.orderItems,
    };
  }

  async createOrder(buyerUserId: string, dto: CreateOrderDto) {
    this.rejectClientAmount(dto);
    const method = dto.paymentMethod || 'cash_on_delivery';
    if (!PAYMENT_METHODS.has(method)) {
      throw new BadRequestException('Unknown payment method.');
    }

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

    const priced = await this.priceCart(buyerUserId, dto.shopId, dto.districtId);
    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerUserId },
      select: { email: true, displayName: true },
    });
    if (!buyer) throw new NotFoundException('Buyer not found.');

    const isGateway = method === 'online' || method === 'mobile_banking';
    const orderNumber = `ARN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const fullAddress = [
      dto.buyerName ? `প্রাপক: ${dto.buyerName}` : null,
      dto.shippingAddress,
      dto.upazila ? `উপজেলা: ${dto.upazila}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const stockLines = priced.orderItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
    await this.availability().reserveAll(stockLines);

    let order;
    try {
      order = await this.prisma.order.create({
      data: {
        orderNumber,
        buyerUserId,
        shopId: shop.id,
        sellerUserId: shop.ownerUserId,
        items: priced.orderItems,
        subtotalBdt: priced.subtotalBdt,
        deliveryFeeBdt: priced.deliveryFeeBdt,
        totalBdt: priced.totalBdt,
        shippingAddress: fullAddress,
        contactPhone: dto.contactPhone,
        districtId: district.id,
        paymentStatus: isGateway ? 'pending' : 'cash_on_delivery',
        paymentMethod: method,
        paymentTranId: isGateway ? this.payments.tranId() : null,
        notes: dto.notes,
      },
      include: {
        shop: { select: { id: true, name: true, phone: true } },
        district: true,
      },
    });
    } catch (error) {
      await this.availability().releaseAll(stockLines);
      throw error;
    }

    const cart = await this.prisma.cart.findUnique({ where: { userId: buyerUserId } });
    if (cart) {
      const remainingCartItems = cart.items.filter(
        (item) => !priced.itemsToRemoveFromCart.includes(item.productId),
      );
      await this.prisma.cart.update({
        where: { userId: buyerUserId },
        data: { items: remainingCartItems },
      });
    }

    if (!isGateway) {
      await this.notifications.notifyOrder({
        buyerUserId,
        sellerUserId: shop.ownerUserId,
        orderId: order.id,
        status: order.status,
      });
      return { ...order, gatewayUrl: null as string | null };
    }

    try {
      const gatewayUrl = await this.payments.openGateway({
        order,
        method: method as 'online' | 'mobile_banking',
        customerName: dto.buyerName || buyer.displayName || 'Aronno buyer',
        email: buyer.email,
        phone: dto.contactPhone,
        address: fullAddress,
        city: district.slug,
      });
      return { ...order, gatewayUrl };
    } catch (error) {
      await this.payments.markFailed(order.id, stockLines);
      throw error;
    }
  }

  private rejectClientAmount(dto: CreateOrderDto) {
    const extra = dto as CreateOrderDto & Record<string, unknown>;
    if (CLIENT_MONEY_FIELDS.some((field) => extra[field] !== undefined)) {
      throw new BadRequestException('The payable amount is calculated by the server.');
    }
  }

  private async priceCart(buyerUserId: string, shopId: string, destinationDistrictId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId: buyerUserId } });
    if (!cart || !cart.items.length) {
      throw new BadRequestException('Your cart is empty.');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: cart.items.map((item) => item.productId) }, shopId },
      include: { shop: { select: { isActive: true } } },
    });
    if (!products.length) {
      throw new BadRequestException('No items in cart belong to this shop.');
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const availability = this.availability();
    const orderItems: Array<{
      productId: string;
      productName: string;
      unit: (typeof products)[number]['unit'];
      pricePerUnit: number;
      quantity: number;
      totalPrice: number;
      imageUrl: string | null;
    }> = [];
    const itemsToRemoveFromCart: string[] = [];
    let subtotalBdt = 0;

    for (const item of cart.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      availability.ensurePurchasable(product, item.quantity);
      const totalPrice = availability.lineTotal(product.pricePerUnit, item.quantity);
      subtotalBdt += totalPrice;
      itemsToRemoveFromCart.push(item.productId);
      orderItems.push({
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        pricePerUnit: product.pricePerUnit,
        quantity: item.quantity,
        totalPrice,
        imageUrl: product.images[0]?.url ?? null,
      });
    }

    if (!orderItems.length) {
      throw new BadRequestException('No valid items found for checkout.');
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { districtId: true },
    });
    const destination = await this.resolveDistrict(destinationDistrictId);
    if (!shop || !destination) {
      throw new BadRequestException('Invalid district ID.');
    }
    const fee = await this.delivery.feeFor(shop.districtId, destination.id);
    return {
      orderItems,
      itemsToRemoveFromCart,
      subtotalBdt,
      deliveryFeeBdt: fee.deliveryFeeBdt,
      sameCity: fee.sameCity,
      totalBdt: subtotalBdt + fee.deliveryFeeBdt,
    };
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

  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shop: { select: { id: true, name: true, phone: true, logoUrl: true } },
        buyer: { select: { id: true, displayName: true, phone: true, avatarUrl: true } },
        district: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found.');
    if (order.buyerUserId !== userId && order.sellerUserId !== userId) {
      throw new ForbiddenException('You do not have access to view this order.');
    }

    return order;
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

    const gatewayUnpaid =
      order.paymentMethod !== 'cash_on_delivery' && order.paymentStatus !== 'paid';

    // Buyer can only cancel a pending order that has not already been paid online.
    if (isBuyer) {
      if (dto.status !== 'cancelled') {
        throw new ForbiddenException('Buyers can only cancel orders.');
      }
      if (order.status !== 'pending') {
        throw new BadRequestException('Buyers can only cancel orders that are still pending.');
      }
      if (order.paymentStatus === 'paid') {
        throw new BadRequestException('A paid online order cannot be cancelled here.');
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
      if (gatewayUnpaid && dto.status !== 'cancelled') {
        throw new BadRequestException('Wait until the online payment is verified.');
      }
    }

    const collectOnDelivery =
      dto.status === 'delivered' &&
      (order.paymentMethod === 'cash_on_delivery' || !order.paymentMethod);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: dto.status,
        ...(collectOnDelivery ? { paymentStatus: 'paid' as const } : {}),
        ...(dto.status === 'cancelled' && order.paymentStatus === 'pending'
          ? { paymentStatus: 'failed' as const }
          : {}),
      },
      include: {
        shop: true,
        district: true,
      },
    });

    await this.notifications.notifyOrder({
      buyerUserId: updated.buyerUserId,
      sellerUserId: updated.sellerUserId,
      orderId: updated.id,
      status: updated.status,
    });

    if (
      dto.status === 'cancelled' &&
      order.status !== 'cancelled' &&
      order.paymentStatus !== 'failed'
    ) {
      await this.availability().releaseAll(
        order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      );
    }

    return updated;
  }
}
