import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('lookups')
@Public()
export class LookupsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('professions')
  professions() {
    return this.prisma.profession.findMany({ orderBy: { nameEn: 'asc' } });
  }

  @Get('districts')
  districts() {
    return this.prisma.district.findMany({ orderBy: { nameBn: 'asc' } });
  }

  @Get('crops')
  crops() {
    return this.prisma.crop.findMany({ orderBy: { slug: 'asc' } });
  }
}
