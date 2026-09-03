# 本地运行启动文档

本文说明如何在本地启动 Astra Service OS 全套环境（PostgreSQL + Redis + Nest API + 管理后台）。

## 1. 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | >= 20 |
| pnpm | 9.x（项目锁定 `pnpm@9.15.0`） |
| Docker Desktop | 用于 PostgreSQL、Redis |

可选：Cursor / VS Code，用于 MCP 联调。

## 2. 首次初始化（只需一次）

在项目根目录 `workorder-customerservice` 执行：

```powershell
# 1) 复制环境变量
Copy-Item .env.example .env

# 2) 启动数据库
docker compose up -d

# 3) 安装依赖
pnpm install

# 4) 同步 schema + 种子数据
cd packages/workorder-api
npx prisma db push
npx prisma db seed
cd ../..
```

**说明**

- `.env` 默认连接 `localhost:5432`（Postgres）和 `localhost:6379`（Redis）。
- 若本地库仍是旧表结构，可先清空再 push：

```powershell
docker exec workorder-customerservice-postgres-1 psql -U workorder -d workorder -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO workorder;"
cd packages/workorder-api
npx prisma db push
npx prisma db seed
```

## 3. 启动服务

需要 **两个终端**（API 与管理后台）。

### 终端 A — 工单 API

```powershell
pnpm dev:api
```

- 健康检查：<http://localhost:3000/api/v1/health>
- API 前缀：`/api/v1`

### 终端 B — 管理后台

```powershell
pnpm dev:admin
```

浏览器打开：<http://localhost:5173> → 自动跳转 `/login`。

默认数据模式为 **HTTP**（`VITE_DATA_MODE=http`）。若要纯前端 LocalStorage 演示，可在 `packages/workorder-admin` 设置 `VITE_DATA_MODE=local`。

## 4. 访问地址一览

| 服务 | 地址 | 说明 |
|------|------|------|
| 管理后台 | http://localhost:5173 | Astra Service OS |
| 登录页 | http://localhost:5173/login | JWT 登录 |
| 工单 API | http://localhost:3000/api/v1 | NestJS REST |
| 健康检查 | http://localhost:3000/api/v1/health | 无鉴权 |
| PostgreSQL | localhost:5432 | 用户/密码/库：`workorder` |
| Redis | localhost:6379 | 工单号序列 |

## 5. 鉴权与演示账号

登录页可选种子用户；开发口令统一为 **`dev`**（见 `.env.example`）。

| 用户 ID | 姓名 | 角色 |
|---------|------|------|
| `admin` | 项目管理员 | 全权限 `*` |
| `zhaoqing` | 赵晴 | 物业客服 |
| `chenbin` | 陈斌 | 物业客服 |
| `linzhou` | 林舟 | 物业客服 |
| `linyue` | 林悦 | 项目用户 |

登录接口：`POST /api/v1/auth/login`，body：`{ "userId": "admin", "password": "dev" }`。

脚本 / MCP 仍可使用静态 Token：

```http
Authorization: Bearer dev-token-change-me
X-User-Id: admin
```

### 快速验证

```powershell
# 登录拿 JWT
curl -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"userId\":\"admin\",\"password\":\"dev\"}"

# Bootstrap（把 TOKEN 换成上一步返回）
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/v1/workbench/bootstrap
```

## 6. 管理后台菜单（约 28 个入口）

数据经 `HttpWorkbenchRepository` → `/workbench/bootstrap` 与命令接口，默认不再依赖 LocalStorage。

| 一级菜单 | 页面 |
|---------|------|
| 运营总览 | 运营总览 |
| 基础配置 | 项目、空间、用户与员工、角色权限 |
| 工单配置 | 配置总览、工单类型、表单字段、流程与 SLA、派单规则、计划工单、配置版本与发布 |
| 通知中心 | 总览、策略、微信模板映射、渠道绑定、投递记录、失败重试、微信接入配置 |
| Agent 接入 | 总览、MCP 工具、Skill 包、应用与权限、联调测试台、调用日志 |
| 消息通知 | 消息中心 |
| 工单管理 | 工单台账 |
| 异常中心 | 异常列表 |

演示闭环：登录 → 建单 → 派单 → 失败通知重试 → 配置发布 → Agent 沙箱提交。

## 7. 可选：MCP Server（Agent 联调）

MCP 调用新 runtime API（`/workorders/draft`、`/workorder-types` 等）：

```powershell
pnpm --filter workorder-mcp build
pnpm dev:mcp
```

```json
{
  "mcpServers": {
    "workorder": {
      "command": "node",
      "args": ["packages/workorder-mcp/dist/index.js"],
      "env": {
        "WORKORDER_API_BASE": "http://localhost:3000/api/v1",
        "WORKORDER_API_TOKEN": "dev-token-change-me",
        "WORKORDER_DEFAULT_USER_ID": "admin"
      }
    }
  }
}
```

## 8. 常用命令

```powershell
pnpm build
pnpm test
pnpm test:e2e
pnpm db:seed
docker compose down
docker compose down -v
```

## 9. 常见问题

### 管理后台 401 / 跳登录

1. 确认 `pnpm dev:api` 已启动。
2. 重新在 `/login` 登录。
3. 确认 `JWT_SECRET` 与 API 一致。

### 数据库结构不匹配

执行第 2 节「清空 schema + db push + seed」。

### 计划工单 / SLA / 投递重试未触发

依赖 API 内置定时任务（每分钟），**API 进程必须保持运行**。

## 10. 推荐启动顺序

```powershell
docker compose up -d
pnpm dev:api
pnpm dev:admin
```

浏览器访问 <http://localhost:5173/login>，使用 `admin` / `dev` 登录。
