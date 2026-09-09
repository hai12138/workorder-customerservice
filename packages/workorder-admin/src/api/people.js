/**
 * 员工口径（已定稿，写入 Tab 过滤）
 * - 员工：identity ∈ {管理员, 物管人员, 员工}（注意是「物管人员」，不是「管家人员」）
 * - 排除：{业主, 租户}
 * - status：有效 | 停用
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
