# 定稿 UI 逐业务对接实施计划

> 执行副本。权威分期说明见 Cursor plan；本文件供仓库内追溯。

**Goal:** 保持原型 UI 不变，按 P0–P6 把 Mock 换成真实 API。

**Architecture:** `api/` + `store/` + `adapters/`；`prototype-main.js` 只换数据源与动作。

## 分期

| 期 | 内容 |
|----|------|
| P0 | JWT 登录、proxy、session |
| P1 | 项目/空间/用户/角色 |
| P2 | 类型/字段/流程/派单/计划 |
| P3 | 配置发布 |
| P4 | 总览/工单/消息/异常 |
| P5 | 通知中心 |
| P6 | Agent |

## 验收记录

- 2026-09-03：P0–P6 已在仓库落地（JWT 登录、bootstrap 驱动 28 页、写操作接 collections/commands/notify/agent）。请本地 `pnpm dev:api` + `pnpm dev:admin` 按期验收。
