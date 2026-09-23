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
import { z } from 'zod';

const loanStatusSchema = z
  .object({
    status: z.enum(['pending', 'approved', 'repaying', 'rejected']),
  })
  .strict();
// users
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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

  @Get('loans')
  listLoans(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.admin.listLoans(cursor, Number(limit) || 50);
  }

  @Patch('loans/:id/status')
  patchLoan(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(loanStatusSchema))
    body: ReturnType<typeof loanStatusSchema.parse>,
  ) {
    return this.admin.patchLoanStatus(actor, id, body.status);
  }
}
