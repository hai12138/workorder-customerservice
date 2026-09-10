import { vi } from 'vitest';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: { role: { findMany: ReturnType<typeof vi.fn> } };

  const admin = {
    id: 'role_admin',
    code: 'PROPERTY_ADMIN',
    name: '项目管理员',
    scope: '本项目',
    status: '启用',
    permissions: ['*'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const staff = {
    id: 'role_staff',
    code: 'PROPERTY_STAFF',
    name: '物业客服',
    scope: '本项目',
    status: '启用',
    permissions: ['order_workbench', 'workorder:assign'],
    createdAt: new Date('2026-01-01T00:00:01.000Z'),
  };
  const projectUser = {
    id: 'role_user',
    code: 'PROJECT_USER',
    name: '项目用户',
    scope: '本人数据',
    status: '启用',
    permissions: ['order_launch_view'],
    createdAt: new Date('2026-01-01T00:00:02.000Z'),
  };

  beforeEach(() => {
    prisma = { role: { findMany: vi.fn() } };
    service = new RolesService(prisma as never);
  });

  it('返回 Role.permissions 原数组（不是个数），含 seed 三角色字段', async () => {
    prisma.role.findMany.mockResolvedValue([admin, staff, projectUser]);

    const result = await service.list({});

    expect(prisma.role.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'default' },
      orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
    });
    expect(result).toEqual([
      {
        id: 'role_admin',
        code: 'PROPERTY_ADMIN',
        name: '项目管理员',
        scope: '本项目',
        status: '启用',
        permissions: ['*'],
      },
      {
        id: 'role_staff',
        code: 'PROPERTY_STAFF',
        name: '物业客服',
        scope: '本项目',
        status: '启用',
        permissions: ['order_workbench', 'workorder:assign'],
      },
      {
        id: 'role_user',
        code: 'PROJECT_USER',
        name: '项目用户',
        scope: '本人数据',
        status: '启用',
        permissions: ['order_launch_view'],
      },
    ]);
    expect(Array.isArray(result[0].permissions)).toBe(true);
    expect(result[0].permissions).toContain('*');
    expect(typeof result[0].permissions).not.toBe('number');
  });

  it('可选 status 精确过滤，并按 createdAt/code 排序', async () => {
    prisma.role.findMany.mockResolvedValue([admin]);

    const result = await service.list({ status: '启用' }, 'default');

    expect(prisma.role.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'default', status: '启用' },
      orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('PROPERTY_ADMIN');
  });

  it('permissions 非数组时回落为空数组', async () => {
    prisma.role.findMany.mockResolvedValue([{ ...admin, permissions: 12 }]);

    const result = await service.list({});

    expect(result[0].permissions).toEqual([]);
  });
});
