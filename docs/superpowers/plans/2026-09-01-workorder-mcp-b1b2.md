# 工单服务 + MCP/Skill（B1+B2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付自研工单服务 MVP（配置 + 运行）及 NestJS/TS MCP Server + Skill 包，使 Agent 可完成建单与查单闭环。

**Architecture:** pnpm monorepo；`workorder-api`（NestJS + Prisma + PostgreSQL）承载领域逻辑；`workorder-mcp` 独立进程通过 HTTP 调 API；轻量 JSON 状态机驱动流程；配置以 `ConfigVersion` 发布态只读。

**Tech Stack:** Node 20+, pnpm, NestJS 10, Prisma 5, PostgreSQL 16, Redis 7, Vitest, supertest, `@modelcontextprotocol/sdk`

**Spec:** `docs/superpowers/specs/2026-09-01-workorder-mcp-design.md`

## Global Constraints

- 完全自研，不调用 NexField 后台 API
- API Base path: `/api/v1`
- 响应格式: `{ code: 0, message: "ok", data }`；错误 `code !== 0`
- 认证: `Authorization: Bearer <api_token>` + 可选 `X-User-Id` 表示操作用户
- 单号规则: `WO{yyyyMMdd}{6位序号}`，Redis 自增
- 第一版内置工单类型: `REPAIR`（客服报修）、`CLEANING`（环境保洁）
- 动态字段类型仅支持: `text`, `textarea`, `select`, `date`, `image`, `phone`
- 流程第一版仅串行节点 + `assignee_rule`: `dispatch_rule` | `assignee` | `creator` | `fixed_user`
- 表结构预留 `tenant_id`，默认 `"default"`
- MCP 工具命名前缀: `workorder_`

---

## File Structure (target)

```
workorder-customerservice/
  package.json                 # pnpm workspace root
  pnpm-workspace.yaml
  docker-compose.yml
  .env.example
  packages/
    workorder-api/
      package.json
      prisma/schema.prisma
      prisma/seed.ts
      src/main.ts
      src/app.module.ts
      src/common/
        filters/http-exception.filter.ts
        interceptors/response.interceptor.ts
        guards/api-key.guard.ts
        decorators/current-user.decorator.ts
      src/modules/
        foundation/            # project, space, user (minimal seed)
        config/                  # types, fields, config-version
        runtime/                 # workorder, flow-engine, tasks
        auth/                    # api-key
      test/
        workorder.e2e-spec.ts
    workorder-mcp/
      package.json
      src/index.ts
      src/tools/
        list-types.ts
        get-form-schema.ts
        create-draft.ts
        submit.ts
        get.ts
        list.ts
        list-tasks.ts
        complete-task.ts
        transfer-task.ts
        get-config-summary.ts
      test/tools.test.ts
    workorder-skill/
      SKILL.md
    workorder-sdk/
      package.json
      src/client.ts
      src/types.ts
```

---

### Task 1: Monorepo 与基础设施脚手架

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `docker-compose.yml`, `.env.example`, `.gitignore`
- Create: `packages/workorder-api/package.json`, `packages/workorder-mcp/package.json`, `packages/workorder-sdk/package.json`

**Interfaces:**
- Produces: `pnpm dev:api`, `pnpm dev:mcp`, `docker compose up -d` 可启动 PG+Redis

- [ ] **Step 1: 创建 workspace root**

`package.json`:
```json
{
  "name": "workorder-customerservice",
  "private": true,
  "scripts": {
    "dev:api": "pnpm --filter workorder-api dev",
    "dev:mcp": "pnpm --filter workorder-mcp dev",
    "test": "pnpm -r test",
    "db:migrate": "pnpm --filter workorder-api prisma migrate dev",
    "db:seed": "pnpm --filter workorder-api prisma db seed"
  },
  "engines": { "node": ">=20" }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: docker-compose**

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: workorder
      POSTGRES_PASSWORD: workorder
      POSTGRES_DB: workorder
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  pgdata:
```

`.env.example`:
```
DATABASE_URL=postgresql://workorder:workorder@localhost:5432/workorder
REDIS_URL=redis://localhost:6379
API_TOKEN=dev-token-change-me
PORT=3000
```

