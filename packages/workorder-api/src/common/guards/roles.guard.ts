import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './jwt-auth.guard';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const userId = req.user?.sub;
    if (!userId) throw new ForbiddenException('未登录');

    // Dev static token / admin bypass
    if (userId === 'admin' || req.user?.name === 'API') return true;

    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const granted = new Set(
      roles.flatMap((ur) => {
        const p = ur.role.permissions;
        return Array.isArray(p) ? (p as string[]) : [];
      }),
    );
    // Wildcard
    if (granted.has('*') || granted.has('admin')) return true;
    const ok = required.every((perm) => granted.has(perm) || granted.has(perm.split(':')[0] + ':*'));
    if (!ok) throw new ForbiddenException('权限不足');
    return true;
  }
}
