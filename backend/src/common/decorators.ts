import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
}

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_PERMISSIONS = 'requiredPermissions';

/** Route is reachable without signing in (the user is still attached when a valid token is sent). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Every listed permission is required. */
export const Permissions = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => ctx.switchToHttp().getRequest().user,
);