- [ ] **Step 3: 验证**

```bash
docker compose up -d
pnpm install
```

Expected: postgres + redis healthy

---

### Task 2: Prisma Schema 与种子数据

**Files:**
- Create: `packages/workorder-api/prisma/schema.prisma`
- Create: `packages/workorder-api/prisma/seed.ts`

**Interfaces:**
- Produces models: `User`, `WorkorderType`, `FormField`, `FlowTemplate`, `ConfigVersion`, `Workorder`, `FlowInstance`, `JobTask`, `WorkorderEvent`
- Produces seed: 2 users, 2 types, fields, 1 flow, 1 published config

- [ ] **Step 1: schema.prisma 核心模型**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  tenantId  String   @default("default") @map("tenant_id")
  name      String
  phone     String?
  createdAt DateTime @default(now()) @map("created_at")
  workorders Workorder[] @relation("WorkorderCreator")
  jobTasks   JobTask[]
  @@map("users")
}

model ConfigVersion {
  id          String   @id @default(cuid())
  tenantId    String   @default("default") @map("tenant_id")
  version     Int
  status      String   // draft | published
  publishedAt DateTime? @map("published_at")
  createdAt   DateTime @default(now()) @map("created_at")
  types       WorkorderType[]
  @@unique([tenantId, version])
  @@map("config_versions")
}

model WorkorderType {
  id              String   @id @default(cuid())
  tenantId        String   @default("default") @map("tenant_id")
  configVersionId String   @map("config_version_id")
  code            String
  name            String
  groupName       String   @map("group_name")
  defaultFlowKey  String   @map("default_flow_key")
  sort            Int      @default(0)
  configVersion   ConfigVersion @relation(fields: [configVersionId], references: [id])
  fields          FormField[]
  @@unique([configVersionId, code])
  @@map("workorder_types")
}

model FormField {
  id              String @id @default(cuid())
  workorderTypeId String @map("workorder_type_id")
  key             String
  label           String
  type            String
  required        Boolean @default(false)
  options         Json?
  sort            Int @default(0)
  workorderType   WorkorderType @relation(fields: [workorderTypeId], references: [id])
  @@unique([workorderTypeId, key])
  @@map("form_fields")
}

model FlowTemplate {
  id              String @id @default(cuid())
  tenantId        String @default("default") @map("tenant_id")
  configVersionId String @map("config_version_id")
  flowKey         String @map("flow_key")
  version         Int
  definition      Json
  @@unique([configVersionId, flowKey])
  @@map("flow_templates")
}

model Workorder {
  id           String   @id @default(cuid())
  tenantId     String   @default("default") @map("tenant_id")
  workorderNo  String   @unique @map("workorder_no")
  typeCode     String   @map("type_code")
  status       String   // DRAFT | SUBMITTED | IN_PROGRESS | COMPLETED | CANCELLED | TERMINATED
  title        String?
  formData     Json     @map("form_data")
  creatorId    String   @map("creator_id")
  creator      User     @relation("WorkorderCreator", fields: [creatorId], references: [id])
  flowInstance FlowInstance?
  events       WorkorderEvent[]
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  @@map("workorders")
}

model FlowInstance {
  id              String @id @default(cuid())
  workorderId     String @unique @map("workorder_id")
  flowKey         String @map("flow_key")
  status          String // RUNNING | COMPLETED | TERMINATED
  currentNodeKey  String? @map("current_node_key")
  definition      Json
  workorder       Workorder @relation(fields: [workorderId], references: [id])
  tasks           JobTask[]
  @@map("flow_instances")
}

model JobTask {
  id             String @id @default(cuid())
  flowInstanceId String @map("flow_instance_id")
  nodeKey        String @map("node_key")
  nodeName       String @map("node_name")
  assigneeId     String @map("assignee_id")
  assignee       User   @relation(fields: [assigneeId], references: [id])
  status         String // PENDING | DONE | REJECTED | TRANSFERRED
  belongType     String @default("todo") @map("belong_type")
  flowInstance   FlowInstance @relation(fields: [flowInstanceId], references: [id])
  createdAt      DateTime @default(now()) @map("created_at")
  completedAt    DateTime? @map("completed_at")
  @@map("job_tasks")
}

