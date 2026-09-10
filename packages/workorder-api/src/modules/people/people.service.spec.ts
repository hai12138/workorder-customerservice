import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { vi } from 'vitest';
import { PeopleService } from './people.service';
import {
  EMPLOYEE_IDENTITIES,
  importHeadersForScope,
  isEmployeeIdentity,
  isUserIdentity,
  USER_IDENTITIES,
  USER_STATUS_ACTIVE,
  USER_STATUS_DISABLED,
} from './people.constants';

describe('PeopleService', () => {
  let service: PeopleService;
  let prisma: {
    project: { findUnique: ReturnType<typeof vi.fn> };
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    space: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  const project = { id: 'prj_xinglan', name: '星澜花园' };
  const createdAt = new Date('2026-01-15T08:00:00.000Z');
  const staffUser = {
    id: 'zhaoqing',
    name: '赵晴',
    phone: '13800000021',
    identity: '物管人员',
    status: '有效',
    createdAt,
    memberships: [{ projectId: project.id, preferredSpaceId: null, project }],
    teamMembers: [{ team: { name: '工程维修一组', projectId: project.id } }],
    roles: [{ role: { name: '物业客服' } }],
    channelBindings: [],
  };
  const ownerUser = {
    id: 'linyue',
    name: '林悦',
    phone: '138001381208',
    identity: '业主',
    status: '有效',
    createdAt,
    memberships: [{ projectId: project.id, preferredSpaceId: null, project }],
    teamMembers: [],
    roles: [],
    channelBindings: [],
  };

  beforeEach(() => {
    prisma = {
      project: { findUnique: vi.fn() },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      space: { findUnique: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    prisma.space.findMany.mockResolvedValue([]);
    prisma.space.findUnique.mockResolvedValue(null);
    service = new PeopleService(prisma as never);
  });

  function excelFile(rows: unknown[][]): Express.Multer.File {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'People');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return { buffer, originalname: 'people.xlsx' } as Express.Multer.File;
  }

  describe('identity口径', () => {
    it('staff 含管理员/物管人员/员工，users 含业主/租户/家属/类型未设置', () => {
      expect(EMPLOYEE_IDENTITIES).toEqual(['管理员', '物管人员', '员工']);
      expect(USER_IDENTITIES).toEqual(['业主', '租户', '家属', '类型未设置']);
      expect(isEmployeeIdentity('管理员')).toBe(true);
      expect(isEmployeeIdentity('物管人员')).toBe(true);
      expect(isEmployeeIdentity('员工')).toBe(true);
      expect(isEmployeeIdentity('业主')).toBe(false);
      expect(isUserIdentity('业主')).toBe(true);
      expect(isUserIdentity('租户')).toBe(true);
      expect(isUserIdentity('家属')).toBe(true);
      expect(isUserIdentity('类型未设置')).toBe(true);
      expect(isUserIdentity('物管人员')).toBe(false);
    });
  });

  describe('list', () => {
    it('默认 scope=staff：按 project membership + 员工 identity，q 可匹配 id/employeeNo', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.findMany.mockResolvedValue([staffUser]);

      const result = await service.list({ projectId: project.id, status: '有效', q: '赵' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            identity: { in: ['管理员', '物管人员', '员工'] },
            memberships: { some: { projectId: project.id } },
            status: '有效',
            OR: [
              { name: { contains: '赵', mode: 'insensitive' } },
              { phone: { contains: '赵', mode: 'insensitive' } },
              { id: { contains: '赵', mode: 'insensitive' } },
            ],
          },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'zhaoqing',
        name: '赵晴',
        phone: '13800000021',
        identity: '物管人员',
        status: '有效',
        employeeNo: 'zhaoqing',
        teamName: '工程维修一组',
        roleName: '物业客服',
        onlineStatus: null,
        channel: '未绑定',
        projectId: project.id,
        projectName: '星澜花园',
      });
    });

    it('scope=users：只返 users identities，q 仅姓名/手机，键含 space/关系/updatedAt', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.findMany.mockResolvedValue([ownerUser]);

      const result = await service.list({
        projectId: project.id,
        scope: 'users',
        q: '林',
        identity: '业主',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            identity: '业主',
            memberships: { some: { projectId: project.id } },
            OR: [
              { name: { contains: '林', mode: 'insensitive' } },
              { phone: { contains: '林', mode: 'insensitive' } },
            ],
          },
        }),
      );
      expect(result[0]).toEqual({
        id: 'linyue',
        name: '林悦',
        phone: '138001381208',
        identity: '业主',
        status: '有效',
        spaceId: null,
        spaceLabel: null,
        spacePath: null,
        relationStatus: null,
        relationSource: null,
        updatedAt: '2026-01-15T08:00:00.000Z',
        projectId: project.id,
      });
    });

    it('scope=users：绑定常用空间时 spaceLabel=节点名、spacePath=父/子', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.space.findMany.mockResolvedValue([
        { id: 'sp_bld_1', name: '1栋', parentId: null },
        { id: 'sp_room_1702', name: '1702', parentId: 'sp_bld_1' },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          ...ownerUser,
          memberships: [{ projectId: project.id, preferredSpaceId: 'sp_room_1702', project }],
        },
      ]);

      const result = await service.list({ projectId: project.id, scope: 'users' });

      expect(result[0]).toMatchObject({
        id: 'linyue',
        spaceId: 'sp_room_1702',
        spaceLabel: '1702',
        spacePath: '1栋/1702',
      });
    });

    it('scope=staff 且 identity=业主 时返回空（不跨 scope）', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      const result = await service.list({ projectId: project.id, scope: 'staff', identity: '业主' });
      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('项目不存在时抛出 404', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.list({ projectId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('默认 scope=staff：identity=物管人员、status=有效，并写入 ProjectMember', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.create.mockResolvedValue({
        ...staffUser,
        id: 'user_new',
        name: '新员工',
        phone: '13900001111',
        identity: '物管人员',
        status: USER_STATUS_ACTIVE,
        roles: [],
        teamMembers: [],
      });

      const created = await service.create({ projectId: project.id, name: '新员工', phone: '13900001111' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '新员工',
            phone: '13900001111',
            identity: '物管人员',
            status: '有效',
            memberships: { create: { projectId: project.id } },
          }),
        }),
      );
      expect(created.identity).toBe('物管人员');
      expect(created.status).toBe('有效');
      expect(created).toMatchObject({ employeeNo: 'user_new', onlineStatus: null });
    });

    it('scope=users：默认 identity=业主，并写入 ProjectMember', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.create.mockResolvedValue({
        ...ownerUser,
        id: 'user_owner',
        name: '新业主',
        phone: '13900003333',
        identity: '业主',
        status: USER_STATUS_ACTIVE,
      });

      const created = await service.create({
        scope: 'users',
        projectId: project.id,
        name: '新业主',
        phone: '13900003333',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            identity: '业主',
            status: '有效',
            memberships: { create: { projectId: project.id } },
          }),
        }),
      );
      expect(created).toMatchObject({
        identity: '业主',
        spaceId: null,
        spaceLabel: null,
        spacePath: null,
        relationStatus: null,
        relationSource: null,
        updatedAt: '2026-01-15T08:00:00.000Z',
      });
    });

    it('scope=users：合法 spaceId 写入 membership.preferredSpaceId 并回显路径', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.space.findUnique.mockResolvedValue({
        id: 'sp_bld_1',
        projectId: project.id,
        name: '1栋',
        parentId: null,
      });
      prisma.space.findMany.mockResolvedValue([{ id: 'sp_bld_1', name: '1栋', parentId: null }]);
      prisma.user.create.mockResolvedValue({
        ...ownerUser,
        id: 'user_owner',
        name: '新业主',
        memberships: [{ projectId: project.id, preferredSpaceId: 'sp_bld_1', project }],
      });

      const created = await service.create({
        scope: 'users',
        projectId: project.id,
        name: '新业主',
        spaceId: 'sp_bld_1',
      });

      expect(prisma.space.findUnique).toHaveBeenCalledWith({ where: { id: 'sp_bld_1' } });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberships: { create: { projectId: project.id, preferredSpaceId: 'sp_bld_1' } },
          }),
        }),
      );
      expect(created).toMatchObject({
        spaceId: 'sp_bld_1',
        spaceLabel: '1栋',
        spacePath: '1栋',
      });
    });

    it('scope=users：spaceId 不存在或跨项目时 400 且不写入', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.space.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ scope: 'users', projectId: project.id, name: '新业主', spaceId: 'missing' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();

      prisma.space.findUnique.mockResolvedValue({
        id: 'sp_yunqi',
        projectId: 'prj_yunqi',
        name: 'A座',
        parentId: null,
      });
      await expect(
        service.create({ scope: 'users', projectId: project.id, name: '新业主', spaceId: 'sp_yunqi' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('staff 忽略 spaceId，不校验、不写入 preferredSpaceId', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.create.mockResolvedValue({
        ...staffUser,
        id: 'user_new',
        name: '新员工',
        roles: [],
        teamMembers: [],
      });

      await service.create({
        projectId: project.id,
        name: '新员工',
        spaceId: 'sp_bld_1',
      });

      expect(prisma.space.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberships: { create: { projectId: project.id } },
          }),
        }),
      );
    });

    it('默认 staff 拒绝业主 identity', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      await expect(
        service.create({ projectId: project.id, name: '假业主', identity: '业主' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('update / setStatus', () => {
    it('可改 staff name/phone/identity', async () => {
      prisma.user.findUnique.mockResolvedValue(staffUser);
      prisma.user.update.mockResolvedValue({
        ...staffUser,
        name: '赵晴改',
        phone: '13800000022',
        identity: '员工',
      });

      const updated = await service.update('zhaoqing', {
        name: '赵晴改',
        phone: '13800000022',
        identity: '员工',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'zhaoqing' },
          data: { name: '赵晴改', phone: '13800000022', identity: '员工' },
        }),
      );
      expect(updated.name).toBe('赵晴改');
      expect(updated.identity).toBe('员工');
    });

    it('启停只改 status=有效|停用', async () => {
      prisma.user.findUnique.mockResolvedValue(staffUser);
      prisma.user.update.mockResolvedValue({
        ...staffUser,
        status: USER_STATUS_DISABLED,
      });

      const disabled = await service.setStatus('zhaoqing', USER_STATUS_DISABLED);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: '停用' },
        }),
      );
      expect(disabled.status).toBe('停用');
    });

    it('业主可通过 PUT 改 name，但不能改成员工 identity', async () => {
      prisma.user.findUnique.mockResolvedValue(ownerUser);
      prisma.user.update.mockResolvedValue({ ...ownerUser, name: '林悦改' });

      const updated = await service.update('linyue', { name: '林悦改' });
      expect(updated.name).toBe('林悦改');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: '林悦改' },
        }),
      );

      await expect(service.update('linyue', { identity: '员工' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('users PUT 可改/清空 spaceId；省略则不改', async () => {
      prisma.user.findUnique.mockResolvedValue(ownerUser);
      prisma.space.findUnique.mockResolvedValue({
        id: 'sp_bld_2',
        projectId: project.id,
        name: '2栋',
        parentId: null,
      });
      prisma.space.findMany.mockResolvedValue([
        { id: 'sp_bld_1', name: '1栋', parentId: null },
        { id: 'sp_bld_2', name: '2栋', parentId: null },
      ]);
      prisma.user.update.mockResolvedValue({
        ...ownerUser,
        memberships: [{ projectId: project.id, preferredSpaceId: 'sp_bld_2', project }],
      });

      const changed = await service.update('linyue', { spaceId: 'sp_bld_2' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberships: {
              update: {
                where: { projectId_userId: { projectId: project.id, userId: 'linyue' } },
                data: { preferredSpaceId: 'sp_bld_2' },
              },
            },
          }),
        }),
      );
      expect(changed).toMatchObject({ spaceId: 'sp_bld_2', spaceLabel: '2栋', spacePath: '2栋' });

      prisma.user.update.mockResolvedValue({
        ...ownerUser,
        memberships: [{ projectId: project.id, preferredSpaceId: null, project }],
      });
      const cleared = await service.update('linyue', { spaceId: null });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberships: {
              update: {
                where: { projectId_userId: { projectId: project.id, userId: 'linyue' } },
                data: { preferredSpaceId: null },
              },
            },
          }),
        }),
      );
      expect(cleared).toMatchObject({ spaceId: null, spaceLabel: null, spacePath: null });
    });

    it('拒绝把 staff identity 改成业主', async () => {
      prisma.user.findUnique.mockResolvedValue(staffUser);
      await expect(service.update('zhaoqing', { identity: '业主' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('template / import', () => {
    it('staff 模板列为姓名/手机/身份/状态', async () => {
      const buffer = await service.generateTemplate('staff');
      const sheet = XLSX.read(buffer, { type: 'buffer' }).Sheets.Staff;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      expect(rows[1]).toEqual([...importHeadersForScope('staff')]);
      expect(rows[1]).toEqual(['姓名', '手机', '身份', '状态']);
    });

    it('users 模板列为姓名/手机/类型/状态', async () => {
      const buffer = await service.generateTemplate('users');
      const sheet = XLSX.read(buffer, { type: 'buffer' }).Sheets.Users;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      expect(rows[1]).toEqual(['姓名', '手机', '类型', '状态']);
    });

    it('staff 导入四列：身份=物管人员、空状态默认有效，并写 User + ProjectMember', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.create.mockResolvedValue({ id: 'user_imp' });

      const result = await service.importPeople(
        excelFile([
          ['姓名', '手机', '身份', '状态', '部门', '班组'],
          ['导入员工', '13900006666', '物管人员', ''],
        ]),
        project.id,
        'staff',
      );

      expect(result).toEqual({ success: true, imported: 1 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '导入员工',
            phone: '13900006666',
            identity: '物管人员',
            status: '有效',
            memberships: { create: { projectId: project.id } },
          }),
        }),
      );
    });

    it('users 导入四列：类型=业主、空状态默认有效，并写 ProjectMember', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.create.mockResolvedValue({ id: 'user_owner_imp' });

      const result = await service.importPeople(
        excelFile([
          ['姓名', '手机', '类型', '状态'],
          ['导入业主', '13900007777', '业主', ''],
        ]),
        project.id,
        'users',
      );

      expect(result.imported).toBe(1);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            identity: '业主',
            status: '有效',
            memberships: { create: { projectId: project.id } },
          }),
        }),
      );
    });

    it('姓名/手机/身份为空时按行失败且不写入', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      await expect(
        service.importPeople(
          excelFile([
            ['姓名', '手机', '身份', '状态'],
            ['', '13900008881', '员工', '有效'],
            ['有名无手机', '', '员工', '有效'],
            ['有名无身份', '13900008882', '', '有效'],
          ]),
          project.id,
          'staff',
        ),
      ).rejects.toMatchObject({
        response: {
          message: '数据验证失败',
          errors: [
            { row: 2, field: '姓名', message: '姓名不能为空' },
            { row: 3, field: '手机', message: '手机不能为空' },
            { row: 4, field: '身份', message: expect.stringContaining('不能为空') },
          ],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('跨 scope identity 整单失败且不写入', async () => {
      prisma.project.findUnique.mockResolvedValue(project);

      await expect(
        service.importPeople(
          excelFile([
            ['姓名', '手机', '身份', '状态'],
            ['合法员工', '13900008888', '员工', '有效'],
            ['假业主', '13900009999', '业主', '有效'],
          ]),
          project.id,
          'staff',
        ),
      ).rejects.toMatchObject({
        response: {
          message: '数据验证失败',
          errors: [{ row: 3, message: expect.stringContaining('staff') }],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('拒绝非 xlsx（不扩部门/班组/角色列）', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      await expect(
        service.importPeople(
          { buffer: Buffer.from('姓名,手机,身份,状态\n张三,139,员工,有效'), originalname: 'people.csv' } as Express.Multer.File,
          project.id,
          'staff',
        ),
      ).rejects.toMatchObject({ message: '仅支持 xlsx 文件' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
