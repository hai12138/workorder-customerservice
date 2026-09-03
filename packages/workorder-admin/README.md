# Astra Service OS 前端（唯一前端）

定稿原型 UI + 真实 API 对接（P0–P6）。

## 启动

需同时开 API：

```bash
pnpm dev:api
pnpm dev:admin
```

打开 `http://127.0.0.1:5173`，账号如 `admin`，密码 `dev`。

## 结构

- `src/main.js` — 登录门禁
- `src/api/` — HTTP / auth / workbench / notify / agent
- `src/store/` — session + bootstrap 缓存
- `src/adapters/` — 页面渲染（保持原型 class）
- `src/prototype-main.js` — 壳交互与 data-action

## 验证

```bash
pnpm --filter workorder-admin test
pnpm --filter workorder-admin build
```
