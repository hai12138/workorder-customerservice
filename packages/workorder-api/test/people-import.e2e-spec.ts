import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

const AUTH = 'Bearer dev-token-change-me';

describe('People Import API (e2e)', () => {
  let app: INestApplication;
  let projectId = 'prj_xinglan';

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

    const projects = await request(app.getHttpServer()).get('/api/v1/projects').set('Authorization', AUTH);
    if (projects.body.data?.[0]?.id) {
      projectId = projects.body.data[0].id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  function createExcelBuffer(data: unknown[][]): Buffer {
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'People');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  function downloadBinary(path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', AUTH)
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
  }

  function templateRows(buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
  }

  describe('Template Download', () => {
    it('GET /people/template?scope=staff 下载 xlsx', async () => {
      const response = await downloadBinary('/api/v1/people/template?scope=staff');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheet');
      expect(response.headers['content-disposition']).toContain('people_staff_template.xlsx');
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.subarray(0, 2).toString()).toBe('PK');

      const rows = templateRows(response.body);
      expect(rows[1]).toEqual(['姓名', '手机', '身份', '状态']);
    });

    it('GET /people/template?scope=users 下载 xlsx', async () => {
      const response = await downloadBinary('/api/v1/people/template?scope=users');
      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('people_users_template.xlsx');
      expect(response.body.subarray(0, 2).toString()).toBe('PK');
      const rows = templateRows(response.body);
      expect(rows[1]).toEqual(['姓名', '手机', '类型', '状态']);
    });

    it('GET /people/template 缺少 scope 失败', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/people/template')
        .set('Authorization', AUTH);

      expect(response.body.code).not.toBe(0);
    });
  });

  describe('Valid Import', () => {
    it('POST /people/import staff 合法行写入 User + ProjectMember，默认物管人员/有效', async () => {
      const stamp = Date.now().toString(36);
      const name = `ImportE2E员工${stamp}`;
      const buffer = createExcelBuffer([
        ['姓名', '手机', '身份', '状态'],
        [name, '13900006111', '', ''],
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/v1/people/import')
        .set('Authorization', AUTH)
        .field('projectId', projectId)
        .field('scope', 'staff')
        .attach('file', buffer, 'staff.xlsx');

      expect(response.status).toBeLessThan(300);
      expect(response.body.code).toBe(0);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.imported).toBe(1);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/people?projectId=${projectId}&scope=staff&q=${encodeURIComponent(name)}`)
        .set('Authorization', AUTH);

      const imported = list.body.data.find((p: { name: string }) => p.name === name);
      expect(imported).toBeDefined();
      expect(imported.identity).toBe('物管人员');
      expect(imported.status).toBe('有效');
      expect(imported.projectId).toBe(projectId);
      expect(imported.employeeNo).toBe(imported.id);
    });

    it('POST /people/import users 合法行默认业主/有效', async () => {
      const stamp = Date.now().toString(36);
      const name = `ImportE2E业主${stamp}`;
      const buffer = createExcelBuffer([
        ['姓名', '手机', '类型', '状态'],
        [name, '13900006222', '租户', '停用'],
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/v1/people/import')
        .set('Authorization', AUTH)
        .field('projectId', projectId)
        .field('scope', 'users')
        .attach('file', buffer, 'users.xlsx');

      expect(response.status).toBeLessThan(300);
      expect(response.body.code).toBe(0);
      expect(response.body.data.imported).toBe(1);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/people?projectId=${projectId}&scope=users&q=${encodeURIComponent(name)}`)
        .set('Authorization', AUTH);

      const imported = list.body.data.find((p: { name: string }) => p.name === name);
      expect(imported).toEqual(
        expect.objectContaining({
          name,
          identity: '租户',
          status: '停用',
          spaceLabel: null,
          projectId,
        }),
      );
    });
  });

  describe('Invalid row + atomic rollback', () => {
    it('非法 identity 返回 data.errors 行号，整单不写入', async () => {
      const stamp = Date.now().toString(36);
      const validName = `ImportE2E回滚员工${stamp}`;
      const invalidName = `ImportE2E假业主${stamp}`;
      const before = await request(app.getHttpServer())
        .get(`/api/v1/people?projectId=${projectId}&scope=staff&q=ImportE2E回滚`)
        .set('Authorization', AUTH);
      const beforeCount = (before.body.data as Array<{ name: string }>).filter((p) =>
        p.name.startsWith('ImportE2E回滚'),
      ).length;

      const buffer = createExcelBuffer([
        ['姓名', '手机', '身份', '状态'],
        [validName, '13900006333', '员工', '有效'],
        [invalidName, '13900006444', '业主', '有效'],
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/v1/people/import')
        .set('Authorization', AUTH)
        .field('projectId', projectId)
        .field('scope', 'staff')
        .attach('file', buffer, 'bad.xlsx');

      expect(response.body.code).toBe(400);
      expect(response.body.message).toBe('数据验证失败');
      expect(response.body.data.errors).toEqual([
        expect.objectContaining({
          row: 3,
          message: expect.stringContaining('staff'),
        }),
      ]);

      const after = await request(app.getHttpServer())
        .get(`/api/v1/people?projectId=${projectId}&scope=staff&q=ImportE2E回滚`)
        .set('Authorization', AUTH);
      const afterCount = (after.body.data as Array<{ name: string }>).filter((p) =>
        p.name.startsWith('ImportE2E回滚'),
      ).length;
      expect(afterCount).toBe(beforeCount);

      const listed = await request(app.getHttpServer())
        .get(`/api/v1/people?projectId=${projectId}&q=${encodeURIComponent(validName)}`)
        .set('Authorization', AUTH);
      expect(listed.body.data.some((p: { name: string }) => p.name === validName)).toBe(false);
    });

    it('users 拒绝员工 identity，带行号', async () => {
      const buffer = createExcelBuffer([
        ['姓名', '手机', '类型', '状态'],
        ['假员工', '13900006555', '物管人员', '有效'],
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/v1/people/import')
        .set('Authorization', AUTH)
        .field('projectId', projectId)
        .field('scope', 'users')
        .attach('file', buffer, 'bad-users.xlsx');

      expect(response.body.code).toBe(400);
      expect(response.body.data.errors[0].row).toBe(2);
      expect(response.body.data.errors[0].message).toContain('users');
    });

    it('缺少数据行失败', async () => {
      const buffer = createExcelBuffer([['姓名', '手机', '身份', '状态']]);
      const response = await request(app.getHttpServer())
        .post('/api/v1/people/import')
        .set('Authorization', AUTH)
        .field('projectId', projectId)
        .field('scope', 'staff')
        .attach('file', buffer, 'empty.xlsx');

      expect(response.body.code).toBeGreaterThan(0);
      expect(response.body.message).toContain('没有数据行');
    });

    it('缺少必需列失败', async () => {
      const buffer = createExcelBuffer([
        ['姓名', '手机'],
        ['只有姓名', '13900006666'],
      ]);
      const response = await request(app.getHttpServer())
        .post('/api/v1/people/import')
        .set('Authorization', AUTH)
        .field('projectId', projectId)
        .field('scope', 'staff')
        .attach('file', buffer, 'cols.xlsx');

      expect(response.body.code).toBeGreaterThan(0);
      expect(response.body.message).toContain('缺少必需列');
    });

    it('仅接受 xlsx，拒绝 csv', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/people/import')
        .set('Authorization', AUTH)
        .field('projectId', projectId)
        .field('scope', 'staff')
        .attach('file', Buffer.from('姓名,手机,身份,状态\n张三,13900006666,员工,有效'), 'people.csv');

      expect(response.body.code).toBeGreaterThan(0);
      expect(response.body.message).toContain('仅支持 xlsx');
    });

    it('import 的 scope 必须在 multipart body，不能只靠 query', async () => {
      const buffer = createExcelBuffer([
        ['姓名', '手机', '身份', '状态'],
        ['仅query scope', '13900006777', '员工', '有效'],
      ]);
      const response = await request(app.getHttpServer())
        .post(`/api/v1/people/import?scope=staff`)
        .set('Authorization', AUTH)
        .field('projectId', projectId)
        .attach('file', buffer, 'query-scope.xlsx');

      expect(response.body.code).not.toBe(0);
    });
  });
});
