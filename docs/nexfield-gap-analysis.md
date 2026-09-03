# NexField OS 物业工单模块 — 深度分析与差距对照

> 分析来源：`https://os.nexfield.top/aiot/web` 前端 SPA 静态资源（`probe/` 目录）  
> 说明：登录页含点选验证码，无法进入已登录态；以下基于 `routesList`、各业务 chunk、API 路径逆向，**与线上一致度约 85%+**。

---

## 1. NexField 是什么

NexField OS 是一个 **企业级 AI 运营平台**，工单只是其中「物业 AI 客服」子模块。

- 顶层还有：Agent Service、Parse Service、Search Service 等 AI 能力入口
- 物业工单入口路径：`/property-ai-customer-service/*`
- 宿主壳：Vue3 + Element Plus + 微前端式路由（`routesList.-QFJtlwV.js` 注入物业菜单）

**我们当前实现**：独立的 NestJS API + 7 页简化 Admin，**没有** NexField 的平台壳、登录体系、RBAC、JsonFlow 设计器。

---

## 2. 完整菜单结构（NexField v7）

NexField 物业模块共 **6 个一级分组、24 个页面**：

| 一级菜单 | 子页面 | 路由前缀 |
|---------|--------|---------|
| **运营总览** | 运营总览 | `/operations-overview` |
| **基础配置** | 项目管理、空间管理、用户与员工、角色权限、移动端身份、上线检查 | `/projects` … `/launch-check` |
| **工单配置** | 配置总览、工单类型、表单字段、流程与 SLA、派单规则、通知模板、计划工单、配置版本与发布 | `/config` … `/config-publish` |
| **消息通知** | 消息中心、通知投递记录 | `/messages`、`/deliveries` |
| **工单管理** | 工单台账 | `/workorders` |
| **异常中心** | 异常列表 | `/exceptions` |
| **开放应用** | 应用管理、调用记录 | `/apps`、`/app-calls` |

**我们当前 Admin**：仅 7 页，且全部平铺在侧边栏，**缺少 17+ 页面**。

---

## 3. 工单类型体系

NexField 按 **业务分组** 组织工单（`flow-application` chunk）：

| 分组 | 排序权重 | 典型流程 |
|------|---------|---------|
| 访客通行 | 10 | visitor 类 |
| 客服报修 | 20 | repair_flow |
| 秩序巡查 | 30 | inspection |
| 环境保洁 | 40 | cleaning_plan_flow |
| 工程维护 | 50 | maintenance |
| 示例工单 | 900 | demo |

发起页还有：**待我审批、我的申请、抄送我的、待认领、我审批的** 五个工作台入口。

**我们当前**：仅 REPAIR、CLEANING 两种 seed 类型；无分组卡片 UI；无抄送/认领/待办工作台。

---

## 4. 核心技术差异

### 4.1 流程引擎 — JsonFlow（最大差距）

NexField 使用 **JsonFlow 可视化流程设计器**（`flow-design.DyvMC6_h.js` + `jsonflow.*` API）：

- 画布拖拽：基础节点 / 高级节点 / 泳道
- 简单模式 ↔ 专业模式
- 串行网关、并行网关、条件连线
- 节点任务属性：参与者、驳回节点、消息通知、待分配参与者
- 版本管理：暂存(-1) / 发布(1) / 升版本
- 可选 **AI 辅助设计**（`/jsonflow/ai/generate/availability`）
- 运行态 API：`/jsonflow/run-flow/*`（complete、terminate、remind、recall-reset…）

**我们当前**：手写 JSON 线性状态机（start → task → task → end），**无可视化设计、无网关、无并行、无催办/作废/提前结束**。

### 4.2 派单与排班

NexField 派单相关 API：

- 班组 CRUD：`/space/schedule/team/*`（page/list/post/put/delete）
- 班次 CRUD：`/space/schedule/shift/*`
- 流程规则：`/jsonflow/flow-rule/*`（与物业 dispatch-rules 页面配合）
- 计划工单执行策略：`ON_DUTY_TEAM`（按触发时间匹配值班班组）+ `FIXED_TEAM` + 兜底班组

**我们当前**：

- 有 Team/Shift 表和 seed，但 **Admin 无班组/班次管理页**
- 派单引擎仅 `FIXED_TEAM`，**未实现 ON_DUTY_TEAM 按班次匹配**
- 派单规则页 **只读**，不能在草稿里编辑

### 4.3 计划工单

NexField `work-plan.DRY1kESu.js` 完整能力：

- 分页列表 + 筛选（名称/类型/状态）
- 新增/编辑 Dialog（860px）：计划编码、类型（巡检/清洁/保养）、模板 KEY
- 调度模式：每天 / 每周 / 每月 / 固定间隔 / 高级 Cron
- 空间路线、楼栋 ID、资产编号
- 执行策略：值班班组 / 固定班组 + 班次选择 + 兜底班组
- SLA 小时、失败转人工、异常子流程 KEY
- 高级 JSON 折叠面板（spaceScope/assetScope/executorPolicy…）
- 手动触发 + **执行记录 Drawer**（70% 宽，含派工快照、flowInstId）
- 权限码：`order_work_plan_add/edit/trigger/view/del`

**我们当前**：后端 CRUD + 定时触发已有；Admin **仅列表 + 触发按钮**，无新增/编辑表单、无分页、无执行记录 Drawer。

### 4.4 配置发布

NexField `/property/config-publish` 预期：

- 配置总览页 `/config` 展示各模块就绪状态
- 草稿 vs 已发布 diff 感知
- 与工单类型、字段、流程、派单、SLA、通知 **统一版本**

