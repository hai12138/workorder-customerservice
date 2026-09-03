/** Shared HTTP client for /api/v1 with JWT and envelope unwrap. */

import { clearSession, getSession, getToken } from '../store/session.js'

export class ApiError extends Error {
  constructor(message, status = 0, code = -1) {
    super(message)
    this.status = status
    this.code = code
  }
}

/**
 * @param {string} path - e.g. `/auth/login` (no /api/v1 prefix)
 * @param {RequestInit & { auth?: boolean }} [init]
 */
export async function api(path, init = {}) {
  const { auth = true, headers: extra, ...rest } = init
  const headers = {
    'Content-Type': 'application/json',
    ...(extra || {}),
  }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  let res
  try {
    res = await fetch(`/api/v1${path}`, { ...rest, headers })
  } catch {
    throw new ApiError('无法连接后端服务，请确认 API 已启动（pnpm dev:api）', 0)
  }
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    clearSession()
    if (!path.includes('/auth/login')) {
      location.reload()
    }
    throw new ApiError(body.message || '未登录或会话已过期', 401, body.code)
  }
  if (!res.ok || (body.code !== undefined && body.code !== 0)) {
    throw new ApiError(body.message || `请求失败 ${res.status}`, res.status, body.code)
  }
  return body.data !== undefined ? body.data : body
}