model WorkorderEvent {
  id          String @id @default(cuid())
  workorderId String @map("workorder_id")
  action      String
  operatorId  String? @map("operator_id")
  payload     Json?
  createdAt   DateTime @default(now()) @map("created_at")
  workorder   Workorder @relation(fields: [workorderId], references: [id])
  @@map("workorder_events")
}
```

- [ ] **Step 2: seed.ts**

种子内容:
- Users: `user_staff` (处理人), `user_resident` (报修人)
- ConfigVersion v1 `published`
- Types: REPAIR, CLEANING + 各自 fields (title, description, contact_phone, urgency for REPAIR)
- FlowTemplate `repair_flow` / `cleaning_flow` 各 3 节点: dispatch → handle → end

- [ ] **Step 3: 迁移与 seed**

```bash
cd packages/workorder-api
pnpm prisma migrate dev --name init
pnpm prisma db seed
```

Expected: 表创建成功，seed 数据可查

---

### Task 3: NestJS API 基础层

**Files:**
- Create: `packages/workorder-api/src/main.ts`, `app.module.ts`
- Create: `src/common/filters/http-exception.filter.ts`
- Create: `src/common/interceptors/response.interceptor.ts`
- Create: `src/common/guards/api-key.guard.ts`
- Create: `src/common/decorators/current-user.decorator.ts`
- Create: `src/prisma/prisma.module.ts`, `prisma.service.ts`
- Test: `packages/workorder-api/test/health.e2e-spec.ts`

**Interfaces:**
- Produces: `GET /api/v1/health` → `{ code: 0, data: { status: "ok" } }`
- Produces: `ApiKeyGuard` 校验 `Authorization: Bearer <API_TOKEN>`
- Produces: `@CurrentUser()` 从 `X-User-Id` header 读取，默认 `user_resident`

- [ ] **Step 1: 写失败 e2e 测试**

```typescript
// test/health.e2e-spec.ts
it('GET /api/v1/health', () =>
  request(app.getHttpServer())
    .get('/api/v1/health')
    .set('Authorization', 'Bearer dev-token-change-me')
    .expect(200)
    .expect(res => {
      expect(res.body.code).toBe(0);
      expect(res.body.data.status).toBe('ok');
    }));
