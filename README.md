# Workorder Customer Service

自研物业工单服务 + MCP/Skill，供智能客服 Agent 调用。

## 结构

- `packages/workorder-api` — NestJS 工单 API（派单引擎、SLA、计划工单、配置发布）
- `packages/workorder-admin` — 唯一 Web 前端（高保真原型定稿 + Mock 登录）
- `packages/workorder-mcp` — MCP Server
- `packages/workorder-skill` — Agent Skill 文档
- `packages/workorder-sdk` — TypeScript 客户端

## 快速开始

详见 **[本地运行启动文档](docs/local-dev.md)**。

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev:api      # http://localhost:3000/api/v1
pnpm dev:admin    # http://localhost:5173
```

## B3 能力

| 模块 | 说明 |
|------|------|
| 派单规则引擎 | 按工单类型/紧急度/空间匹配规则，支持固定班组、兜底班组 |
| SLA 超时 | 任务节点计时，超时写入异常中心，可选转派兜底人 |
| 计划工单 | CRON/手动触发，自动创建并提交工单 |
| 配置发布 | 草稿克隆 → 发布，版本化管理 |
| 管理后台 | 运营总览、台账、规则/SLA/计划、配置发布、异常中心 |

### Admin API（`/api/v1/admin/*`）

- `GET overview` — 运营统计
- `GET dispatch-rules` / `GET sla-policies` — 已发布配置
- `GET|POST work-plans` — 计划工单 CRUD，`POST work-plans/:id/trigger` 手动触发
- `GET config/versions` / `POST config/draft` / `POST config/publish` — 配置发布
- `GET exceptions` / `POST exceptions/:id/resolve` — 异常中心

## MCP 配置（Cursor）

```json
{
  "mcpServers": {
    "workorder": {
      "command": "node",
      "args": ["packages/workorder-mcp/dist/index.js"],
      "env": {
        "WORKORDER_API_BASE": "http://localhost:3000/api/v1",
        "WORKORDER_API_TOKEN": "dev-token-change-me",
        "WORKORDER_DEFAULT_USER_ID": "user_resident"
      }
    }
  }
}
```

构建 MCP：`pnpm --filter workorder-mcp build`

## E2E 验收

```bash
node scripts/e2e-agent-flow.mjs
```
