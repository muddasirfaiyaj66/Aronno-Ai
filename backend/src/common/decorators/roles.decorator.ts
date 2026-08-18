import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type RoleSlug = 'SUPERADMIN' | 'ADMIN' | 'USER';
export const Roles = (...roles: RoleSlug[]) => SetMetadata(ROLES_KEY, roles);
