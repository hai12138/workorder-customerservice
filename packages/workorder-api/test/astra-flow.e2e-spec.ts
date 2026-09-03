import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Astra main flow (e2e)', () => {
  let app: INestApplication;
  let token = '';
  let projectId = '';
  let workorderId = '';
  let failureId = '';

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

  it('login → bootstrap', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userId: 'admin', password: 'dev' });
    expect(login.status).toBeLessThan(300);
    expect(login.body.code).toBe(0);
    token = login.body.data.token;
    expect(token).toBeTruthy();

    const boot = await request(app.getHttpServer())
      .get('/api/v1/workbench/bootstrap')
      .set('Authorization', `Bearer ${token}`);
    expect(boot.status).toBe(200);
    expect(boot.body.code).toBe(0);
    projectId = boot.body.data.projectId;
    expect(projectId).toBeTruthy();
    expect(boot.body.data.records.workorders.length).toBeGreaterThan(0);
  });

  it('create workorder → assign', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workbench/collections/workorders')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'E2E 报修单', subtitle: '1栋-101', projectId });
    expect(created.status).toBeLessThan(300);
    expect(created.body.code).toBe(0);
    workorderId = created.body.data.snapshot.records.workorders[0].id;

    const assigned = await request(app.getHttpServer())
      .post('/api/v1/workbench/commands')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'assign-workorder', id: workorderId, assignee: '赵晴', projectId });
    expect(assigned.status).toBeLessThan(300);
    expect(assigned.body.data.ok).toBe(true);
    expect(assigned.body.data.message).toContain('赵晴');
  });

  it('retry failed delivery', async () => {
    const boot = await request(app.getHttpServer())
      .get(`/api/v1/workbench/bootstrap?projectId=${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(boot.status).toBe(200);
    const failures = boot.body.data.records.failures ?? [];
    if (!failures.length) {
      const failList = await request(app.getHttpServer())
        .get(`/api/v1/failures?projectId=${projectId}`)
        .set('Authorization', `Bearer ${token}`);
      failureId = failList.body.data.records[0]?.id;
    } else {
      failureId = failures[0].id;
    }
    expect(failureId).toBeTruthy();

    const retry = await request(app.getHttpServer())
      .post('/api/v1/workbench/commands')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'retry-delivery', id: failureId, projectId });
    expect(retry.status).toBeLessThan(300);
    expect(retry.body.data.ok).toBe(true);
  });

  it('publish config', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/config/draft')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId });

    const pub = await request(app.getHttpServer())
      .post('/api/v1/workbench/commands')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'publish-config', version: 'V4-E2E', projectId });
    expect(pub.status).toBeLessThan(300);
    expect(pub.body.data.ok).toBe(true);
  });

  it('agent sandbox submit-draft', async () => {
    const key = `idem-e2e-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/workbench/commands')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'submit-agent-draft', idempotencyKey: key, projectId });
    expect(res.status).toBeLessThan(300);
    expect(res.body.data.ok).toBe(true);

    const again = await request(app.getHttpServer())
      .post('/api/v1/agent/sandbox/submit-draft')
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: key, draft: { type_code: 'REPAIR', title: '沙箱' }, projectId });
    expect(again.status).toBeLessThan(300);
    expect(again.body.data.ok).toBe(true);
  });

  it('flows and sla readable', async () => {
    const flow = await request(app.getHttpServer())
      .get('/api/v1/flows/standard')
      .set('Authorization', `Bearer ${token}`);
    expect(flow.status).toBe(200);
    expect(flow.body.data.key).toBe('standard');

    const sla = await request(app.getHttpServer())
      .get('/api/v1/sla-policies')
      .set('Authorization', `Bearer ${token}`);
    expect(sla.status).toBe(200);
    expect(Array.isArray(sla.body.data.policies)).toBe(true);
  });
});