```

- [ ] **Step 2: 实现 main + 全局 prefix `/api/v1`、filter、interceptor、guard**

`response.interceptor.ts` 包装成功响应为 `{ code: 0, message: 'ok', data }`

- [ ] **Step 3: 运行测试**

```bash
pnpm --filter workorder-api test:e2e
```

Expected: PASS

---

### Task 4: 配置模块 — 工单类型与表单 Schema

**Files:**
- Create: `src/modules/config/config.module.ts`
- Create: `src/modules/config/workorder-type.controller.ts`
- Create: `src/modules/config/workorder-type.service.ts`
- Create: `src/modules/config/dto/form-schema.dto.ts`
- Test: `test/config.e2e-spec.ts`

**Interfaces:**
- Produces: `WorkorderTypeService.getPublishedTypes(): Promise<WorkorderTypeDto[]>`
- Produces: `WorkorderTypeService.getFormSchema(typeCode: string): Promise<FormSchemaDto>`
- API:
  - `GET /api/v1/workorder-types`
  - `GET /api/v1/workorder-types/:code`
  - `GET /api/v1/workorder-types/:code/form-schema`
  - `GET /api/v1/config/summary`

- [ ] **Step 1: 写失败测试 list types**

```typescript
it('lists published workorder types', async () => {
  const res = await request(app.getHttpServer())
    .get('/api/v1/workorder-types')
    .set('Authorization', 'Bearer dev-token-change-me')
    .expect(200);
  expect(res.body.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'REPAIR' }),
      expect.objectContaining({ code: 'CLEANING' }),
    ]),
  );
});
```

- [ ] **Step 2: 实现 service** — 只查 `status=published` 的最新 `ConfigVersion`

- [ ] **Step 3: 写 form-schema 测试** — REPAIR 含 `title` required

- [ ] **Step 4: 实现 form-schema endpoint**

- [ ] **Step 5: config/summary** — 返回 `{ version, typeCount, publishedAt }`

- [ ] **Step 6: 运行 `pnpm --filter workorder-api test:e2e`**

Expected: PASS

---

### Task 5: 工单号生成与 Redis 模块

**Files:**
- Create: `src/modules/runtime/workorder-no.service.ts`
- Create: `src/redis/redis.module.ts`, `redis.service.ts`
- Test: `src/modules/runtime/workorder-no.service.spec.ts`

**Interfaces:**
- Produces: `WorkorderNoService.next(): Promise<string>` → `WO20260901000001` 格式

- [ ] **Step 1: 单元测试**

```typescript
it('generates WO prefix with date and sequence', async () => {
  const no = await service.next();
  expect(no).toMatch(/^WO\d{8}\d{6}$/);
});
```

- [ ] **Step 2: Redis INCR key `workorder:seq:{yyyyMMdd}` 左补零 6 位**

- [ ] **Step 3: 运行 vitest**

Expected: PASS

---

### Task 6: 表单校验服务

**Files:**
- Create: `src/modules/runtime/form-validation.service.ts`
- Test: `src/modules/runtime/form-validation.service.spec.ts`

**Interfaces:**
- Consumes: `FormSchemaDto` from Task 4
- Produces: `FormValidationService.validate(schema, data): ValidationResult`
- `ValidationResult`: `{ valid: boolean, errors: { field: string, message: string }[] }`

- [ ] **Step 1: 测试缺必填字段返回 errors**

```typescript
const result = service.validate(schema, { description: '漏水' });
expect(result.valid).toBe(false);
expect(result.errors).toContainEqual(
  expect.objectContaining({ field: 'title' }),
);
```

- [ ] **Step 2: 实现 text/textarea/select/date/phone 校验**

- [ ] **Step 3: 测试通过**

---

### Task 7: 工单 CRUD — 暂存与提交（无流程）

**Files:**
- Create: `src/modules/runtime/workorder.controller.ts`
- Create: `src/modules/runtime/workorder.service.ts`
- Create: `src/modules/runtime/dto/create-workorder.dto.ts`
- Test: `test/workorder-draft.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `WorkorderService.createDraft(dto, userId): Promise<WorkorderDetailDto>`
  - `WorkorderService.getById(id): Promise<WorkorderDetailDto>`
  - `WorkorderService.getByNo(no): Promise<WorkorderDetailDto>`
  - `WorkorderService.list(query, userId): Promise<Paginated<WorkorderListItemDto>>`
- API:
  - `POST /api/v1/workorders/draft`
  - `GET /api/v1/workorders/:id`
  - `GET /api/v1/workorders/no/:workorderNo`
  - `GET /api/v1/workorders?status=&type_code=&keyword=`

- [ ] **Step 1: draft e2e 测试**

```typescript
const res = await request(app.getHttpServer())
  .post('/api/v1/workorders/draft')
  .set('Authorization', 'Bearer dev-token-change-me')
  .set('X-User-Id', 'user_resident')
  .send({
    type_code: 'REPAIR',
    title: '卫生间漏水',
    description: '3栋501漏水',
    contact_phone: '13800138000',
  })
  .expect(201);
expect(res.body.data.status).toBe('DRAFT');
expect(res.body.data.workorder_no).toMatch(/^WO/);
```

- [ ] **Step 2: 实现 createDraft** — 校验 schema，status=DRAFT，写 WorkorderEvent `DRAFT_CREATED`

- [ ] **Step 3: get/list e2e 测试并实现**

- [ ] **Step 4: 运行 e2e**

Expected: PASS

---

### Task 8: 轻量流程引擎

**Files:**
- Create: `src/modules/runtime/flow-engine/flow-definition.types.ts`
- Create: `src/modules/runtime/flow-engine/flow-engine.service.ts`
- Test: `src/modules/runtime/flow-engine/flow-engine.service.spec.ts`

