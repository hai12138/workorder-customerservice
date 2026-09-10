import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryRolesDto } from './dto/query-roles.dto';

export type RoleRecord = {
  id: string;
  code: string;
  name: string;
  scope: string;
  status: string;
  permissions: string[];
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryRolesDto, tenantId = 'default'): Promise<RoleRecord[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      scope: role.scope,
      status: role.status,
      permissions: asPermissionCodes(role.permissions),
    }));
  }
}

function asPermissionCodes(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}
