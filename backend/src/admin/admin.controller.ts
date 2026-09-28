import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import {
  createAdminSchema,
  patchActiveSchema,
  patchRoleSchema,
} from '../auth/auth.dto';
import type { AuthUser } from '../auth/auth.types';
import { AdminService } from './admin.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminInsightsService } from './admin-insights.service';
import { z } from 'zod';

const broadcastSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(600),
  priority: z.enum(['normal', 'important', 'emergency']),
  audience: z.enum(['all', 'user', 'district']),
  userId: z.string().trim().optional(),
  districtSlug: z.string().trim().optional(),
});

const reportActionSchema = z.object({
  action: z.enum(['dismiss', 'block_seller', 'hide_shop']),
});

const shopActiveSchema = z.object({ isActive: z.boolean() });
const productStatusSchema = z.object({ status: z.enum(['active', 'inactive']) });

@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly notifications: NotificationsService,
    private readonly insights: AdminInsightsService,
  ) {}

  @Get('overview')
  overview() {
    return this.insights.overview();
  }

  @Get('commerce')
  commerce() {
    return this.insights.commerce();
  }

  @Patch('shops/:id')
  setShop(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(shopActiveSchema)) body: z.infer<typeof shopActiveSchema>,
  ) {
    return this.insights.setShopActive(actor, id, body.isActive);
  }

  @Patch('products/:id')
  setProduct(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(productStatusSchema)) body: z.infer<typeof productStatusSchema>,
  ) {
    return this.insights.setProductStatus(actor, id, body.status);
  }

  @Get('reports')
  reports() {
    return this.insights.listReports();
  }

  @Post('reports/:id')
  resolveReport(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(reportActionSchema)) body: z.infer<typeof reportActionSchema>,
  ) {
    return this.insights.resolveReport(actor, id, body.action);
  }

  @Get('notifications/places')
  notificationPlaces() {
    return this.notifications.placeSuggestions();
  }

  @Get('notifications')
  listNotifications() {
    return this.notifications.listBroadcasts();
  }

  @Post('notifications')
  createNotification(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodPipe(broadcastSchema))
    body: z.infer<typeof broadcastSchema>,
  ) {
    return this.notifications.broadcast({
      actorId: actor.id,
      title: body.title,
      body: body.body,
      priority: body.priority,
      audience: body.audience,
      userId: body.userId,
      districtSlug: body.districtSlug,
    });
  }

  @Get('users')
  listUsers(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.admin.listUsers(cursor, Number(limit) || 20);
  }

  @Post('users')
  createAdmin(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodPipe(createAdminSchema))
    body: ReturnType<typeof createAdminSchema.parse>,
  ) {
    return this.admin.createAdmin(actor, body);
  }

  @Patch('users/:id/role')
  patchRole(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(patchRoleSchema))
    body: ReturnType<typeof patchRoleSchema.parse>,
  ) {
    return this.admin.patchRole(actor, id, body.roleSlug);
  }

  @Patch('users/:id/active')
  patchActive(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(patchActiveSchema))
    body: ReturnType<typeof patchActiveSchema.parse>,
  ) {
    return this.admin.patchActive(actor, id, body.isActive);
  }
}
