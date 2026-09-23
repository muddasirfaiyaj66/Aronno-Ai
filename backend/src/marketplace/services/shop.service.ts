import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShopDto, UpdateShopDto } from '../dto/shop.dto';

@Injectable()
export class ShopService {
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

  async createShop(ownerUserId: string, dto: CreateShopDto) {
    const existing = await this.prisma.shop.findUnique({
      where: { ownerUserId },
    });
    if (existing) {
      throw new ConflictException('You already have a shop.');
    }

    const district = await this.resolveDistrict(dto.districtId);
    if (!district) {
      throw new BadRequestException('Invalid district ID.');
    }

    return this.prisma.shop.create({
      data: {
        ownerUserId,
        name: dto.name,
        description: dto.description,
        logoUrl: dto.logoUrl,
        bannerUrl: dto.bannerUrl,
        phone: dto.phone,
        districtId: district.id,
        upazila: dto.upazila,
        address: dto.address,
      },
      include: {
        district: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        },
      },
    });
  }

  async getShopByOwner(ownerUserId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerUserId },
      include: {
        district: true,
        _count: {
          select: { products: true, orders: true },
        },
      },
    });
    if (!shop) {
      return null;
    }
    return shop;
  }

  async getPublicShopById(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        district: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        products: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!shop || !shop.isActive) {
      throw new NotFoundException('Shop not found or inactive.');
    }
    return shop;
  }

  async updateShop(ownerUserId: string, dto: UpdateShopDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerUserId },
    });
    if (!shop) {
      throw new NotFoundException('Shop not found.');
    }

    let districtId = shop.districtId;
    if (dto.districtId) {
      const district = await this.resolveDistrict(dto.districtId);
      if (!district) {
        throw new BadRequestException('Invalid district ID.');
      }
      districtId = district.id;
    }

    return this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.districtId && { districtId }),
        ...(dto.upazila !== undefined && { upazila: dto.upazila }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        district: true,
      },
    });
  }
}
