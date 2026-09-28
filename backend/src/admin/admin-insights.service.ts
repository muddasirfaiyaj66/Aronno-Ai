import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/errors';
import type { AuthUser } from '../auth/auth.types';

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

@Injectable()
export class AdminInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [userRows, diagnosisCount, shopCount, activeShopCount, productCount, activeProductCount, orders, openReports] =
      await Promise.all([
        this.prisma.user.findMany({
          take: 2000,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            isActive: true,
            emailVerifiedAt: true,
            role: { select: { slug: true, nameBn: true } },
            district: { select: { nameBn: true } },
          },
        }),
        this.prisma.diagnosis.count(),
        this.prisma.shop.count(),
        this.prisma.shop.count({ where: { isActive: true } }),
        this.prisma.product.count(),
        this.prisma.product.count({ where: { status: 'active' } }),
        this.prisma.order.findMany({
          take: 1000,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            shopId: true,
            totalBdt: true,
            status: true,
            createdAt: true,
            shop: { select: { name: true } },
          },
        }),
        this.prisma.sellerReport.count({ where: { status: 'open' } }),
      ]);

    const roleMap = new Map<string, number>();
    const districtMap = new Map<string, number>();
    let active = 0;
    let verified = 0;
    let farmers = 0;
    for (const user of userRows) {
      roleMap.set(user.role.nameBn, (roleMap.get(user.role.nameBn) ?? 0) + 1);
      if (user.role.slug === 'USER') farmers += 1;
      if (user.isActive) active += 1;
      if (user.emailVerifiedAt) verified += 1;
      const district = user.district?.nameBn ?? 'জেলা নেই';
      districtMap.set(district, (districtMap.get(district) ?? 0) + 1);
    }

    const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
      (typeof ORDER_STATUSES)[number],
      number
    >;
    const shopEarn = new Map<string, { name: string; orders: number; revenue: number }>();
    let revenue = 0;
    for (const order of orders) {
      byStatus[order.status] += 1;
      const earned = order.status === 'cancelled' ? 0 : order.totalBdt;
      revenue += earned;
      const row = shopEarn.get(order.shopId) ?? {
        name: order.shop.name,
        orders: 0,
        revenue: 0,
      };
      row.orders += 1;
      row.revenue += earned;
      shopEarn.set(order.shopId, row);
    }

    return {
      users: {
        total: userRows.length,
        active,
        inactive: userRows.length - active,
        farmers,
        verified,
        unverified: userRows.length - verified,
      },
      diagnoses: diagnosisCount,
      shops: { total: shopCount, active: activeShopCount },
      products: { total: productCount, active: activeProductCount },
      orders: {
        total: orders.length,
        revenue,
        byStatus,
      },
      reportsOpen: openReports,
      roleBreakdown: [...roleMap.entries()].map(([name, value]) => ({ name, value })),
      topDistricts: [...districtMap.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      weeklySignups: bucketWeeks(userRows.map((row) => ({ at: row.createdAt, amount: 1 }))),
      weeklySales: bucketWeeks(
        orders
          .filter((order) => order.status !== 'cancelled')
          .map((order) => ({ at: order.createdAt, amount: order.totalBdt })),
      ),
      topShops: [...shopEarn.entries()]
        .map(([id, row]) => ({ id, ...row }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
      recentOrders: orders.slice(0, 12).map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        shopName: order.shop.name,
        totalBdt: order.totalBdt,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }

  async commerce() {
    const [shops, orders] = await Promise.all([
      this.prisma.shop.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          owner: { select: { id: true, displayName: true, email: true, isActive: true } },
          district: { select: { nameBn: true } },
          orders: { select: { totalBdt: true, status: true } },
          _count: { select: { products: true } },
        },
      }),
      this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: {
          id: true,
          orderNumber: true,
          totalBdt: true,
          status: true,
          createdAt: true,
          shop: { select: { name: true } },
          buyer: { select: { displayName: true } },
        },
      }),
    ]);
    return {
      shops: shops.map((shop) => {
        const paid = shop.orders.filter((order) => order.status !== 'cancelled');
        return {
          id: shop.id,
          name: shop.name,
          phone: shop.phone,
          isActive: shop.isActive,
          district: shop.district.nameBn,
          ownerId: shop.owner.id,
          ownerName: shop.owner.displayName,
          ownerEmail: shop.owner.email,
          ownerActive: shop.owner.isActive,
          products: shop._count.products,
          orders: shop.orders.length,
          revenue: paid.reduce((sum, order) => sum + order.totalBdt, 0),
        };
      }),
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        shopName: order.shop.name,
        buyerName: order.buyer.displayName,
        totalBdt: order.totalBdt,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }

  async setShopActive(actor: AuthUser, shopId: string, isActive: boolean) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw Errors.notFound('দোকান পাওয়া যায়নি।');
    await this.prisma.shop.update({ where: { id: shopId }, data: { isActive } });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: isActive ? 'SHOP_REOPENED' : 'SHOP_HIDDEN',
        target: shopId,
      },
    });
    return { id: shopId, isActive };
  }

  async setProductStatus(actor: AuthUser, productId: string, status: 'active' | 'inactive') {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw Errors.notFound('পণ্য পাওয়া যায়নি।');
    await this.prisma.product.update({ where: { id: productId }, data: { status } });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: 'PRODUCT_STATUS',
        target: productId,
        metadata: { status },
      },
    });
    return { id: productId, status };
  }

  async listReports() {
    const rows = await this.prisma.sellerReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    if (rows.length === 0) return [];
    const shopIds = [...new Set(rows.map((row) => row.shopId))];
    const userIds = [...new Set(rows.flatMap((row) => [row.reporterUserId, row.sellerUserId]))];
    const [shops, users] = await Promise.all([
      this.prisma.shop.findMany({
        where: { id: { in: shopIds } },
        select: { id: true, name: true, isActive: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, email: true, isActive: true },
      }),
    ]);
    const shopById = new Map(shops.map((shop) => [shop.id, shop]));
    const userById = new Map(users.map((user) => [user.id, user]));
    return rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      details: row.details,
      status: row.status,
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      shop: shopById.get(row.shopId) ?? null,
      reporter: userById.get(row.reporterUserId) ?? null,
      seller: userById.get(row.sellerUserId) ?? null,
    }));
  }

  async resolveReport(
    actor: AuthUser,
    reportId: string,
    action: 'dismiss' | 'block_seller' | 'hide_shop',
  ) {
    const report = await this.prisma.sellerReport.findUnique({ where: { id: reportId } });
    if (!report) throw Errors.notFound('রিপোর্ট পাওয়া যায়নি।');
    if (action === 'block_seller') {
      const seller = await this.prisma.user.findUnique({
        where: { id: report.sellerUserId },
        include: { role: true },
      });
      if (seller?.role.slug === 'SUPERADMIN') throw Errors.forbidden();
      await this.prisma.user.update({
        where: { id: report.sellerUserId },
        data: { isActive: false },
      });
      await this.prisma.shop.update({
        where: { id: report.shopId },
        data: { isActive: false },
      });
    }
    if (action === 'hide_shop') {
      await this.prisma.shop.update({
        where: { id: report.shopId },
        data: { isActive: false },
      });
    }
    const updated = await this.prisma.sellerReport.update({
      where: { id: reportId },
      data: {
        status: action === 'dismiss' ? 'dismissed' : 'actioned',
        action,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: `REPORT_${action.toUpperCase()}`,
        target: reportId,
        metadata: { shopId: report.shopId, sellerUserId: report.sellerUserId },
      },
    });
    return { id: updated.id, status: updated.status, action: updated.action };
  }
}

function bucketWeeks(rows: { at: Date; amount: number }[]) {
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay() - (7 - index) * 7);
    return { start, label: `${start.getDate()}/${start.getMonth() + 1}`, count: 0, revenue: 0 };
  });
  for (const row of rows) {
    const bucket = weeks.find((week, index) => {
      const next = weeks[index + 1]?.start ?? new Date(week.start.getTime() + 7 * 86400000);
      return row.at >= week.start && row.at < next;
    });
    if (!bucket) continue;
    bucket.count += 1;
    bucket.revenue += row.amount;
  }
  return weeks.map(({ label, count, revenue }) => ({ label, count, revenue }));
}
