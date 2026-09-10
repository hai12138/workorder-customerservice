import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

const SEED_ROLE_CODES = ['PROPERTY_ADMIN', 'PROPERTY_STAFF', 'PROJECT_USER'] as const;

describe('Roles API (e2e)', () => {
  let app: INestApplication;
  let token = '';

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

  it('未登录 GET /roles 被 JWT 拦截', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/roles');
    expect(res.status).toBe(401);
    expect(res.body.code).not.toBe(0);
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

  it('GET /roles 含 seed PROPERTY_ADMIN/PROPERTY_STAFF/PROJECT_USER，admin permissions 含 *', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);

    const list = res.body.data as Array<{
      id: string;
      code: string;
      name: string;
      scope: string;
      status: string;
      permissions: string[];
    }>;
    expect(Array.isArray(list)).toBe(true);

    for (const code of SEED_ROLE_CODES) {
      expect(list.find((role) => role.code === code)).toBeTruthy();
    }

    const admin = list.find((role) => role.code === 'PROPERTY_ADMIN');
    expect(admin).toBeTruthy();
    expect(Array.isArray(admin?.permissions)).toBe(true);
    expect(admin?.permissions).toContain('*');
    expect(typeof admin?.permissions).not.toBe('number');

    const sample = list[0];
    expect(sample).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        code: expect.any(String),
        name: expect.any(String),
        scope: expect.any(String),
        status: expect.any(String),
      }),
    );
    expect(Array.isArray(sample.permissions)).toBe(true);
  });

  it('GET /roles?status=启用 仍含 seed 三角色', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/roles?status=${encodeURIComponent('启用')}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    const codes = (res.body.data as Array<{ code: string }>).map((role) => role.code);
    expect(codes).toEqual(expect.arrayContaining([...SEED_ROLE_CODES]));
  });
});
