import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { QueryPeopleDto } from './dto/query-people.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import {
  DEFAULT_PEOPLE_SCOPE,
  defaultIdentityForScope,
  identitiesForScope,
  scopeOfIdentity,
  USER_STATUS_ACTIVE,
  type PeopleScope,
  type UserStatusValue,
} from './people.constants';

type PersonInclude = {
  id: string;
  name: string;
  phone: string | null;
  identity: string;
  status: string;
  createdAt: Date;
  memberships: Array<{ projectId: string; project: { name: string } }>;
  teamMembers: Array<{ team: { name: string; projectId: string } }>;
  roles: Array<{ role: { name: string } }>;
  channelBindings?: Array<unknown>;
};

export type StaffPersonRecord = {
  id: string;
  name: string;
  phone: string | null;
  identity: string;
  status: string;
  employeeNo: string;
  teamName: string | null;
  roleName: string | null;
  onlineStatus: null;
  channel: string;
  projectId: string;
  projectName: string;
};

export type UserPersonRecord = {
  id: string;
  name: string;
  phone: string | null;
  identity: string;
  status: string;
  spaceLabel: null;
  relationStatus: null;
  relationSource: null;
  updatedAt: string;
  projectId: string;
};

export type PersonRecord = StaffPersonRecord | UserPersonRecord;

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryPeopleDto): Promise<PersonRecord[]> {
    await this.requireProject(query.projectId);
    const scope = query.scope ?? DEFAULT_PEOPLE_SCOPE;
    const allowed = identitiesForScope(scope);
    const identity = query.identity?.trim();
    if (identity && !(allowed as readonly string[]).includes(identity)) {
      return [];
    }

    const q = query.q?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        identity: identity ?? { in: [...allowed] },
        memberships: { some: { projectId: query.projectId } },
        ...(query.status ? { status: query.status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { phone: { contains: q, mode: 'insensitive' as const } },
                ...(scope === 'staff'
                  ? [{ id: { contains: q, mode: 'insensitive' as const } }]
                  : []),
              ],
            }
          : {}),
      },
      include: this.personInclude(query.projectId),
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => this.toRecord(u, scope, query.projectId));
  }

  async create(dto: CreatePersonDto): Promise<PersonRecord> {
    await this.requireProject(dto.projectId);
    const scope = dto.scope ?? DEFAULT_PEOPLE_SCOPE;
    const identity = dto.identity ?? defaultIdentityForScope(scope);
    if (!(identitiesForScope(scope) as readonly string[]).includes(identity)) {
      throw new BadRequestException(
        scope === 'staff' ? '身份必须是管理员、物管人员或员工' : '身份必须是业主、租户、家属或类型未设置',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        id: this.newUserId(),
        name: dto.name.trim(),
        phone: this.normalizePhone(dto.phone),
        identity,
        status: dto.status ?? USER_STATUS_ACTIVE,
        memberships: { create: { projectId: dto.projectId } },
      },
      include: this.personInclude(dto.projectId),
    });

    return this.toRecord(user, scope, dto.projectId);
  }

  async update(id: string, dto: UpdatePersonDto, projectId?: string): Promise<PersonRecord> {
    const existing = await this.requirePerson(id);
    const scope = scopeOfIdentity(existing.identity);
    if (!scope) {
      throw new NotFoundException('用户不存在');
    }
    if (dto.identity && !(identitiesForScope(scope) as readonly string[]).includes(dto.identity)) {
      throw new BadRequestException(
        scope === 'staff' ? '身份必须是管理员、物管人员或员工' : '身份必须是业主、租户、家属或类型未设置',
      );
    }
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('姓名不能为空');
    }

    const pid = projectId ?? existing.memberships[0]?.projectId;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: this.normalizePhone(dto.phone) } : {}),
        ...(dto.identity !== undefined ? { identity: dto.identity } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: this.personInclude(pid),
    });

    return this.toRecord(updated, scope, pid);
  }

  async setStatus(id: string, status: UserStatusValue): Promise<PersonRecord> {
    return this.update(id, { status });
  }

  private async requireProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('项目不存在');
    return project;
  }

  private async requirePerson(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: { include: { project: true } },
        teamMembers: { include: { team: true } },
        channelBindings: true,
        roles: { include: { role: true } },
      },
    });
    if (!user || !scopeOfIdentity(user.identity)) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  private personInclude(projectId?: string) {
    return {
      memberships: {
        ...(projectId ? { where: { projectId } } : {}),
        include: { project: true },
      },
      teamMembers: { include: { team: true } },
      channelBindings: true,
      roles: { include: { role: true } },
    } as const;
  }

  private toRecord(user: PersonInclude, scope: PeopleScope, projectId?: string): PersonRecord {
    return scope === 'staff' ? this.toStaffRecord(user, projectId) : this.toUserRecord(user, projectId);
  }

  private toStaffRecord(user: PersonInclude, projectId?: string): StaffPersonRecord {
    const mem =
      (projectId ? user.memberships.find((m) => m.projectId === projectId) : undefined) ??
      user.memberships[0];
    const team =
      (projectId
        ? user.teamMembers.find((tm) => tm.team.projectId === projectId)
        : undefined) ?? user.teamMembers[0];
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      identity: user.identity,
      status: user.status,
      employeeNo: user.id,
      teamName: team?.team.name ?? null,
      roleName: user.roles[0]?.role.name ?? null,
      onlineStatus: null,
      channel: user.channelBindings?.length ? '已绑定' : '未绑定',
      projectId: mem?.projectId ?? projectId ?? '',
      projectName: mem?.project.name ?? '—',
    };
  }

  private toUserRecord(user: PersonInclude, projectId?: string): UserPersonRecord {
    const mem =
      (projectId ? user.memberships.find((m) => m.projectId === projectId) : undefined) ??
      user.memberships[0];
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      identity: user.identity,
      status: user.status,
      spaceLabel: null,
      relationStatus: null,
      relationSource: null,
      updatedAt: user.createdAt.toISOString(),
      projectId: mem?.projectId ?? projectId ?? '',
    };
  }

  private normalizePhone(phone?: string | null) {
    const value = phone?.trim();
    return value ? value : null;
  }

  private newUserId() {
    return `user_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}
