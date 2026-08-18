import { Controller, Get, Param, Query } from '@nestjs/common';
import { HistoryKind } from '@prisma/client';
import { HistoryService } from './history.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('kind') kind?: HistoryKind,
    @Query('userId') userId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.history.list(user, kind, userId, cursor, Number(limit) || 30);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.history.get(user, id);
  }
}
