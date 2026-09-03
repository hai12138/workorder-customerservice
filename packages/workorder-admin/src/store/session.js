/** Session: JWT + user + current projectId */

export const AUTH_KEY = 'astra-service-os:session'

/** Login picker labels (ids must exist in seed). */
export const LOGIN_USERS = [
  { id: 'admin', name: '项目管理员' },
  { id: 'zhaoqing', name: '赵晴' },
  { id: 'chenbin', name: '陈斌' },
  { id: 'linzhou', name: '林舟' },
  { id: 'linyue', name: '林悦' },
]

export function getSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession(session) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(session))
}

export function clearSession() {
  sessionStorage.removeItem(AUTH_KEY)
}

export function getToken() {
  return getSession()?.token || ''
}

export function getProjectId() {
  return getSession()?.projectId || ''
}

export function setProjectId(projectId) {
  const s = getSession()
  if (!s) return
  setSession({ ...s, projectId })
}
