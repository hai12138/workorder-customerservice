import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('People API (e2e)', () => {
  let app: INestApplication;
  let token = '';
  let projectId = 'prj_xinglan';
  let createdId = '';
  let createdUserId = '';
  let spaceUserId = '';

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
        employeeNo: sample.id,
        onlineStatus: null,
      }),
    );
    expect(sample).toHaveProperty('phone');
    expect(sample).toHaveProperty('teamName');
    expect(sample).toHaveProperty('roleName');
  });

  it('GET /people?scope=staff 与默认等价，且 q 可匹配 employeeNo/id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/people?projectId=${projectId}&scope=staff&q=zhaoqing`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    const list = res.body.data as Array<{ id: string; employeeNo: string; identity: string }>;
    expect(list.every((p) => ['管理员', '物管人员', '员工'].includes(p.identity))).toBe(true);
    expect(list.some((p) => p.id === 'zhaoqing' && p.employeeNo === 'zhaoqing')).toBe(true);
  });

  it('GET /people?scope=users 只返用户身份，排除员工', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/people?projectId=${projectId}&scope=users`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    const list = res.body.data as Array<{
      id: string;
      identity: string;
      spaceId: string | null;
      spaceLabel: string | null;
      spacePath: string | null;
      relationStatus: null;
      relationSource: null;
      updatedAt: string;
    }>;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => ['业主', '租户', '家属', '类型未设置'].includes(p.identity))).toBe(true);
    expect(list.find((p) => p.id === 'admin' || p.identity === '物管人员')).toBeUndefined();
    expect(list.find((p) => p.id === 'linyue')).toEqual(
      expect.objectContaining({
        id: 'linyue',
        spaceId: 'sp_bld_1',
        spaceLabel: '1栋',
        spacePath: '1栋',
        relationStatus: null,
        relationSource: null,
      }),
    );
    expect(list.find((p) => p.id === 'jiashu' && p.identity === '家属')).toEqual(
      expect.objectContaining({ id: 'jiashu', spaceId: null, spaceLabel: null, spacePath: null }),
    );
    expect(list.find((p) => p.id === 'weizhi' && p.identity === '类型未设置')).toBeTruthy();
    const sample = list[0];
    expect(sample).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        identity: expect.any(String),
        status: expect.any(String),
        relationStatus: null,
        relationSource: null,
      }),
    );
    expect(sample).toHaveProperty('phone');
    expect(sample).toHaveProperty('spaceId');
    expect(sample).toHaveProperty('spaceLabel');
    expect(sample).toHaveProperty('spacePath');
    expect(sample.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(sample).not.toHaveProperty('employeeNo');
  });

  it('GET /people?scope=users&identity=业主 精确过滤', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/people?projectId=${projectId}&scope=users&identity=${encodeURIComponent('业主')}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.code).toBe(0);
    const list = res.body.data as Array<{ identity: string }>;
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.identity === '业主')).toBe(true);
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
    expect(created.body.data.employeeNo).toBe(created.body.data.id);
    expect(created.body.data.onlineStatus).toBeNull();
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

  it('POST /people scope=users 新建业主并写入 ProjectMember', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'users', projectId, name: 'E2E业主', phone: '13900004444' });
    expect(created.status).toBeLessThan(300);
    expect(created.body.code).toBe(0);
    expect(created.body.data.name).toBe('E2E业主');
    expect(created.body.data.phone).toBe('13900004444');
    expect(created.body.data.identity).toBe('业主');
    expect(created.body.data.status).toBe('有效');
    expect(created.body.data.spaceId).toBeNull();
    expect(created.body.data.spaceLabel).toBeNull();
    expect(created.body.data.spacePath).toBeNull();
    expect(created.body.data.relationStatus).toBeNull();
    expect(created.body.data.relationSource).toBeNull();
    expect(created.body.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    createdUserId = created.body.data.id;
    expect(createdUserId).toBeTruthy();

    const list = await request(app.getHttpServer())
      .get(`/api/v1/people?projectId=${projectId}&scope=users&q=${encodeURIComponent('E2E业主')}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.data.some((p: { id: string }) => p.id === createdUserId)).toBe(true);
    expect(
      list.body.data.every((p: { identity: string }) =>
        ['业主', '租户', '家属', '类型未设置'].includes(p.identity),
      ),
    ).toBe(true);
  });

  it('POST /people scope=users 拒绝员工 identity', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'users', projectId, name: '假员工', identity: '物管人员' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.code).not.toBe(0);
  });

  it('PUT /people/:id 可改用户 name/identity（须落在 users scope）', async () => {
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/people/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E业主改', phone: '13900005555', identity: '租户' });
    expect(updated.status).toBeLessThan(300);
    expect(updated.body.code).toBe(0);
    expect(updated.body.data.name).toBe('E2E业主改');
    expect(updated.body.data.phone).toBe('13900005555');
    expect(updated.body.data.identity).toBe('租户');
    expect(updated.body.data.status).toBe('有效');
    expect(updated.body.data.spaceId).toBeNull();
    expect(updated.body.data.spaceLabel).toBeNull();
    expect(updated.body.data.spacePath).toBeNull();
  });

  it('PUT /people/:id 用户启停 status=有效|停用', async () => {
    const disabled = await request(app.getHttpServer())
      .put(`/api/v1/people/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: '停用' });
    expect(disabled.status).toBeLessThan(300);
    expect(disabled.body.code).toBe(0);
    expect(disabled.body.data.status).toBe('停用');

    const listed = await request(app.getHttpServer())
      .get(
        `/api/v1/people?projectId=${projectId}&scope=users&status=${encodeURIComponent('停用')}&q=${encodeURIComponent('E2E业主改')}`,
      )
      .set('Authorization', `Bearer ${token}`);
    expect(
      listed.body.data.some((p: { id: string; status: string }) => p.id === createdUserId && p.status === '停用'),
    ).toBe(true);

    const enabled = await request(app.getHttpServer())
      .put(`/api/v1/people/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: '有效' });
    expect(enabled.body.code).toBe(0);
    expect(enabled.body.data.status).toBe('有效');
  });

  it('PUT 拒绝跨 scope 改 identity：员工不可改业主，用户不可改员工', async () => {
    const staffCross = await request(app.getHttpServer())
      .put(`/api/v1/people/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ identity: '业主' });
    expect(staffCross.status).toBeGreaterThanOrEqual(400);
    expect(staffCross.body.code).not.toBe(0);

    const userCross = await request(app.getHttpServer())
      .put(`/api/v1/people/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ identity: '员工' });
    expect(userCross.status).toBeGreaterThanOrEqual(400);
    expect(userCross.body.code).not.toBe(0);
  });

  it('POST /people scope=users 带 spaceId：创建回显 + 列表回显 spacePath', async () => {
    const floor = await request(app.getHttpServer())
      .post('/api/v1/spaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectId,
        parentId: 'sp_bld_1',
        name: 'E2E常用层',
        type: '楼层',
      });
    expect(floor.status).toBeLessThan(300);
    expect(floor.body.code).toBe(0);
    const childSpaceId = floor.body.data.id as string;
    expect(childSpaceId).toBeTruthy();

    const created = await request(app.getHttpServer())
      .post('/api/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scope: 'users',
        projectId,
        name: 'E2E带空间业主',
        phone: '13900006666',
        spaceId: childSpaceId,
      });
    expect(created.status).toBeLessThan(300);
    expect(created.body.code).toBe(0);
    expect(created.body.data).toEqual(
      expect.objectContaining({
        name: 'E2E带空间业主',
        spaceId: childSpaceId,
        spaceLabel: 'E2E常用层',
        spacePath: '1栋/E2E常用层',
        relationStatus: null,
        relationSource: null,
      }),
    );
    spaceUserId = created.body.data.id;
    expect(spaceUserId).toBeTruthy();

    const list = await request(app.getHttpServer())
      .get(`/api/v1/people?projectId=${projectId}&scope=users&q=${encodeURIComponent('E2E带空间业主')}`)
      .set('Authorization', `Bearer ${token}`);
    const row = list.body.data.find((p: { id: string }) => p.id === spaceUserId);
    expect(row).toEqual(
      expect.objectContaining({
        spaceId: childSpaceId,
        spaceLabel: 'E2E常用层',
        spacePath: '1栋/E2E常用层',
      }),
    );
  });

  it('PUT /people/:id 改常用空间、省略不改、显式 null 清空', async () => {
    const changed = await request(app.getHttpServer())
      .put(`/api/v1/people/${spaceUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId: 'sp_bld_2' });
    expect(changed.status).toBeLessThan(300);
    expect(changed.body.code).toBe(0);
    expect(changed.body.data).toEqual(
      expect.objectContaining({
        spaceId: 'sp_bld_2',
        spaceLabel: '2栋',
        spacePath: '2栋',
      }),
    );

    const omitted = await request(app.getHttpServer())
      .put(`/api/v1/people/${spaceUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E带空间业主改' });
    expect(omitted.body.code).toBe(0);
    expect(omitted.body.data.name).toBe('E2E带空间业主改');
    expect(omitted.body.data.spaceId).toBe('sp_bld_2');
    expect(omitted.body.data.spaceLabel).toBe('2栋');
    expect(omitted.body.data.spacePath).toBe('2栋');

    const cleared = await request(app.getHttpServer())
      .put(`/api/v1/people/${spaceUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId: null });
    expect(cleared.body.code).toBe(0);
    expect(cleared.body.data.spaceId).toBeNull();
    expect(cleared.body.data.spaceLabel).toBeNull();
    expect(cleared.body.data.spacePath).toBeNull();
  });

  it('POST /people scope=users 跨项目 spaceId 返回 400', async () => {
    const other = await request(app.getHttpServer())
      .post('/api/v1/spaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectId: 'prj_yunqi',
        name: 'E2E云栖楼',
        type: '楼栋',
      });
    expect(other.status).toBeLessThan(300);
    const otherSpaceId = other.body.data.id as string;

    const res = await request(app.getHttpServer())
      .post('/api/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({
        scope: 'users',
        projectId,
        name: 'E2E跨项目空间',
        spaceId: otherSpaceId,
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.code).not.toBe(0);

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/people?projectId=${projectId}&scope=users&q=${encodeURIComponent('E2E跨项目空间')}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listed.body.data.some((p: { name: string }) => p.name === 'E2E跨项目空间')).toBe(false);

    const putCross = await request(app.getHttpServer())
      .put(`/api/v1/people/${spaceUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId: otherSpaceId });
    expect(putCross.status).toBeGreaterThanOrEqual(400);
    expect(putCross.body.code).not.toBe(0);
  });

  it('staff scope 忽略 spaceId（非法 id 仍可创建员工）', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectId,
        name: 'E2E忽略空间员工',
        spaceId: 'not-a-space',
      });
    expect(res.status).toBeLessThan(300);
    expect(res.body.code).toBe(0);
    expect(res.body.data.identity).toBe('物管人员');
    expect(res.body.data).not.toHaveProperty('spaceId');
  });
});
