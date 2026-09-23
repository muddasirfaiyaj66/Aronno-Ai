import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from '../dto/review.dto';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) throw new NotFoundException('Order not found.');

    if (order.buyerUserId !== userId) {
      throw new ForbiddenException('You can only review products from your own orders.');
    }

    if (order.status !== 'delivered') {
      throw new BadRequestException('You can only review products from delivered orders.');
    }

    const hasProduct = order.items.some((i) => i.productId === dto.productId);
    if (!hasProduct) {
      throw new BadRequestException('Product was not part of this order.');
    }

    const existing = await this.prisma.review.findUnique({
      where: {
        orderId_productId: {
          orderId: dto.orderId,
          productId: dto.productId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('You have already reviewed this product for this order.');
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        orderId: dto.orderId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Recalculate average rating & review count for product
    const stats = await this.prisma.review.aggregate({
      where: { productId: dto.productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.product.update({
      where: { id: dto.productId },
      data: {
        avgRating: Math.round((stats._avg.rating ?? 0) * 10) / 10,
        reviewCount: stats._count.rating ?? 0,
      },
    });

    return review;
  }

  async getProductReviews(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    });
  }
}
