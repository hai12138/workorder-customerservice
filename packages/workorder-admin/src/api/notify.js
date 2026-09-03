import { api } from './http.js'
import { getProjectId } from '../store/session.js'

function q(path) {
  const pid = getProjectId()
  if (!pid) return path
  return `${path}${path.includes('?') ? '&' : '?'}projectId=${encodeURIComponent(pid)}`
}

export const notifyApi = {
  policies: () => api(q('/notify-policies')),
  createPolicy: (body) =>
    api('/notify-policies', { method: 'POST', body: JSON.stringify({ ...body, projectId: getProjectId() }) }),
  templates: () => api(q('/wechat-templates')),
  bindings: () => api(q('/channel-bindings')),
  deliveries: () => api(q('/deliveries')),
  failures: () => api(q('/failures')),
  retryFailure: (id) => api(`/failures/${encodeURIComponent(id)}/retry`, { method: 'POST', body: '{}' }),
  wechatIntegration: () => api(q('/wechat-integration')),
  putWechatIntegration: (body) =>
    api('/wechat-integration', {
      method: 'PUT',
      body: JSON.stringify({ ...body, projectId: getProjectId() }),
    }),
}
