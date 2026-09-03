import { api } from './http.js'
import { setSession, getSession, setProjectId } from '../store/session.js'

/**
 * @param {string} userId
 * @param {string} password
 */
export async function login(userId, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ userId, password }),
  })
  const projectId = data.user?.projectIds?.[0] || ''
  setSession({
    token: data.token,
    user: {
      id: data.user.id,
      name: data.user.name,
      identity: data.user.identity,
      role: data.user.role || data.user.identity,
      projectIds: data.user.projectIds || [],
      permissions: data.user.permissions || [],
    },
    projectId,
  })
  return getSession()
}

export async function fetchMe() {
  return api('/auth/me')
}

export { setProjectId }
