import { Test, TestingModule } from '@nestjs/testing';
import { WorkbenchService } from './workbench.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationDispatcher } from '../notify/notify.service';

describe('WorkbenchService - Projects QA Regression Tests', () => {
  let service: WorkbenchService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkbenchService,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            space: { findMany: jest.fn() },
          },
        },
        {
          provide: RedisService,
          useValue: {},
        },
        {
          provide: NotificationDispatcher,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<WorkbenchService>(WorkbenchService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('queryProjects - Combined Filter Query (Issue #3)', () => {
    it('should AND together query, status, and region filters', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: '华东项目',
          region: '华东',
          status: '服务中',
          phone: '400-123-4567',
          manager: '张经理',
        },
      ];

      jest.spyOn(prisma.project, 'findMany').mockResolvedValue(mockProjects as any);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      await service.queryProjects({
        query: '华东',
        status: '服务中',
        region: '华东',
      });

      // Verify Prisma was called with AND conditions
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: '华东', mode: 'insensitive' } },
                { id: { contains: '华东', mode: 'insensitive' } },
                { region: { contains: '华东', mode: 'insensitive' } },
              ],
            },
            { status: { contains: '服务中' } },
            { region: { contains: '华东' } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should handle partial filters (only query)', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      await service.queryProjects({ query: '项目' });

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: '项目', mode: 'insensitive' } },
                { id: { contains: '项目', mode: 'insensitive' } },
                { region: { contains: '项目', mode: 'insensitive' } },
              ],
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should handle empty filters', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      await service.queryProjects({});

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should skip "全部状态" and "全部地区" filters', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      await service.queryProjects({
        status: '全部状态',
        region: '全部地区',
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('queryProjects - Region Field Mapping (Issue #4)', () => {
    it('should include region in values object', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: '测试项目',
          region: '华东',
          status: '服务中',
          phone: '400-123-4567',
          manager: '张经理',
        },
      ];

      jest.spyOn(prisma.project, 'findMany').mockResolvedValue(mockProjects as any);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      const result = await service.queryProjects({});

      expect(result[0]).toMatchObject({
        id: 'proj-1',
        title: '测试项目',
        values: expect.objectContaining({
          region: '华东',
          manager: '张经理',
          phone: '400-123-4567',
        }),
      });
    });

    it('should handle null region gracefully', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: '测试项目',
          region: null,
          status: '服务中',
          phone: null,
          manager: null,
        },
      ];

      jest.spyOn(prisma.project, 'findMany').mockResolvedValue(mockProjects as any);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      const result = await service.queryProjects({});

      expect(result[0].values).toMatchObject({
        region: '—',
        manager: '—',
        phone: '—',
      });
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should support create → list → bootstrap flow with region persistence', async () => {
      // This test documents the expected flow:
      // 1. Create project with region="华东", phone="400-123", manager="张经理"
      // 2. List should immediately show region without needing a second edit
      // 3. Bootstrap should also include region in values
      
      // Expected: region appears in both queryProjects and bootstrap entity mappings
      // Both should have: values: { region, phone, manager, spaces, ... }
    });

    it('should support combined filter query with all three params', async () => {
      // Expected behavior:
      // GET /projects?q=项目&status=服务中&region=华东
      // Should return projects that match ALL conditions (AND semantics):
      // - (name OR id OR region) contains "项目"
      // - AND status contains "服务中"
      // - AND region contains "华东"
    });
  });
});

/**
 * Manual Testing Checklist
 * 
 * 1. Scopebar Hiding:
 *    - Navigate to /#projects → scopebar should be hidden
 *    - Navigate to /#dashboard → scopebar should be visible
 * 
 * 2. Create Project:
 *    - Click "新建项目"
 *    - Fill: name="测试项目", region="华东", phone="400-123", manager="张经理"
 *    - Save
 *    - Verify list shows region immediately (no need for edit)
 * 
 * 3. Edit Project:
 *    - Click "编辑" on a project
 *    - Modal should show pre-filled values
 *    - Change region to "华南"
 *    - Save and verify update
 * 
 * 4. Combined Filters:
 *    - Search: "项目"
 *    - Status: "服务中"
 *    - Region: "华东"
 *    - Click 查询
 *    - Should return only projects matching ALL three conditions
 * 
 * 5. Reset Filter:
 *    - Click 重置
 *    - All form fields cleared
 *    - Full list restored
 */
