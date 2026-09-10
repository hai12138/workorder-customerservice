import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { ImportError, ImportResult } from './dto/import-people.dto';
import { QueryPeopleDto } from './dto/query-people.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import {
  DEFAULT_PEOPLE_SCOPE,
  defaultIdentityForScope,
  identitiesForScope,
  importHeadersForScope,
  importIdentityHeaderForScope,
  isPeopleScope,
  isUserStatus,
  PEOPLE_IMPORT_NAME_HEADER,
  PEOPLE_IMPORT_PHONE_HEADER,
  PEOPLE_IMPORT_STATUS_HEADER,
  scopeOfIdentity,
  USER_STATUS_ACTIVE,
  USER_STATUSES,
  type PeopleIdentity,
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

  async generateTemplate(scope: PeopleScope): Promise<Buffer> {
    this.requireScope(scope);
    const identities = identitiesForScope(scope);
    const defaultIdentity = defaultIdentityForScope(scope);
    const instructionRow = [
      '必填：姓名',
      '可选：手机',
      `可选：${identities.join('|')}（默认${defaultIdentity}）`,
      '可选：有效|停用（默认有效）',
    ];
    const headers = [...importHeadersForScope(scope)];
    const exampleRows =
      scope === 'staff'
        ? [
            ['张三', '13800000001', '物管人员', '有效'],
            ['李四', '13800000002', '管理员', '有效'],
            ['王五', '13800000003', '员工', '停用'],
          ]
        : [
            ['林悦', '13800000011', '业主', '有效'],
            ['赵六', '13800000012', '租户', '有效'],
            ['钱七', '13800000013', '家属', '有效'],
            ['孙八', '13800000014', '类型未设置', '停用'],
          ];

    const worksheet = XLSX.utils.aoa_to_sheet([instructionRow, headers, ...exampleRows]);
    worksheet['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 42 }, { wch: 22 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, scope === 'staff' ? 'Staff' : 'Users');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async importPeople(file: Express.Multer.File, projectId: string, scope: PeopleScope): Promise<ImportResult> {
    this.requireScope(scope);
    if (!file) {
      throw new BadRequestException('未上传文件');
    }
    await this.requireProject(projectId);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('无效的文件格式');
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    if (rows.length === 0) {
      throw new BadRequestException('文件为空');
    }

    let headerRowIndex = 0;
    let dataStartIndex = 1;
    const firstCell = rows[0]?.[0] != null ? String(rows[0][0]) : '';
    if (firstCell.includes('必填') || firstCell.includes('可选')) {
      headerRowIndex = 1;
      dataStartIndex = 2;
    }
    if (rows.length <= headerRowIndex) {
      throw new BadRequestException('文件格式错误：缺少表头行');
    }

    const headers = (rows[headerRowIndex] ?? []).map((h) => String(h ?? '').trim());
    const requiredHeaders = importHeadersForScope(scope);
    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        throw new BadRequestException(`缺少必需列: ${header}`);
      }
    }

    const headerIndexMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      headerIndexMap[header] = index;
    });

    const identityHeader = importIdentityHeaderForScope(scope);
    const allowedIdentities = identitiesForScope(scope);
    const dataRows = rows
      .slice(dataStartIndex)
      .filter((row) => Array.isArray(row) && row.some((cell) => cell !== undefined && cell !== ''));

    if (dataRows.length === 0) {
      throw new BadRequestException('没有数据行');
    }

    const errors: ImportError[] = [];
    const validRows: Array<{
      name: string;
      phone: string | null;
      identity: PeopleIdentity;
      status: UserStatusValue;
    }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + dataStartIndex + 1;
      const name = this.cellText(row[headerIndexMap[PEOPLE_IMPORT_NAME_HEADER]]);
      const phone = this.normalizePhone(this.cellText(row[headerIndexMap[PEOPLE_IMPORT_PHONE_HEADER]]));
      const identityRaw = this.cellText(row[headerIndexMap[identityHeader]]);
      const statusRaw = this.cellText(row[headerIndexMap[PEOPLE_IMPORT_STATUS_HEADER]]);

      if (!name) {
        errors.push({ row: rowNumber, field: PEOPLE_IMPORT_NAME_HEADER, message: '姓名不能为空' });
        continue;
      }

      const identity = identityRaw || defaultIdentityForScope(scope);
      if (!(allowedIdentities as readonly string[]).includes(identity)) {
        errors.push({
          row: rowNumber,
          field: identityHeader,
          message: `身份必须落在 ${scope} 范围：${allowedIdentities.join('、')}`,
        });
        continue;
      }

      const status = statusRaw || USER_STATUS_ACTIVE;
      if (!isUserStatus(status)) {
        errors.push({
          row: rowNumber,
          field: PEOPLE_IMPORT_STATUS_HEADER,
          message: `无效的状态: ${statusRaw}，必须是以下之一: ${USER_STATUSES.join(', ')}`,
        });
        continue;
      }

      validRows.push({
        name,
        phone,
        identity: identity as PeopleIdentity,
        status,
      });
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: '数据验证失败',
        errors,
      });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const validRow of validRows) {
          await tx.user.create({
            data: {
              id: this.newUserId(),
              name: validRow.name,
              phone: validRow.phone,
              identity: validRow.identity,
              status: validRow.status,
              memberships: { create: { projectId } },
            },
          });
        }
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('导入失败: ' + (error as Error).message);
    }

    return {
      success: true,
      imported: validRows.length,
    };
  }

  private requireScope(scope: string): asserts scope is PeopleScope {
    if (!isPeopleScope(scope)) {
      throw new BadRequestException('scope 必须是 staff 或 users');
    }
  }

  private cellText(value: unknown): string {
    if (value === undefined || value === null) return '';
    return String(value).trim();
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
