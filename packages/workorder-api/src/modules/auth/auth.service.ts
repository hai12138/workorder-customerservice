import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async login(userId: string, password?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } }, memberships: true },
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    // Dev seed users use passwordHash "dev"
    const expected = user.passwordHash || 'dev';
    if (!password || password !== expected) {
      throw new UnauthorizedException('账号或密码不正确');
    }
    const secret = this.config.get<string>('JWT_SECRET') ?? 'astra-dev-secret';
    const token = jwt.sign(
      { sub: user.id, name: user.name, tenantId: user.tenantId },
      secret,
      { expiresIn: '7d' },
    );
    const roleName = user.roles[0]?.role.name ?? user.identity;
    const permissions = user.roles.flatMap((ur) => {
      const p = ur.role.permissions;
      return Array.isArray(p) ? (p as string[]) : [];
    });
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        identity: user.identity,
        role: roleName,
        projectIds: user.memberships.map((m) => m.projectId),
        permissions,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } }, memberships: { include: { project: true } } },
    });
    if (!user) throw new BadRequestException('用户不存在');
    return {
      id: user.id,
      name: user.name,
      identity: user.identity,
      projects: user.memberships.map((m) => ({
        id: m.project.id,
        name: m.project.name,
        code: m.project.code,
      })),
      permissions: user.roles.flatMap((ur) => {
        const p = ur.role.permissions;
        return Array.isArray(p) ? (p as string[]) : [];
      }),
    };
  }
}
