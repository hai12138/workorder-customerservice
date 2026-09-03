---
name: workorder-agent
description: 物业智能工单 Agent 技能。用户报修、查进度、处理待办时，通过 workorder MCP 工具操作工单服务。适用于微信公众号 H5 对话 Agent 或 Cursor Agent。
---

# 物业智能工单 Agent

## 何时使用

- 用户要**报修、保洁、巡检、维护**等 → 创建工单
- 用户要**查进度、查单号** → 查询工单
- 物业员工要**处理待办、审批、转交** → 操作任务

## MCP 连接

环境变量：

| 变量 | 说明 |
|------|------|
| `WORKORDER_API_BASE` | 如 `http://localhost:3000/api/v1` |
| `WORKORDER_API_TOKEN` | API Key |
| `WORKORDER_DEFAULT_USER_ID` | 默认用户，如 `user_resident` |

## 标准建单流程

1. `workorder_list_types` — 确认可用类型
2. `workorder_get_form_schema` — 获取必填字段
3. 向用户收集缺失必填项（不要猜测）
4. `workorder_submit` — 提交工单

若信息不全，先用 `workorder_create_draft` 暂存，补全后再提交。

## 工单类型说明

### REPAIR（客服报修）

必填：`title`、`description`、`contact_phone`

示例话术：「请描述问题位置和现象，并留下联系电话。」

### CLEANING（环境保洁）

必填：`title`、`description`

## 查询策略

- 有单号 → `workorder_get(workorder_no=...)`
- 无单号 → `workorder_list(keyword=...)` 或按用户身份列表
- 物业员工待办 → `workorder_list_tasks(user_id=user_staff)`

## 处理待办

1. `workorder_list_tasks`
2. 确认任务属于当前用户
3. `workorder_complete_task` 或 `workorder_transfer_task`

## 边界与错误处理

- **不可**跳过必填字段强行提交
- **不可**代他人审批（除非明确转交）
- 收到校验错误时，用自然语言告诉用户缺什么
- 工单已结束时不应再提交处理

## 配置版本

开始前可调用 `workorder_get_config_summary` 确认配置已发布。
