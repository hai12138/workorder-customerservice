import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Projects CRUD (e2e)', () => {
  let app: INestApplication;
  let token = '';
  let projectId = '';

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

  it('create project', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workbench/collections/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'E2E 测试项目', subtitle: '测试区域' });
    expect(created.status).toBeLessThan(300);
    expect(created.body.code).toBe(0);
    expect(created.body.data.snapshot.records.projects).toBeTruthy();
    
    const projects = created.body.data.snapshot.records.projects;
    const newProject = projects.find((p: { title: string }) => p.title === 'E2E 测试项目');
    expect(newProject).toBeTruthy();
    projectId = newProject.id;
  });

  it('update project', async () => {
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E 测试项目 - 已更新',
        province: '江苏省',
        city: '南京市',
        district: '鼓楼区',
        address: '测试路123号',
        businessType: '住宅',
        manager: '李经理',
        phone: '400-123-4567',
      });
    expect(updated.status).toBeLessThan(300);
    expect(updated.body.code).toBe(0);
    expect(updated.body.data.title).toBe('E2E 测试项目 - 已更新');
    expect(updated.body.data.values.province).toBe('江苏省');
    expect(updated.body.data.values.city).toBe('南京市');
    expect(updated.body.data.values.district).toBe('鼓楼区');
    expect(updated.body.data.values.region).toBe('江苏省/南京市/鼓楼区');
    expect(updated.body.data.values.address).toBe('测试路123号');
    expect(updated.body.data.values.businessType).toBe('住宅');
    expect(updated.body.data.values.manager).toBe('李经理');
    expect(updated.body.data.values.phone).toBe('400-123-4567');
    expect(updated.body.message).toContain('已更新');
  });

  it('stop project', async () => {
    const stopped = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/stop`)
      .set('Authorization', `Bearer ${token}`);
    expect(stopped.status).toBeLessThan(300);
    expect(stopped.body.code).toBe(0);
    expect(stopped.body.data.status).toBe('已停用');
    expect(stopped.body.message).toContain('已停用');
  });

  it('list reflects changes', async () => {
    const boot = await request(app.getHttpServer())
      .get('/api/v1/workbench/bootstrap')
      .set('Authorization', `Bearer ${token}`);
    expect(boot.status).toBe(200);
    expect(boot.body.code).toBe(0);
    
    const projects = boot.body.data.records.projects;
    const stoppedProject = projects.find((p: { id: string }) => p.id === projectId);
    expect(stoppedProject).toBeTruthy();
    expect(stoppedProject.status).toBe('已停用');
    expect(stoppedProject.title).toBe('E2E 测试项目 - 已更新');
  });

  it('delete project without dependencies', async () => {
    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBeLessThan(300);
    expect(deleted.body.code).toBe(0);
    expect(deleted.body.message).toContain('已删除');
    
    // Verify project is gone
    const boot = await request(app.getHttpServer())
      .get('/api/v1/workbench/bootstrap')
      .set('Authorization', `Bearer ${token}`);
    const projects = boot.body.data.records.projects;
    const deletedProject = projects.find((p: { id: string }) => p.id === projectId);
    expect(deletedProject).toBeUndefined();
  });

  it('cannot delete project with dependencies', async () => {
    // Get a project with data
    const boot = await request(app.getHttpServer())
      .get('/api/v1/workbench/bootstrap')
      .set('Authorization', `Bearer ${token}`);
    const projectWithData = boot.body.data.records.projects[0];
    
    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectWithData.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBeGreaterThanOrEqual(400);
    expect(deleted.body.message).toContain('关联数据');
  });
});
