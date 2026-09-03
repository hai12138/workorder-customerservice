# 前端架构说明

## 唯一前端

`packages/workorder-admin` 是本仓库唯一 Web 前端。

```text
main.js (JWT 登录)
  → loadBootstrap()
  → prototype-main.js + adapters/pages.js + prototype-shell/css
```

## 适配层

- `api/http.js` — `/api/v1` + Bearer + `{code,data}` 解包
- `api/auth|workbench|notify|agent.js` — 领域请求
- `store/session.js` — token / user / projectId
- `store/app-state.js` — bootstrap 缓存
- `adapters/pages.js` — 保持原型 class 的页面 HTML

## 后端

以 Workbench bootstrap / collections / commands、Notify、Agent 为主；开发口令与 seed 一致为 `dev`。
