import { BadRequestException, NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';
import { PeopleService } from './people.service';
import {
  EMPLOYEE_IDENTITIES,
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
    memberships: [{ projectId: project.id, project }],
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
    memberships: [{ projectId: project.id, project }],
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
    };
    service = new PeopleService(prisma as never);
  });

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
        spaceLabel: null,
        relationStatus: null,
        relationSource: null,
        updatedAt: '2026-01-15T08:00:00.000Z',
        projectId: project.id,
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
        spaceLabel: null,
        relationStatus: null,
        relationSource: null,
        updatedAt: '2026-01-15T08:00:00.000Z',
      });
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

      await expect(service.update('linyue', { identity: '员工' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('拒绝把 staff identity 改成业主', async () => {
      prisma.user.findUnique.mockResolvedValue(staffUser);
      await expect(service.update('zhaoqing', { identity: '业主' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
