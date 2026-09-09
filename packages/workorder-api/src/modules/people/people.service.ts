import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { QueryPeopleDto } from './dto/query-people.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import {
  DEFAULT_EMPLOYEE_IDENTITY,
  EMPLOYEE_IDENTITIES,
  isEmployeeIdentity,
  USER_STATUS_ACTIVE,
  type UserStatusValue,
} from './people.constants';

export type PersonRecord = {
  id: string;
  name: string;
  phone: string | null;
  identity: string;
  status: string;
  teamName?: string;
  channel?: string;
  projectId?: string;
  projectName?: string;
};

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryPeopleDto): Promise<PersonRecord[]> {
    await this.requireProject(query.projectId);

    const q = query.q?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        identity: { in: [...EMPLOYEE_IDENTITIES] },
        memberships: { some: { projectId: query.projectId } },
        ...(query.status ? { status: query.status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { phone: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: this.personInclude(query.projectId),
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => this.toRecord(u, query.projectId));
  }

  async create(dto: CreatePersonDto): Promise<PersonRecord> {
    await this.requireProject(dto.projectId);
    const identity = dto.identity ?? DEFAULT_EMPLOYEE_IDENTITY;
    if (!isEmployeeIdentity(identity)) {
      throw new BadRequestException('身份必须是管理员、物管人员或员工');
    }

    const user = await this.prisma.user.create({
      data: {
        id: this.newUserId(),
        name: dto.name.trim(),
        phone: this.normalizePhone(dto.phone),
        identity,
        status: USER_STATUS_ACTIVE,
        memberships: { create: { projectId: dto.projectId } },
      },
      include: this.personInclude(dto.projectId),
    });

    return this.toRecord(user, dto.projectId);
  }

  async update(id: string, dto: UpdatePersonDto, projectId?: string): Promise<PersonRecord> {
    const existing = await this.requireEmployee(id);
    if (dto.identity && !isEmployeeIdentity(dto.identity)) {
      throw new BadRequestException('身份必须是管理员、物管人员或员工');
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

    return this.toRecord(updated, pid);
  }

  async setStatus(id: string, status: UserStatusValue): Promise<PersonRecord> {
    return this.update(id, { status });
  }

  private async requireProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('项目不存在');
    return project;
  }

  private async requireEmployee(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: { include: { project: true } },
        teamMembers: { include: { team: true } },
        channelBindings: true,
      },
    });
    if (!user || !isEmployeeIdentity(user.identity)) {
      throw new NotFoundException('员工不存在');
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
    } as const;
  }

  private toRecord(
    user: {
      id: string;
      name: string;
      phone: string | null;
      identity: string;
      status: string;
      memberships: Array<{ projectId: string; project: { name: string } }>;
      teamMembers: Array<{ team: { name: string; projectId: string } }>;
      channelBindings?: Array<unknown>;
    },
    projectId?: string,
  ): PersonRecord {
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
      teamName: team?.team.name ?? '—',
      channel: user.channelBindings?.length ? '已绑定' : '未绑定',
      projectId: mem?.projectId ?? projectId ?? '',
      projectName: mem?.project.name ?? '—',
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
