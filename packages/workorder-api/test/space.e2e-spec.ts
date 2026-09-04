import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

const AUTH = 'Bearer dev-token-change-me';

describe('Space API (e2e)', () => {
  let app: INestApplication;
  let testProjectId: string;
  let createdSpaceIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    // Get test project
    const projectsResponse = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', AUTH);
    
    if (projectsResponse.body.data && projectsResponse.body.data.length > 0) {
      testProjectId = projectsResponse.body.data[0].id;
    }
  });

  afterAll(async () => {
    // Cleanup created spaces (children first)
    for (const id of createdSpaceIds.reverse()) {
      try {
        await request(app.getHttpServer())
          .delete(`/api/v1/spaces/${id}`)
          .set('Authorization', AUTH);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    await app.close();
  });

  describe('Enum Validation', () => {
    it('should accept valid type enum values', async () => {
      const validTypes = ['楼栋', '楼层', '房间', '公区', '车位'];
      
      for (const type of validTypes) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/spaces')
          .set('Authorization', AUTH)
          .send({
            projectId: testProjectId,
            name: `测试${type}`,
            type,
          })
          .expect(200);

        expect(response.body.code).toBe(0);
        expect(response.body.data.type).toBe(type);
        createdSpaceIds.push(response.body.data.id);
      }
    });

    it('should reject invalid type enum', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          name: '无效空间',
          type: '无效类型',
        })
        .expect(200);

      expect(response.body.code).toBeGreaterThan(0);
      expect(response.body.message).toContain('enum');
    });

    it('should accept valid status enum values', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          name: '停用楼栋',
          type: '楼栋',
          status: '停用',
        })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.status).toBe('停用');
      createdSpaceIds.push(response.body.data.id);
    });
  });

  describe('Parent Validation', () => {
    it('should allow root-level space (no parentId)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          name: 'Root楼栋',
          type: '楼栋',
        })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.parentId).toBeNull();
      createdSpaceIds.push(response.body.data.id);
    });

    it('should allow child with valid parent', async () => {
      const parentResponse = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          name: 'Parent楼栋',
          type: '楼栋',
        })
        .expect(200);

      const parentId = parentResponse.body.data.id;
      createdSpaceIds.push(parentId);

      const childResponse = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          parentId,
          name: '1层',
          type: '楼层',
        })
        .expect(200);

      expect(childResponse.body.code).toBe(0);
      expect(childResponse.body.data.parentId).toBe(parentId);
      createdSpaceIds.push(childResponse.body.data.id);
    });

    it('should reject non-existent parentId', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          parentId: 'non-existent-id',
          name: '无效子空间',
          type: '楼层',
        })
        .expect(200);

      expect(response.body.code).toBe(404);
      expect(response.body.message).toContain('父级空间不存在');
    });

    it('should reject self-reference in update', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          name: 'Self楼栋',
          type: '楼栋',
        })
        .expect(200);

      const spaceId = createResponse.body.data.id;
      createdSpaceIds.push(spaceId);

      const updateResponse = await request(app.getHttpServer())
        .put(`/api/v1/spaces/${spaceId}`)
        .set('Authorization', AUTH)
        .send({ parentId: spaceId })
        .expect(200);

      expect(updateResponse.body.code).toBe(400);
      expect(updateResponse.body.message).toContain('不能设置自己为父级');
    });

    it('should reject cycle creation', async () => {
      // Create A -> B
      const aResponse = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          name: 'Cycle-A',
          type: '楼栋',
        })
        .expect(200);

      const aId = aResponse.body.data.id;
      createdSpaceIds.push(aId);

      const bResponse = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          parentId: aId,
          name: 'Cycle-B',
          type: '楼层',
        })
        .expect(200);

      const bId = bResponse.body.data.id;
      createdSpaceIds.push(bId);

      // Try to set A's parent to B (creates cycle)
      const updateResponse = await request(app.getHttpServer())
        .put(`/api/v1/spaces/${aId}`)
        .set('Authorization', AUTH)
        .send({ parentId: bId })
        .expect(200);

      expect(updateResponse.body.code).toBe(400);
      expect(updateResponse.body.message).toContain('循环引用');
    });
  });

  describe('Delete with Children', () => {
    it('should delete space without children', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          name: 'Leaf楼栋',
          type: '楼栋',
        })
        .expect(200);

      const spaceId = createResponse.body.data.id;

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/v1/spaces/${spaceId}`)
        .set('Authorization', AUTH)
        .expect(200);

      expect(deleteResponse.body.code).toBe(0);
      expect(deleteResponse.body.data.id).toBe(spaceId);
    });

    it('should reject deletion of space with children', async () => {
      // Create parent with child
      const parentResponse = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          name: 'HasChild楼栋',
          type: '楼栋',
        })
        .expect(200);

      const parentId = parentResponse.body.data.id;
      createdSpaceIds.push(parentId);

      const childResponse = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          parentId,
          name: 'Child层',
          type: '楼层',
        })
        .expect(200);

      createdSpaceIds.push(childResponse.body.data.id);

      // Try to delete parent
      const deleteResponse = await request(app.getHttpServer())
        .delete(`/api/v1/spaces/${parentId}`)
        .set('Authorization', AUTH)
        .expect(200);

      expect(deleteResponse.body.code).toBe(400);
      expect(deleteResponse.body.message).toContain('存在子空间');
    });
  });

  describe('Tree Root = Project Name', () => {
    it('should return tree with project root node', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}&tree=true`)
        .set('Authorization', AUTH)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.id).toContain('project_');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('isRoot', true);
      expect(response.body.data).toHaveProperty('children');
      expect(Array.isArray(response.body.data.children)).toBe(true);
    });

    it('should return flat list without tree', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('id');
        expect(response.body.data[0]).toHaveProperty('name');
        expect(response.body.data[0]).toHaveProperty('type');
        expect(response.body.data[0]).toHaveProperty('status');
      }
    });
  });
});
