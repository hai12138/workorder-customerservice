/**
 * U1 唯一主路径：/api/v1/people
 * 员工口径：identity ∈ {管理员, 物管人员, 员工}（不是「管家人员」）；排除 {业主, 租户}
 * status：有效 | 停用
 * bootstrap records('people') 仅 GET 失败兜底。
 */

import { api, ApiError } from './http.js'
import { getProjectId } from '../store/session.js'

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

/** 契约 data 为数组；兼容 { items } 以免后端信封差异。 */
export function unwrapPeopleList(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  return []
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
  const items = unwrapPeopleList(data).map(toPersonRecord).filter(Boolean)
  return { items, source: 'api' }
}

export async function createPerson({ projectId, name, phone, identity } = {}) {
  const pid = projectId || getProjectId()
  const body = {
    projectId: pid,
    name,
    identity: identity || DEFAULT_STAFF_IDENTITY,
  }
  if (phone) body.phone = phone
  return api('/people', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updatePerson(id, patch) {
  return api(`/people/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch || {}),
  })
}
