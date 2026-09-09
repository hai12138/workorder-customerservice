/** People API — GET/POST/PUT /api/v1/people. bootstrap records('people') is fallback only. */

import { api, ApiError } from './http.js'
import { getProjectId } from '../store/session.js'

/**
 * 员工口径（暂定，以后端 PR 定稿为准）
 * identity ∈ {管理员, 物管人员, 员工}；列表排除 {业主, 租户}
 */
export const STAFF_IDENTITIES = ['管理员', '物管人员', '员工']
export const EXCLUDED_IDENTITIES = ['业主', '租户']
export const PERSON_STATUSES = ['有效', '停用']
export const DEFAULT_STAFF_IDENTITY = '物管人员'

export function isStaffIdentity(identity) {
  const value = String(identity || '')
  if (EXCLUDED_IDENTITIES.includes(value)) return false
  return STAFF_IDENTITIES.includes(value)
}

export function personApiMessage(err, actionLabel) {
  if (err?.status === 404) {
    return `${actionLabel}尚未就绪（/api/v1/people），请确认后端员工接口 PR 已合并`
  }
  return err?.message || `${actionLabel}失败`
}

/** data 可能是数组或 { items, total } */
export function unwrapPeopleList(data) {
  if (Array.isArray(data)) return { items: data, total: data.length }
  if (data && Array.isArray(data.items)) {
    return { items: data.items, total: Number(data.total ?? data.items.length) }
  }
  if (data && Array.isArray(data.records)) {
    return { items: data.records, total: Number(data.total ?? data.records.length) }
  }
  return { items: [], total: 0 }
}

export function toPersonRecord(item) {
  if (!item) return null
  const identity = item.values?.identity || item.identity || '—'
  const name = item.title || item.name || item.values?.name || '—'
  const phone = item.values?.phone || item.phone || (item.subtitle && item.subtitle !== identity ? item.subtitle : '') || ''
  return {
    id: item.id,
    title: name,
    subtitle: phone || identity,
    status: item.status || '—',
    tone: item.tone,
    values: {
      identity,
      project: item.values?.project || item.project || '—',
      space: item.values?.space || item.space || '—',
      channel: item.values?.channel || item.channel || '—',
      phone,
      name,
    },
  }
}

export async function listPeople({ projectId, status, q } = {}) {
  const pid = projectId || getProjectId()
  if (!pid) throw new ApiError('项目ID不能为空', 400)
  const params = new URLSearchParams()
  params.set('projectId', pid)
  if (status && status !== '全部' && status !== '全部状态') params.set('status', status)
  if (q) params.set('q', q)
  const data = await api(`/people?${params.toString()}`)
  const { items, total } = unwrapPeopleList(data)
  return {
    items: items.map(toPersonRecord).filter(Boolean),
    total,
    source: 'api',
  }
}

export async function createPerson({ projectId, name, phone, identity } = {}) {
  const pid = projectId || getProjectId()
  return api('/people', {
    method: 'POST',
    body: JSON.stringify({
      projectId: pid,
      name,
      phone: phone || '',
      identity: identity || DEFAULT_STAFF_IDENTITY,
    }),
  })
}

export async function updatePerson(id, patch) {
  return api(`/people/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch || {}),
  })
}