**Interfaces:**
- Types:
```typescript
type FlowNodeType = 'start' | 'task' | 'end';
interface FlowNode {
  key: string;
  type: FlowNodeType;
  name?: string;
  next?: string;
  assignee_rule?: 'creator' | 'assignee' | 'fixed_user' | 'dispatch_rule';
  fixed_user_id?: string;
}
interface FlowDefinition {
  flow_key: string;
  nodes: FlowNode[];
}
```
- Produces:
  - `FlowEngineService.start(definition, context): { currentNode, tasks }`
  - `FlowEngineService.completeTask(definition, currentNodeKey): { nextNode, done: boolean }`
  - `FlowEngineService.resolveAssignee(node, context): string` // userId

- [ ] **Step 1: 测试 start 从 start 节点推进到第一个 task**

- [ ] **Step 2: 测试 completeTask 串行到 end 返回 done=true**

- [ ] **Step 3: resolveAssignee: creator → context.creatorId, fixed_user → node.fixed_user_id**

Seed flow `repair_flow`: start → dispatch(task, fixed_user_id=user_staff) → handle(same) → end

---

### Task 9: 工单提交 + 流程实例 + 首任务

**Files:**
- Modify: `workorder.service.ts` — 添加 `submit(id, userId)`
- Create: `src/modules/runtime/flow-instance.service.ts`
- Test: `test/workorder-submit.e2e-spec.ts`

**Interfaces:**
- Produces: `WorkorderService.submit(workorderId, userId): Promise<WorkorderDetailDto>`
- 行为:
  1. 校验 status=DRAFT
  2. 再次 form validate
  3. 加载 type.defaultFlowKey → FlowTemplate.definition
  4. 创建 FlowInstance status=RUNNING
  5. FlowEngine.start → 创建首个 JobTask PENDING
  6. Workorder status=IN_PROGRESS
  7. WorkorderEvent `SUBMITTED`

- [ ] **Step 1: e2e — draft 后 submit，返回 flow 进度含 current_task**

- [ ] **Step 2: 实现 submit**

- [ ] **Step 3: GET workorder 详情含 `flow: { status, current_node, tasks[] }`**

Expected: PASS

---

### Task 10: 任务处理 — 完成、驳回、转交

**Files:**
- Create: `src/modules/runtime/task.controller.ts`
- Create: `src/modules/runtime/task.service.ts`
- Test: `test/task.e2e-spec.ts`

**Interfaces:**
- API:
  - `GET /api/v1/tasks/todo`
  - `POST /api/v1/tasks/:id/complete` body: `{ comment?: string }`
  - `POST /api/v1/tasks/:id/reject` body: `{ comment?: string, target_node_key?: string }`
  - `POST /api/v1/tasks/:id/transfer` body: `{ assignee_id: string, comment?: string }`
- Produces:
  - `TaskService.complete(taskId, userId, dto)`
  - complete 后若流程结束 → Workorder status=COMPLETED

- [ ] **Step 1: e2e — user_staff complete dispatch task，产生 handle task**

- [ ] **Step 2: e2e — complete 所有 task 后 workorder COMPLETED**

- [ ] **Step 3: transfer 测试 — assignee 变更**

- [ ] **Step 4: reject 测试 — 回到上一节点（第一版仅支持回退一个节点）**

Expected: PASS

---

### Task 11: workorder-sdk 客户端

**Files:**
- Create: `packages/workorder-sdk/src/types.ts`
- Create: `packages/workorder-sdk/src/client.ts`
- Test: `packages/workorder-sdk/src/client.test.ts`

**Interfaces:**
- Produces:
```typescript
export class WorkorderClient {
  constructor(opts: { baseUrl: string; token: string; userId?: string });
  listTypes(): Promise<WorkorderType[]>;
  getFormSchema(code: string): Promise<FormSchema>;
  createDraft(input: CreateWorkorderInput): Promise<Workorder>;
  submit(id: string): Promise<Workorder>;
  get(id: string): Promise<Workorder>;
  getByNo(no: string): Promise<Workorder>;
  listTasksTodo(): Promise<JobTask[]>;
  completeTask(id: string, comment?: string): Promise<void>;
}
```

- [ ] **Step 1: 用 mock fetch 测试 client 组装 headers**

- [ ] **Step 2: 实现 client 全部方法**

---

### Task 12: MCP Server

