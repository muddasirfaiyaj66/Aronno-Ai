import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ProductAvailabilityService, type StockLine } from './product-availability.service';
import { SslCommerzService } from './sslcommerz.service';

type GatewayOrder = {
  id: string;
  orderNumber: string;
  buyerUserId: string;
  sellerUserId: string;
  totalBdt: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentTranId: string | null;
  status: string;
  items: { productId: string; productName: string; quantity: number }[];
};

const PAID_STATUSES = new Set(['VALID', 'VALIDATED']);

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ssl: SslCommerzService,
    private readonly notifications: NotificationsService,
  ) {}

  private availability(): ProductAvailabilityService {
    return ProductAvailabilityService.getInstance();
  }

  tranId(): string {
    return `ARN${Date.now().toString(36)}${randomBytes(3).toString('hex')}`.slice(0, 30);
  }

  async openGateway(input: {
    order: GatewayOrder;
    method: 'online' | 'mobile_banking';
    customerName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  }): Promise<string> {
    const gatewayUrl = await this.ssl.createSession({
      tranId: input.order.paymentTranId ?? '',
      totalBdt: input.order.totalBdt,
      method: input.method,
      orderId: input.order.id,
      customerName: input.customerName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      city: input.city,
      productName: input.order.items.map((item) => item.productName).join(', ') || 'Aronno order',
      itemCount: input.order.items.length,
    });
    return gatewayUrl;
  }

  async handleCallback(
    kind: 'success' | 'fail' | 'cancel' | 'ipn',
    payload: Record<string, unknown>,
  ): Promise<{ result: 'paid' | 'failed' | 'pending'; orderId: string | null }> {
    const tranId = stringField(payload, 'tran_id');
    const valId = stringField(payload, 'val_id');
    if (!tranId) return { result: 'failed', orderId: null };

    const order = await this.prisma.order.findFirst({ where: { paymentTranId: tranId } });
    if (!order || order.paymentMethod === 'cash_on_delivery') {
      return { result: 'failed', orderId: order?.id ?? null };
    }
    if (order.paymentStatus === 'paid') return { result: 'paid', orderId: order.id };

    if (kind === 'fail' || kind === 'cancel') {
      await this.markFailed(order.id, stockLines(order.items));
      return { result: 'failed', orderId: order.id };
    }
    if (!valId) return { result: 'pending', orderId: order.id };

    let validation;
    try {
      validation = await this.ssl.validate(valId);
    } catch (error) {
      this.logger.warn(`SSLCommerz validation failed for ${tranId}`);
      return { result: 'pending', orderId: order.id };
    }

    const amountMatches = Math.round(validation.amountBdt * 100) === order.totalBdt * 100;
    const trusted =
      PAID_STATUSES.has(validation.status) &&
      validation.tranId === order.paymentTranId &&
      validation.orderId === order.id &&
      validation.currency.toUpperCase() === 'BDT' &&
      amountMatches;

    if (!trusted) {
      this.logger.warn(`Rejected SSLCommerz result for ${tranId}: status ${validation.status}`);
      await this.markFailed(order.id, stockLines(order.items));
      return { result: 'failed', orderId: order.id };
    }

    const marked = await this.prisma.order.updateMany({
      where: { id: order.id, paymentStatus: 'pending' },
      data: {
        paymentStatus: 'paid',
        paymentValId: validation.valId,
        paymentGateway: validation.gateway,
        paidAt: new Date(),
      },
    });
    if (marked.count === 1) {
      await this.notifications.notifyOrder({
        buyerUserId: order.buyerUserId,
        sellerUserId: order.sellerUserId,
        orderId: order.id,
        status: 'paid',
      });
    }
    return { result: 'paid', orderId: order.id };
  }

  async markFailed(orderId: string, lines: StockLine[]): Promise<void> {
    const changed = await this.prisma.order.updateMany({
      where: { id: orderId, paymentStatus: 'pending', status: { not: 'cancelled' } },
      data: { paymentStatus: 'failed', status: 'cancelled' },
    });
    if (changed.count !== 1) return;
    await this.availability().releaseAll(lines);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { buyerUserId: true, sellerUserId: true },
    });
    if (!order) return;
    await this.notifications.notifyOrder({
      buyerUserId: order.buyerUserId,
      sellerUserId: order.sellerUserId,
      orderId,
      status: 'cancelled',
    });
  }
}

function stringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

function stockLines(items: { productId: string; quantity: number }[]): StockLine[] {
  return items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
}
