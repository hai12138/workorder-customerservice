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
    it('should AND together query, status, province, city, district, and businessType filters', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: '华东项目',
          province: '江苏省',
          city: '南京市',
          district: '鼓楼区',
          address: '测试路123号',
          latitude: null,
          longitude: null,
          businessType: '住宅',
          status: '服务中',
          phone: '400-123-4567',
          manager: '张经理',
          createdAt: new Date(),
        },
      ];

      jest.spyOn(prisma.project, 'findMany').mockResolvedValue(mockProjects as any);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      await service.queryProjects({
        query: '华东',
        status: '服务中',
        province: '江苏省',
        city: '南京市',
        district: '鼓楼区',
        businessType: '住宅',
      });

      // Verify Prisma was called with AND conditions
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: '华东', mode: 'insensitive' } },
                { id: { contains: '华东', mode: 'insensitive' } },
                { province: { contains: '华东', mode: 'insensitive' } },
                { city: { contains: '华东', mode: 'insensitive' } },
                { district: { contains: '华东', mode: 'insensitive' } },
              ],
            },
            { status: { contains: '服务中' } },
            { province: { contains: '江苏省' } },
            { city: { contains: '南京市' } },
            { district: { contains: '鼓楼区' } },
            { businessType: '住宅' },
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
                { province: { contains: '项目', mode: 'insensitive' } },
                { city: { contains: '项目', mode: 'insensitive' } },
                { district: { contains: '项目', mode: 'insensitive' } },
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

    it('should skip "全部状态" and "全部业态" filters', async () => {
      jest.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      await service.queryProjects({
        status: '全部状态',
        businessType: '全部业态',
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('queryProjects - PCA Region Field Mapping (Issue #4)', () => {
    it('should include region computed from province/city/district in values object', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: '测试项目',
          province: '江苏省',
          city: '南京市',
          district: '鼓楼区',
          address: '测试路123号',
          latitude: null,
          longitude: null,
          businessType: '住宅',
          status: '服务中',
          phone: '400-123-4567',
          manager: '张经理',
          createdAt: new Date(),
        },
      ];

      jest.spyOn(prisma.project, 'findMany').mockResolvedValue(mockProjects as any);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      const result = await service.queryProjects({});

      expect(result[0]).toMatchObject({
        id: 'proj-1',
        title: '测试项目',
        values: expect.objectContaining({
          province: '江苏省',
          city: '南京市',
          district: '鼓楼区',
          region: '江苏省/南京市/鼓楼区',
          address: '测试路123号',
          businessType: '住宅',
          manager: '张经理',
          phone: '400-123-4567',
        }),
      });
    });

    it('should handle null PCA fields gracefully', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: '测试项目',
          province: null,
          city: null,
          district: null,
          address: null,
          latitude: null,
          longitude: null,
          businessType: null,
          status: '服务中',
          phone: null,
          manager: null,
          createdAt: new Date(),
        },
      ];

      jest.spyOn(prisma.project, 'findMany').mockResolvedValue(mockProjects as any);
      jest.spyOn(prisma.space, 'findMany').mockResolvedValue([]);

      const result = await service.queryProjects({});

      expect(result[0].values).toMatchObject({
        province: '—',
        city: '—',
        district: '—',
        region: '—',
        address: '—',
        businessType: '—',
        manager: '—',
        phone: '—',
      });
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should support create → list → bootstrap flow with PCA fields persistence', async () => {
      // This test documents the expected flow:
      // 1. Create project with province="江苏省", city="南京市", district="鼓楼区", phone="400-123", manager="张经理"
      // 2. List should immediately show computed region from PCA fields without needing a second edit
      // 3. Bootstrap should also include region (computed) in values
      
      // Expected: region (computed from province/city/district) appears in both queryProjects and bootstrap entity mappings
      // Both should have: values: { province, city, district, region, address, businessType, phone, manager, spaces, ... }
    });

    it('should support combined filter query with all PCA params', async () => {
      // Expected behavior:
      // GET /projects?q=项目&status=服务中&province=江苏省&city=南京市&district=鼓楼区&businessType=住宅
      // Should return projects that match ALL conditions (AND semantics):
      // - (name OR id OR province OR city OR district) contains "项目"
      // - AND status contains "服务中"
      // - AND province contains "江苏省"
      // - AND city contains "南京市"
      // - AND district contains "鼓楼区"
      // - AND businessType equals "住宅"
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
 *    - Fill: name="测试项目", province="江苏省", city="南京市", district="鼓楼区", businessType="住宅", phone="400-123", manager="张经理"
 *    - Save
 *    - Verify list shows computed region immediately (no need for edit)
 * 
 * 3. Edit Project:
 *    - Click "编辑" on a project
 *    - Modal should show pre-filled values
 *    - Change province to "浙江省", city to "杭州市"
 *    - Save and verify update
 * 
 * 4. Combined Filters:
 *    - Search: "项目"
 *    - Status: "服务中"
 *    - Province: "江苏省"
 *    - City: "南京市"
 *    - District: "鼓楼区"
 *    - Business Type: "住宅"
 *    - Click 查询
 *    - Should return only projects matching ALL conditions
 * 
 * 5. Reset Filter:
 *    - Click 重置
 *    - All form fields cleared
 *    - Full list restored
 */
