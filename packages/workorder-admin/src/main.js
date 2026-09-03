import './prototype.css'
import { LOGIN_USERS, getSession } from './store/session.js'
import { login } from './api/auth.js'
import { loadBootstrap } from './store/app-state.js'
import { ApiError } from './api/http.js'

function showToast(message) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2200)
}

function renderLogin() {
  document.title = '登录 · Astra Service OS'
  document.body.innerHTML = `
    <div class="login-page">
      <section class="login-card">
        <div class="brand-mark">A</div>
        <h1>Astra Service OS</h1>
        <p>物业服务运营管理台 · 定稿 UI 已接真实鉴权</p>
        <label>
          <span>账号</span>
          <select id="login-user">
            ${LOGIN_USERS.map((u) => `<option value="${u.id}">${u.name}（${u.id}）</option>`).join('')}
          </select>
        </label>
        <label>
          <span>密码</span>
          <input id="login-password" type="password" value="dev" placeholder="开发口令 dev" />
        </label>
        <button class="btn primary" id="login-submit" type="button">进入工作台</button>
        <small>调用 POST /api/v1/auth/login · 需先启动 pnpm dev:api</small>
      </section>
    </div>
  `

  const submit = async () => {
    const btn = document.getElementById('login-submit')
    if (btn) btn.disabled = true
    try {
      const userId = /** @type {HTMLSelectElement} */ (document.getElementById('login-user')).value
      const password = /** @type {HTMLInputElement} */ (document.getElementById('login-password')).value
      await login(userId, password)
      showToast('登录成功，正在加载工作台…')
      location.reload()
    } catch (error) {
      showToast(error instanceof ApiError || error instanceof Error ? error.message : '登录失败')
    } finally {
      if (btn) btn.disabled = false
    }
  }

  document.getElementById('login-submit')?.addEventListener('click', () => void submit())
  document.getElementById('login-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void submit()
  })
}

async function bootApp() {
  try {
    await loadBootstrap()
    await import('./prototype-main.js')
  } catch (error) {
    document.body.innerHTML = `
      <div class="login-page">
        <section class="login-card">
          <div class="brand-mark">!</div>
          <h1>工作台加载失败</h1>
          <p>${error instanceof Error ? error.message : '未知错误'}</p>
          <button class="btn primary" id="retry-boot" type="button">重试</button>
          <button class="btn" id="back-login" type="button">返回登录</button>
        </section>
      </div>`
    document.getElementById('retry-boot')?.addEventListener('click', () => location.reload())
    const { clearSession } = await import('./store/session.js')
    document.getElementById('back-login')?.addEventListener('click', () => {
      clearSession()
      location.reload()
    })
  }
}

if (getSession()?.token) {
  void bootApp()
} else {
  renderLogin()
}
