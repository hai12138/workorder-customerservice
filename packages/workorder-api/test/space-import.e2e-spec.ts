import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

const AUTH = 'Bearer dev-token-change-me';

describe('Space Import API (e2e)', () => {
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

    const projectsResponse = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', AUTH);
    
    if (projectsResponse.body.data && projectsResponse.body.data.length > 0) {
      testProjectId = projectsResponse.body.data[0].id;
    }
  });

  afterAll(async () => {
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

  function createExcelBuffer(data: any[][]): Buffer {
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Spaces');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  describe('Template Download', () => {
    it('should download Excel template', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/spaces/template')
        .set('Authorization', AUTH)
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheet');
      expect(response.headers['content-disposition']).toContain('space_template.xlsx');
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Valid Import', () => {
    it('should import valid spaces', async () => {
      const importData = [
        ['name', 'type', 'status', 'parentName'],
        ['Import测试A栋', '楼栋', '可用', ''],
        ['Import测试A栋1层', '楼层', '可用', 'Import测试A栋'],
        ['Import测试A栋101', '房间', '可用', 'Import测试A栋1层'],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.imported).toBe(3);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH);

      const imported = listResponse.body.data.filter((s: any) => 
        s.name.startsWith('Import测试')
      );
      expect(imported.length).toBe(3);

      imported.forEach((s: any) => createdSpaceIds.push(s.id));
    });

    it('should import with existing parent', async () => {
      const existingResponse = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Authorization', AUTH)
        .send({
          projectId: testProjectId,
          name: 'Existing楼栋',
          type: '楼栋',
        })
        .expect(200);

      createdSpaceIds.push(existingResponse.body.data.id);

      const importData = [
        ['name', 'type', 'status', 'parentName'],
        ['Existing2层', '楼层', '可用', 'Existing楼栋'],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.imported).toBe(1);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH);

      const imported = listResponse.body.data.find((s: any) => s.name === 'Existing2层');
      expect(imported).toBeDefined();
      expect(imported.parentId).toBe(existingResponse.body.data.id);
      createdSpaceIds.push(imported.id);
    });
  });

  describe('Invalid Enum Validation', () => {
    it('should reject invalid type enum with row number', async () => {
      const importData = [
        ['name', 'type', 'status', 'parentName'],
        ['ValidSpace', '楼栋', '可用', ''],
        ['InvalidSpace', '无效类型', '可用', ''],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBeGreaterThan(0);
      expect(response.body.message).toBeDefined();
      
      const errorDetail = response.body.message;
      if (typeof errorDetail === 'object' && errorDetail.errors) {
        expect(errorDetail.errors).toBeInstanceOf(Array);
        expect(errorDetail.errors.length).toBeGreaterThan(0);
        expect(errorDetail.errors[0].row).toBe(3);
        expect(errorDetail.errors[0].field).toBe('type');
        expect(errorDetail.errors[0].message).toContain('无效的类型');
      }

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH);

      const imported = listResponse.body.data.filter((s: any) => 
        s.name === 'ValidSpace' || s.name === 'InvalidSpace'
      );
      expect(imported.length).toBe(0);
    });

    it('should reject invalid status enum with row number', async () => {
      const importData = [
        ['name', 'type', 'status', 'parentName'],
        ['TestSpace', '楼栋', '无效状态', ''],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBeGreaterThan(0);
      
      const errorDetail = response.body.message;
      if (typeof errorDetail === 'object' && errorDetail.errors) {
        expect(errorDetail.errors[0].row).toBe(2);
        expect(errorDetail.errors[0].field).toBe('status');
        expect(errorDetail.errors[0].message).toContain('无效的状态');
      }
    });
  });

  describe('Missing Parent Validation', () => {
    it('should reject when parent does not exist with row number', async () => {
      const importData = [
        ['name', 'type', 'status', 'parentName'],
        ['ChildSpace', '楼层', '可用', 'NonExistentParent'],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBeGreaterThan(0);
      
      const errorDetail = response.body.message;
      if (typeof errorDetail === 'object' && errorDetail.errors) {
        expect(errorDetail.errors[0].row).toBe(2);
        expect(errorDetail.errors[0].field).toBe('parentName');
        expect(errorDetail.errors[0].message).toContain('父级空间不存在');
      }

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH);

      const imported = listResponse.body.data.filter((s: any) => s.name === 'ChildSpace');
      expect(imported.length).toBe(0);
    });
  });

  describe('All-or-Nothing Transaction', () => {
    it('should rollback all spaces when one row fails validation', async () => {
      const beforeResponse = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH);
      
      const beforeCount = beforeResponse.body.data.length;

      const importData = [
        ['name', 'type', 'status', 'parentName'],
        ['Transaction测试1', '楼栋', '可用', ''],
        ['Transaction测试2', '楼层', '可用', 'Transaction测试1'],
        ['Transaction测试3', '无效类型', '可用', ''],
        ['Transaction测试4', '房间', '可用', 'Transaction测试2'],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBeGreaterThan(0);
      
      const errorDetail = response.body.message;
      if (typeof errorDetail === 'object' && errorDetail.errors) {
        expect(errorDetail.errors[0].row).toBe(4);
      }

      const afterResponse = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH);
      
      const afterCount = afterResponse.body.data.length;
      expect(afterCount).toBe(beforeCount);

      const imported = afterResponse.body.data.filter((s: any) => 
        s.name.startsWith('Transaction测试')
      );
      expect(imported.length).toBe(0);
    });

    it('should rollback when parent not found during import', async () => {
      const beforeResponse = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH);
      
      const beforeCount = beforeResponse.body.data.length;

      const importData = [
        ['name', 'type', 'status', 'parentName'],
        ['Rollback测试1', '楼栋', '可用', ''],
        ['Rollback测试2', '楼层', '可用', 'MissingParent'],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBeGreaterThan(0);

      const afterResponse = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH);
      
      const afterCount = afterResponse.body.data.length;
      expect(afterCount).toBe(beforeCount);

      const imported = afterResponse.body.data.filter((s: any) => 
        s.name.startsWith('Rollback测试')
      );
      expect(imported.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should reject empty file', async () => {
      const importData = [
        ['name', 'type', 'status', 'parentName'],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBeGreaterThan(0);
      expect(response.body.message).toContain('没有数据行');
    });

    it('should reject missing required columns', async () => {
      const importData = [
        ['name', 'type'],
        ['TestSpace', '楼栋'],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBeGreaterThan(0);
      expect(response.body.message).toContain('缺少必需列');
    });

    it('should handle empty name field', async () => {
      const importData = [
        ['name', 'type', 'status', 'parentName'],
        ['', '楼栋', '可用', ''],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBeGreaterThan(0);
      
      const errorDetail = response.body.message;
      if (typeof errorDetail === 'object' && errorDetail.errors) {
        expect(errorDetail.errors[0].row).toBe(2);
        expect(errorDetail.errors[0].field).toBe('name');
        expect(errorDetail.errors[0].message).toContain('空间名称不能为空');
      }
    });

    it('should default status to available when not provided', async () => {
      const importData = [
        ['name', 'type', 'status', 'parentName'],
        ['DefaultStatus楼栋', '楼栋', '', ''],
      ];

      const buffer = createExcelBuffer(importData);

      const response = await request(app.getHttpServer())
        .post('/api/v1/spaces/import')
        .set('Authorization', AUTH)
        .field('projectId', testProjectId)
        .attach('file', buffer, 'test.xlsx')
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.success).toBe(true);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/spaces?projectId=${testProjectId}`)
        .set('Authorization', AUTH);

      const imported = listResponse.body.data.find((s: any) => s.name === 'DefaultStatus楼栋');
      expect(imported).toBeDefined();
      expect(imported.status).toBe('可用');
      createdSpaceIds.push(imported.id);
    });
  });
});