**我们当前**：仅「创建草稿 → 发布」两个按钮，**不能在 UI 编辑草稿内容**，无 diff、无总览。

### 4.5 消息通知

NexField 独立模块：

- 消息中心 `/messages`
- 通知投递记录 `/deliveries`
- 流程节点可配置 informOthers（消息通知到流程中节点）

**我们当前**：**完全未实现** NotificationTemplate、投递记录。

### 4.6 基础域

NexField 基础配置 6 页：

- 项目管理 `PropertyProjectManagementMakePage`
- 空间管理 `PropertySpaceManagementMakePage`
- 用户与员工 `PropertyUserManagementMakePage`
- 角色权限 `PropertyRolePermissionMakePage`
- 移动端身份
- 上线检查（launch-check，配置就绪清单）

**我们当前**：3 个 seed 用户 + 1 个班组；**无项目/空间/角色/上线检查**。

### 4.7 工单台账

NexField 台账页预期（`/property/workorders`）：

- 与 JsonFlow 运行实例关联（runApplicationId、flowInstId）
- 多维度筛选、导出
- 工单详情含流程图、审批时间线、评论（`/jsonflow/comment/*`）

**我们当前**：简单表格 5 列，无详情页、无流程图、无评论。

### 4.8 开放应用

- 应用管理 + API 调用记录
- 对外 Open API 鉴权

**我们当前**：仅 Bearer Token，**无应用注册/调用审计**。

---

## 5. API 路径对照（节选）

| 领域 | NexField | 我们 |
|------|----------|------|
| 计划工单 | `GET /order/work-plan/page` | `GET /admin/work-plans`（无分页） |
| 班组 | `GET /space/schedule/team/page` | 无 API |
| 班次 | `GET /space/schedule/shift/list` | 无 API |
| 流程定义 | `GET /jsonflow/def-flow/page` | 配置内 JSON |
| 流程运行 | `PUT /jsonflow/run-flow/complete` | `POST /tasks/:id/complete` |
| 派单规则 | property 页 + flow-rule | `GET /admin/dispatch-rules`（只读） |
| 交接 | `POST /order/handover-flow/*` | 无 |
| 配置发布 | property config-publish 页 | `POST /admin/config/publish` |

---

## 6. UI/UX 差距

| 维度 | NexField | 我们 |
|------|----------|------|
| 布局 | 平台级侧边栏 + 面包屑 + 权限按钮 | 简易 dark sidebar |
| 列表 | 分页 + 筛选 + 导出 + 操作 Tooltip | 全量拉取 50 条 |
| 表单 | Dialog/Drawer + 级联选择 + 校验 | 几乎无表单 |
| 流程 | 可视化设计器 + 流程图预览 | 无 |
| 权限 | `@auth` 指令 + 按钮级权限码 | 无 RBAC |
| 登录 | OAuth + 验证码 + 多租户 | 硬编码 Token |

---

## 7. 差距量化（粗估）

| 模块 | NexField 完成度参考 | 我们当前 | 缺口 |
|------|-------------------|---------|------|
| 基础配置 | 100% | ~5% | 95% |
| 工单配置 | 100% | ~25% | 75% |
| 消息通知 | 100% | 0% | 100% |
| 工单管理 | 100% | ~15% | 85% |
| 异常中心 | 100% | ~30% | 70% |
| 开放应用 | 100% | 0% | 100% |
| 流程引擎 | JsonFlow 全功能 | 线性 JSON | ~80% |
| **整体 Admin** | — | — | **~70–80%** |

后端领域逻辑（派单/SLA/计划）约 **40% 对齐**，UI 约 **15% 对齐**。

---

## 8. 建议对齐路线（分阶段）

### Phase A — Admin 信息架构对齐（1–2 周）

1. 按 NexField 6 组菜单重构路由与 Layout
2. 运营总览：接入真实图表（工单量、SLA 超时、计划执行成功率）
3. 工单台账：详情 Drawer（基本信息 + 任务时间线 + 事件流水）

### Phase B — 工单配置可编辑（2–3 周）

1. 工单类型 CRUD + 表单字段可视化编辑（绑定草稿 configVersion）
2. 派单规则 CRUD（含 ON_DUTY_TEAM + 班次）
3. SLA 策略 CRUD（按 type + nodeKey）
4. 计划工单完整表单（对齐 NexField Dialog 字段）
5. 配置发布：草稿编辑 + 版本对比

### Phase C — 基础域（2 周）

1. 项目 / 空间 / 用户 / 班组 / 班次 Admin
2. 上线检查页（配置项 checklist）

### Phase D — 流程升级（3–4 周，可选）

- 方案 1：集成 JsonFlow 设计器（工作量大，与 NexField 最接近）
- 方案 2：保留轻量 JSON，但增加网关/并行/可视化只读预览

### Phase E — 消息 & 开放应用（按需）

- 通知模板 + 投递记录
- Open App 注册与调用审计

---

## 9. 结论

您看到的「差太多」是准确的：**当前实现是 B 阶段 MVP（API + MCP 可用），不是 NexField 物业后台的 UI/功能复刻**。

- **已对齐**：核心概念（ConfigVersion、DispatchRule、SlaPolicy、WorkPlan、Exception）、部分 API 语义、计划工单调度思路
- **未对齐**：24 页中的 ~17 页、JsonFlow 流程设计器、基础域、通知、开放应用、RBAC、列表/表单交互细节

若目标是 **「看起来像、用起来像 NexField」**，建议从 **Phase A + B** 开始，优先把「工单配置」8 页和「计划工单」表单做完整。