**Files:**
- Create: `packages/workorder-mcp/src/index.ts`
- Create: `packages/workorder-mcp/src/tools/*.ts` (10 tools)
- Test: `packages/workorder-mcp/test/tools.test.ts`

**Interfaces:**
- Consumes: `WorkorderClient` from Task 11
- Env: `WORKORDER_API_BASE`, `WORKORDER_API_TOKEN`, `WORKORDER_DEFAULT_USER_ID`
- Produces MCP tools per spec section 6.2

- [ ] **Step 1: 注册 `workorder_list_types` tool，调用 client.listTypes()**

```typescript
server.tool('workorder_list_types', '列出可用工单类型', {}, async () => {
  const types = await client.listTypes();
  return { content: [{ type: 'text', text: JSON.stringify(types, null, 2) }] };
});
```

- [ ] **Step 2: 实现其余 9 个 tools**

- [ ] **Step 3: `workorder_submit` 映射自然语言字段到 API body**

```typescript
// input: { type_code, title, description, contact_phone, extra_fields? }
await client.createDraft({ ... });
const submitted = await client.submit(draft.id);
```

- [ ] **Step 4: 集成测试（API 运行中）手动验证 MCP list_tools**

```bash
pnpm dev:api &
pnpm dev:mcp
```

Expected: MCP 返回 10 tools

---

### Task 13: Skill 包

**Files:**
- Create: `packages/workorder-skill/SKILL.md`

**Interfaces:**
- Documents: 触发词、标准流程、REPAIR/CLEANING 字段说明、错误处理、MCP 环境变量

- [ ] **Step 1: 编写 SKILL.md**，包含:

```markdown
---
name: workorder-agent
description: 物业智能工单 Agent 技能。用户报修、查进度、处理待办时，通过 workorder MCP 工具操作工单服务。
---

## 标准流程
1. workorder_list_types
2. workorder_get_form_schema
3. 收集缺失必填字段
4. workorder_submit 或 workorder_create_draft

## REPAIR 必填
- title, description, contact_phone

## 查询
- 有单号 → workorder_get(workorder_no=...)
- 无单号 → workorder_list(keyword=...)
```

- [ ] **Step 2: 在 README 根目录添加 MCP 安装示例**

```json
{
  "mcpServers": {
    "workorder": {
      "command": "node",
      "args": ["packages/workorder-mcp/dist/index.js"],
      "env": {
        "WORKORDER_API_BASE": "http://localhost:3000/api/v1",
        "WORKORDER_API_TOKEN": "dev-token-change-me"
      }
    }
  }
}
```

---

### Task 14: 端到端验收脚本

**Files:**
- Create: `scripts/e2e-agent-flow.sh` 或 `scripts/e2e-agent-flow.mjs`

- [ ] **Step 1: 脚本流程**

1. `GET /workorder-types` → REPAIR
2. `GET /form-schema` → 字段列表
3. `POST /workorders/draft` → id
4. `POST /workorders/:id/submit`（若 submit 独立 endpoint）或 service 内 submit
5. `GET /tasks/todo` as user_staff → task id
6. `POST /tasks/:id/complete` × N until COMPLETED
7. `GET /workorders/:id` → status COMPLETED

- [ ] **Step 2: 文档写入 `packages/workorder-api/README.md` 运行说明**

---

## Spec Coverage Self-Review

| Spec 要求 | Task |
|-----------|------|
| 自研不依赖 NexField | 全部 |
| WorkorderType + FormField | Task 2, 4 |
| 轻量 JSON 状态机 | Task 8, 9 |
| 暂存/提交/查询 | Task 7, 9 |
| 待办/完成/转交 | Task 10 |
| MCP 10 tools | Task 12 |
| Skill 包 | Task 13 |
| API Key + X-User-Id | Task 3 |
| 单号 WO{date}{seq} | Task 5 |
| REPAIR + CLEANING 种子 | Task 2 |
| config/summary | Task 4 |
| 响应格式 {code,data} | Task 3 |

**延后（B3+，本计划不含）:** 派单规则引擎、SLA 超时、计划工单、配置发布 UI、开放应用、管理后台 Web

---

## 建议执行顺序

```
Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14
```

预估：14 个 task，每个 30–90 分钟，合计约 2–3 个工作日（单人）。
