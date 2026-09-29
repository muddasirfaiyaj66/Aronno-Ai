import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { patchMeSchema, specialistDocsSchema } from '../auth/auth.dto';
import type { AuthUser } from '../auth/auth.types';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  @Patch('me')
  patchMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(patchMeSchema))
    body: ReturnType<typeof patchMeSchema.parse>,
  ) {
    return this.users.patchMe(user.id, body);
  }

  @Post('me/specialist-docs')
  submitSpecialistDocs(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(specialistDocsSchema))
    body: ReturnType<typeof specialistDocsSchema.parse>,
  ) {
    return this.users.submitSpecialistDocs(user.id, body);
  }
}
