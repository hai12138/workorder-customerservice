import { api } from './http.js'
import { getProjectId } from '../store/session.js'

function withProject(path, projectId) {
  const pid = projectId || getProjectId()
  if (!pid) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}projectId=${encodeURIComponent(pid)}`
}

export async function bootstrap(projectId) {
  return api(withProject('/workbench/bootstrap', projectId))
}

export async function catalog(name, projectId) {
  return api(withProject(`/catalog/${name}`, projectId))
}

export async function createRecord(name, input, projectId) {
  const pid = projectId || getProjectId()
  return api(`/workbench/collections/${name}`, {
    method: 'POST',
    body: JSON.stringify({ ...input, projectId: pid }),
  })
}

export async function runCommand(body) {
  const projectId = body.projectId || getProjectId()
  return api('/workbench/commands', {
    method: 'POST',
    body: JSON.stringify({ ...body, projectId }),
  })
}

export async function dashboardSummary(projectId) {
  return api(withProject('/dashboard/summary', projectId))
}

export async function configDiff(projectId) {
  return api(withProject('/config/diff', projectId))
}

export async function createDraft(projectId) {
  return api('/config/draft', {
    method: 'POST',
    body: JSON.stringify({ projectId: projectId || getProjectId() }),
  })
}

export async function publishConfig(version = 'V4', projectId) {
  return api('/config/publish', {
    method: 'POST',
    body: JSON.stringify({ version, projectId: projectId || getProjectId() }),
  })
}

export async function getFlow(key, projectId) {
  return api(withProject(`/flows/${encodeURIComponent(key)}`, projectId))
}

export async function putFlow(key, body) {
  return api(`/flows/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...body, projectId: body.projectId || getProjectId() }),
  })
}

export async function getSlaPolicies(projectId) {
  return api(withProject('/sla-policies', projectId))
}

export async function putSlaPolicies(policies, projectId) {
  return api('/sla-policies', {
    method: 'PUT',
    body: JSON.stringify({ policies, projectId: projectId || getProjectId() }),
  })
}

export async function assignWorkorder(id, assignee) {
  return runCommand({ type: 'assign-workorder', id, assignee })
}

export async function updateProject(id, data) {
  return api(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function stopProject(id) {
  return api(`/projects/${id}/stop`, {
    method: 'POST',
  })
}

export async function deleteProject(id) {
  return api(`/projects/${id}`, {
    method: 'DELETE',
  })
}
