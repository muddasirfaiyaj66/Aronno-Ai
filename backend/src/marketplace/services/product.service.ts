import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import {
  CreateProductDto,
  FilterProductsDto,
  UpdateProductDto,
} from '../dto/product.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private async resolveDistrict(districtIdOrSlug: string) {
    if (!districtIdOrSlug) return null;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(districtIdOrSlug);
    if (isObjectId) {
      const d = await this.prisma.district.findUnique({ where: { id: districtIdOrSlug } });
      if (d) return d;
    }
    return this.prisma.district.findUnique({ where: { slug: districtIdOrSlug } });
  }

  async createProduct(sellerUserId: string, dto: CreateProductDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerUserId: sellerUserId },
    });
    if (!shop || !shop.isActive) {
      throw new ForbiddenException(
        'You must create an active shop before listing products for sale.',
      );
    }

    const district = await this.resolveDistrict(dto.districtId);
    if (!district) {
      throw new BadRequestException('Invalid district ID.');
    }

    if (dto.cropId) {
      const crop = await this.prisma.crop.findUnique({
        where: { id: dto.cropId },
      });
      if (!crop) {
        throw new BadRequestException('Invalid crop ID.');
      }
    }

    return this.prisma.product.create({
      data: {
        shopId: shop.id,
        sellerUserId,
        name: dto.name,
        category: dto.category,
        cropId: dto.cropId,
        description: dto.description,
        pricePerUnit: dto.pricePerUnit,
        unit: dto.unit,
        availableQuantity: dto.availableQuantity,
        minOrderQuantity: dto.minOrderQuantity ?? 1,
        images: dto.images ?? [],
        districtId: district.id,
        harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : null,
        grade: dto.grade,
        isOrganic: dto.isOrganic ?? false,
      },
      include: {
        shop: {
          select: { id: true, name: true, phone: true, logoUrl: true },
        },
        district: true,
        crop: true,
      },
    });
  }

  async getProductsBySeller(sellerUserId: string) {
    return this.prisma.product.findMany({
      where: { sellerUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { id: true, name: true, logoUrl: true } },
        district: true,
        crop: true,
      },
    });
  }

  async filterProducts(dto: FilterProductsDto) {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(50, Math.max(1, dto.limit ?? 20));
    const skip = (page - 1) * limit;

    // Resolve districtId — may be a slug or an ObjectId
    let resolvedDistrictId: string | undefined;
    if (dto.districtId) {
      const district = await this.resolveDistrict(dto.districtId);
      resolvedDistrictId = district?.id;
    }

    const where: Prisma.ProductWhereInput = {
      status: 'active',
      ...(dto.category && { category: dto.category }),
      ...(resolvedDistrictId && { districtId: resolvedDistrictId }),
      ...(dto.cropId && { cropId: dto.cropId }),
      ...(dto.shopId && { shopId: dto.shopId }),
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { description: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...(dto.minPrice !== undefined || dto.maxPrice !== undefined
        ? {
            pricePerUnit: {
              ...(dto.minPrice !== undefined && { gte: dto.minPrice }),
              ...(dto.maxPrice !== undefined && { lte: dto.maxPrice }),
            },
          }
        : {}),
    };

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (dto.sort === 'price_asc') orderBy = { pricePerUnit: 'asc' };
    if (dto.sort === 'price_desc') orderBy = { pricePerUnit: 'desc' };
    if (dto.sort === 'rating') orderBy = { avgRating: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          shop: {
            select: { id: true, name: true, logoUrl: true },
          },
          district: true,
          crop: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        shop: {
          include: {
            owner: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
        district: true,
        crop: true,
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }

  async updateProduct(sellerUserId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    if (product.sellerUserId !== sellerUserId) {
      throw new ForbiddenException('You do not have permission to edit this product.');
    }

    let districtId = product.districtId;
    if (dto.districtId) {
      const district = await this.resolveDistrict(dto.districtId);
      if (!district) throw new BadRequestException('Invalid district ID.');
      districtId = district.id;
    }

    // If new images array provided, find removed images and delete them from Cloudinary
    if (dto.images) {
      const newPublicIds = new Set(
        dto.images.map((img) => img.publicId).filter(Boolean),
      );
      for (const oldImg of product.images) {
        if (oldImg.publicId && !newPublicIds.has(oldImg.publicId)) {
          void this.storageService.deleteImage(oldImg.publicId);
        }
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.category && { category: dto.category }),
        ...(dto.cropId !== undefined && { cropId: dto.cropId }),
        ...(dto.description && { description: dto.description }),
        ...(dto.pricePerUnit !== undefined && { pricePerUnit: dto.pricePerUnit }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.availableQuantity !== undefined && { availableQuantity: dto.availableQuantity }),
        ...(dto.minOrderQuantity !== undefined && { minOrderQuantity: dto.minOrderQuantity }),
        ...(dto.images && { images: dto.images }),
        ...(dto.districtId && { districtId }),
        ...(dto.status && { status: dto.status }),
        ...(dto.harvestDate !== undefined && {
          harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : null,
        }),
        ...(dto.grade !== undefined && { grade: dto.grade }),
        ...(dto.isOrganic !== undefined && { isOrganic: dto.isOrganic }),
      },
      include: {
        shop: true,
        district: true,
        crop: true,
      },
    });
  }

  async deleteProduct(sellerUserId: string, id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    if (product.sellerUserId !== sellerUserId) {
      throw new ForbiddenException('You do not have permission to delete this product.');
    }

    // Clean up product images from Cloudinary
    for (const img of product.images) {
      if (img.publicId) {
        void this.storageService.deleteImage(img.publicId);
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }
}
