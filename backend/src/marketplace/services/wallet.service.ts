import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const CHANNELS = new Set(['bank', 'bkash', 'nagad']);
const PHONE = /^01[3-9]\d{8}$/;
const BANK_ACCOUNT = /^\d{8,20}$/;

type MoneyOrder = {
  status: string;
  paymentMethod: string | null;
  paymentStatus: string;
  totalBdt: number;
  subtotalBdt: number;
};

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const [spentOrders, earnedOrders, payouts, pendingSum, paidSum, shop] = await Promise.all([
      this.prisma.order.findMany({
        where: { buyerUserId: userId },
        select: {
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          totalBdt: true,
          subtotalBdt: true,
        },
      }),
      this.prisma.order.findMany({
        where: { sellerUserId: userId },
        select: {
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          totalBdt: true,
          subtotalBdt: true,
        },
      }),
      this.prisma.payout.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.payout.aggregate({
        where: { userId, status: 'pending' },
        _sum: { amountBdt: true },
      }),
      this.prisma.payout.aggregate({
        where: { userId, status: 'paid' },
        _sum: { amountBdt: true },
      }),
      this.prisma.shop.findUnique({
        where: { ownerUserId: userId },
        select: { id: true, name: true },
      }),
    ]);

    const spentBdt = spentOrders.filter(settled).reduce((sum, order) => sum + order.totalBdt, 0);
    const earnedBdt = earnedOrders.filter(settled).reduce((sum, order) => sum + order.subtotalBdt, 0);
    const reservedBdt = pendingSum._sum.amountBdt ?? 0;
    const paidOutBdt = paidSum._sum.amountBdt ?? 0;
    const availableBdt = Math.max(0, earnedBdt - reservedBdt - paidOutBdt);

    return {
      currency: 'BDT' as const,
      spentBdt,
      earnedBdt,
      reservedBdt,
      paidOutBdt,
      availableBdt,
      shop,
      payouts: payouts.map(presentPayout),
    };
  }

  async requestPayout(
    userId: string,
    input: {
      amountBdt: number;
      channel: string;
      accountName: string;
      accountNumber: string;
      bankName?: string;
    },
  ) {
    if (!CHANNELS.has(input.channel)) {
      throw new BadRequestException('উত্তোলনের মাধ্যম সমর্থিত নয়।');
    }
    if (!Number.isInteger(input.amountBdt) || input.amountBdt < 100) {
      throw new BadRequestException('কমপক্ষে ১০০ টাকা তুলতে পারবেন।');
    }
    const accountName = input.accountName.trim();
    const accountNumber = input.accountNumber.replace(/\s/g, '');
    const bankName = input.bankName?.trim() || null;
    if (accountName.length < 2 || accountName.length > 80) {
      throw new BadRequestException('অ্যাকাউন্টের নাম লিখুন।');
    }
    if (input.channel === 'bank') {
      if (!bankName || bankName.length < 2) {
        throw new BadRequestException('ব্যাংকের নাম লিখুন।');
      }
      if (!BANK_ACCOUNT.test(accountNumber)) {
        throw new BadRequestException('ব্যাংক অ্যাকাউন্ট নম্বর ৮ থেকে ২০ সংখ্যার হতে হবে।');
      }
    } else if (!PHONE.test(accountNumber)) {
      throw new BadRequestException('বিকাশ বা নগদ নম্বর ০১ দিয়ে শুরু হওয়া ১১ সংখ্যা হতে হবে।');
    }

    const shop = await this.prisma.shop.findUnique({ where: { ownerUserId: userId } });
    if (!shop) throw new BadRequestException('দোকান না থাকলে আয় তোলা যায় না।');

    const wallet = await this.summary(userId);
    if (input.amountBdt > wallet.availableBdt) {
      throw new BadRequestException('উত্তোলনের অঙ্ক আপনার আয়ের চেয়ে বেশি।');
    }

    const payout = await this.prisma.payout.create({
      data: {
        userId,
        shopId: shop.id,
        amountBdt: input.amountBdt,
        channel: input.channel,
        accountName,
        accountNumber,
        bankName,
        status: 'pending',
      },
    });
    return presentPayout(payout);
  }

  async listForAdmin() {
    const rows = await this.prisma.payout.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (!rows.length) return [];
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, email: true },
    });
    const shops = await this.prisma.shop.findMany({
      where: { id: { in: rows.map((row) => row.shopId) } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((user) => [user.id, user]));
    const shopMap = new Map(shops.map((shop) => [shop.id, shop]));
    return rows.map((row) => ({
      ...presentPayout(row),
      seller: userMap.get(row.userId) ?? null,
      shop: shopMap.get(row.shopId) ?? null,
    }));
  }

  async resolve(id: string, action: 'paid' | 'rejected') {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found.');
    if (payout.status !== 'pending') {
      throw new BadRequestException('This payout is already closed.');
    }
    return this.prisma.payout.update({
      where: { id },
      data: { status: action },
    });
  }
}

function settled(order: MoneyOrder) {
  if (order.status === 'cancelled') return false;
  const method = order.paymentMethod || 'cash_on_delivery';
  return method === 'cash_on_delivery' || order.paymentStatus === 'paid';
}

function presentPayout(row: {
  id: string;
  amountBdt: number;
  channel: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    amountBdt: row.amountBdt,
    channel: row.channel,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    bankName: row.bankName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
