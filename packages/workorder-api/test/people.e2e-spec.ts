import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('People employee API (e2e)', () => {
  let app: INestApplication;
  let token = '';
  let projectId = 'prj_xinglan';
  let createdId = '';

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('login', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userId: 'admin', password: 'dev' });
    expect(login.status).toBeLessThan(300);
    expect(login.body.code).toBe(0);
    token = login.body.data.token;
    expect(token).toBeTruthy();
  });

  it('GET /people 按项目+员工 identity 过滤，排除业主', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/people?projectId=${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    const list = res.body.data as Array<{ id: string; identity: string; name: string }>;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => ['管理员', '物管人员', '员工'].includes(p.identity))).toBe(true);
    expect(list.find((p) => p.id === 'linyue' || p.identity === '业主')).toBeUndefined();
    expect(list.find((p) => p.id === 'admin')).toBeTruthy();
    const sample = list[0];
    expect(sample).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        identity: expect.any(String),
        status: expect.any(String),
      }),
    );
    expect(sample).toHaveProperty('phone');
  });

  it('GET /people 缺少 projectId 时失败', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/people')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.code).not.toBe(0);
  });

  it('bootstrap/catalog people 同步排除业主', async () => {
    const boot = await request(app.getHttpServer())
      .get(`/api/v1/workbench/bootstrap?projectId=${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(boot.status).toBe(200);
    const people = boot.body.data.records.people as Array<{ id: string; values: { identity: string } }>;
    expect(people.every((p) => ['管理员', '物管人员', '员工'].includes(String(p.values.identity)))).toBe(
      true,
    );
    expect(people.find((p) => p.id === 'linyue')).toBeUndefined();
  });

  it('POST /people 新建员工，默认 identity=物管人员 并写入 ProjectMember', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId, name: 'E2E员工', phone: '13900001111' });
    expect(created.status).toBeLessThan(300);
    expect(created.body.code).toBe(0);
    expect(created.body.data.name).toBe('E2E员工');
    expect(created.body.data.phone).toBe('13900001111');
    expect(created.body.data.identity).toBe('物管人员');
    expect(created.body.data.status).toBe('有效');
    expect(created.body.data.projectId).toBe(projectId);
    createdId = created.body.data.id;
    expect(createdId).toBeTruthy();

    const list = await request(app.getHttpServer())
      .get(`/api/v1/people?projectId=${projectId}&q=E2E员工`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.data.some((p: { id: string }) => p.id === createdId)).toBe(true);
  });

  it('POST /people 拒绝业主 identity', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId, name: '假业主', identity: '业主' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.code).not.toBe(0);
  });

  it('PUT /people/:id 编辑 name/phone/identity', async () => {
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/people/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E员工改', phone: '13900002222', identity: '员工' });
    expect(updated.status).toBeLessThan(300);
    expect(updated.body.code).toBe(0);
    expect(updated.body.data.name).toBe('E2E员工改');
    expect(updated.body.data.phone).toBe('13900002222');
    expect(updated.body.data.identity).toBe('员工');
    expect(updated.body.data.status).toBe('有效');
  });

  it('PUT /people/:id 启停 status=有效|停用', async () => {
    const disabled = await request(app.getHttpServer())
      .put(`/api/v1/people/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: '停用' });
    expect(disabled.status).toBeLessThan(300);
    expect(disabled.body.code).toBe(0);
    expect(disabled.body.data.status).toBe('停用');
    expect(disabled.body.data).toEqual(
      expect.objectContaining({
        id: createdId,
        name: expect.any(String),
        identity: expect.any(String),
        status: '停用',
      }),
    );

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/people?projectId=${projectId}&status=${encodeURIComponent('停用')}&q=${encodeURIComponent('E2E员工改')}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listed.body.data.some((p: { id: string; status: string }) => p.id === createdId && p.status === '停用')).toBe(
      true,
    );

    const enabled = await request(app.getHttpServer())
      .put(`/api/v1/people/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: '有效' });
    expect(enabled.body.code).toBe(0);
    expect(enabled.body.data.status).toBe('有效');
  });

  it('workbench PUT collections/people/:id 也可编辑', async () => {
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/workbench/collections/people/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E管家路径', identity: '物管人员', status: '有效', projectId });
    expect(updated.status).toBeLessThan(300);
    expect(updated.body.code).toBe(0);
    expect(updated.body.data.record.name).toBe('E2E管家路径');
    expect(updated.body.data.record.status).toBe('有效');
    expect(updated.body.data.snapshot.records.people.some((p: { id: string }) => p.id === createdId)).toBe(
      true,
    );
  });

  it('不能通过员工接口编辑业主', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/people/linyue')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '不应改' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.message).toContain('员工不存在');
  });
});
