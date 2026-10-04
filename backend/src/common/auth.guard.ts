import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Model } from 'mongoose';
import { config } from '../config.js';
import { Role, User } from '../schemas/index.js';
import { AuthUser, IS_PUBLIC, REQUIRED_PERMISSIONS } from './decorators.js';
import { hasPermission } from './permissions.js';

/**
 * Global guard. Resolves the user from the auth cookie (or a Bearer token),
 * loads the role's permissions fresh on every request so role edits apply
 * immediately, then enforces @Public / @Permissions metadata.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, targets) ?? [];

    req.user = (await this.resolveUser(req)) ?? undefined;
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Please sign in');

    const missing = required.filter((p) => !hasPermission(req.user!.permissions, p));
    if (missing.length) throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    return true;
  }

  private async resolveUser(req: Request): Promise<AuthUser | null> {
    const header = req.headers.authorization;
    const token =
      req.cookies?.[config.cookieName] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) return null;

    let sub: string;
    try {
      sub = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      return null;
    }
    const user = await this.users.findById(sub).lean();
    if (!user || !user.active) return null;
    return buildAuthUser(user, user.role ? await this.roles.findById(user.role).lean() : null);
  }
}

export function buildAuthUser(
  user: { _id: unknown; name: string; email: string },
  role: (Role & { _id: unknown }) | null,
): AuthUser {
  const liveRole = role && !role.deletedAt ? role : null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    roleId: liveRole ? String(liveRole._id) : null,
    roleName: liveRole?.name ?? null,
    permissions: liveRole?.permissions ?? [],
  };
}
