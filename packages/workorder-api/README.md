# Workorder API

## 启动

```bash
# 根目录
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev:api
```

服务地址：`http://localhost:3000/api/v1`

认证：`Authorization: Bearer dev-token-change-me`  
用户：`X-User-Id: user_resident` 或 `user_staff`

## 测试

```bash
pnpm --filter workorder-api test
pnpm --filter workorder-api test:e2e
```

## 主要接口

- `GET /health`
- `GET /workorder-types`
- `GET /workorder-types/:code/form-schema`
- `POST /workorders/draft`
- `POST /workorders/:id/submit`
- `GET /workorders/:id`
- `GET /tasks/todo`
- `POST /tasks/:id/complete`
