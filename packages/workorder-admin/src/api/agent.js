import { api } from './http.js'
import { getProjectId } from '../store/session.js'

export const agentApi = {
  tools: () => api('/mcp-tools'),
  skills: () => api('/skills'),
  apps: () => api('/agent-apps'),
  logs: () => api('/agent-logs'),
  publish: (version) =>
    api('/agent/capabilities/publish', { method: 'POST', body: JSON.stringify({ version }) }),
  sandboxSubmit: (draft) =>
    api('/agent/sandbox/submit-draft', {
      method: 'POST',
      body: JSON.stringify({
        projectId: getProjectId(),
        idempotencyKey: `idem_${Date.now()}`,
        draft,
      }),
    }),
}
