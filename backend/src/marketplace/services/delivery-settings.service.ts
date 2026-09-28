import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const KEY = 'delivery';
const DEFAULT_SAME = 60;
const DEFAULT_OTHER = 120;
const MAX_FEE = 5_000;

@Injectable()
export class DeliverySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async current() {
    const existing = await this.prisma.deliveryRate.findUnique({ where: { key: KEY } });
    if (existing) return existing;
    return this.prisma.deliveryRate.create({
      data: { key: KEY, sameCityBdt: DEFAULT_SAME, otherCityBdt: DEFAULT_OTHER },
    });
  }

  async feeFor(shopDistrictId: string, destinationDistrictId: string) {
    const rates = await this.current();
    const sameCity = shopDistrictId === destinationDistrictId;
    return {
      sameCity,
      deliveryFeeBdt: sameCity ? rates.sameCityBdt : rates.otherCityBdt,
      sameCityBdt: rates.sameCityBdt,
      otherCityBdt: rates.otherCityBdt,
    };
  }

  async update(sameCityBdt: number, otherCityBdt: number) {
    if (!Number.isInteger(sameCityBdt) || !Number.isInteger(otherCityBdt)) {
      throw new BadRequestException('Delivery charges must be whole taka.');
    }
    if (
      sameCityBdt < 0 ||
      otherCityBdt < 0 ||
      sameCityBdt > MAX_FEE ||
      otherCityBdt > MAX_FEE
    ) {
      throw new BadRequestException('Delivery charges must be between 0 and 5000 taka.');
    }
    await this.current();
    return this.prisma.deliveryRate.update({
      where: { key: KEY },
      data: { sameCityBdt, otherCityBdt },
    });
  }
}
