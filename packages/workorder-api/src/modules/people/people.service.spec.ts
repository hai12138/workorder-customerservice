import { BadRequestException, NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';
import { PeopleService } from './people.service';
import {
  EMPLOYEE_IDENTITIES,
  isEmployeeIdentity,
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
  const staffUser = {
    id: 'zhaoqing',
    name: '赵晴',
    phone: '13800000021',
    identity: '物管人员',
    status: '有效',
    memberships: [{ projectId: project.id, project }],
    teamMembers: [{ team: { name: '工程维修一组', projectId: project.id } }],
  };
  const ownerUser = {
    id: 'linyue',
    name: '林悦',
    phone: '138001381208',
    identity: '业主',
    status: '有效',
    memberships: [{ projectId: project.id, project }],
    teamMembers: [],
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
    it('员工侧包含管理员/物管人员/员工，排除业主/租户', () => {
      expect(EMPLOYEE_IDENTITIES).toEqual(['管理员', '物管人员', '员工']);
      expect(isEmployeeIdentity('管理员')).toBe(true);
      expect(isEmployeeIdentity('物管人员')).toBe(true);
      expect(isEmployeeIdentity('员工')).toBe(true);
      expect(isEmployeeIdentity('业主')).toBe(false);
      expect(isEmployeeIdentity('租户')).toBe(false);
    });
  });

  describe('list', () => {
    it('按 project membership + 员工 identity 查询，并可叠加 status/q', async () => {
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
            ],
          },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'zhaoqing',
        name: '赵晴',
        phone: '13800000021',
        identity: '物管人员',
        status: '有效',
        teamName: '工程维修一组',
        channel: '未绑定',
        projectId: project.id,
      });
    });

    it('项目不存在时抛出 404', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.list({ projectId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('默认 identity=物管人员、status=有效，并写入 ProjectMember', async () => {
      prisma.project.findUnique.mockResolvedValue(project);
      prisma.user.create.mockResolvedValue({
        ...staffUser,
        id: 'user_new',
        name: '新员工',
        phone: '13900001111',
        identity: '物管人员',
        status: USER_STATUS_ACTIVE,
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
    });
  });

  describe('update / setStatus', () => {
    it('可改 name/phone/identity', async () => {
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

    it('C 端业主不可通过员工接口编辑', async () => {
      prisma.user.findUnique.mockResolvedValue(ownerUser);
      await expect(service.update('linyue', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('拒绝把 identity 改成业主', async () => {
      prisma.user.findUnique.mockResolvedValue(staffUser);
      await expect(service.update('zhaoqing', { identity: '业主' as never })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
