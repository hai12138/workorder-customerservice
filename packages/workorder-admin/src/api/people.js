/**
 * U2 主路径：GET/POST/PUT /api/v1/people
 * GET ?projectId= &scope=staff|users（默认 staff）&status=&q=&identity=
 * staff identity 存库：管理员|物管人员|员工
 * users identity：业主|租户|家属|类型未设置
 * 员工角色展示文案：项目管理员|物业客服|物管人员（双向映射）
 * bootstrap records('people') 仅 GET 失败兜底。
 *
 * U3：GET /people/template?scope= 下载 xlsx；POST /people/import multipart
 * 字段 file + projectId + scope（scope 在 form body，不是 query）。
 *
 * U4：仅 scope=users 写 spaceId：合法 id 绑定；显式 null 清空；省略字段不改。
 * 读 spaceId + spaceLabel + spacePath；未绑 null → —。关系状态/来源只读可 null。
 * space 须属当前 projectId，否则后端 400。
 */

import { api, ApiError } from './http.js'
import { getProjectId, getToken } from '../store/session.js'

export const PEOPLE_SCOPE_STAFF = 'staff'
export const PEOPLE_SCOPE_USERS = 'users'

export const STAFF_IDENTITIES = ['管理员', '物管人员', '员工']
export const USER_IDENTITIES = ['业主', '租户', '家属', '类型未设置']
export const EXCLUDED_IDENTITIES = USER_IDENTITIES
export const PERSON_STATUSES = ['有效', '停用']
export const DEFAULT_STAFF_IDENTITY = '物管人员'
export const DEFAULT_USER_IDENTITY = '类型未设置'
export const ALL_USER_TYPE = '全部类型'
export const ALL_STAFF_ROLE = '全部项目角色'

/** 参考站文案 ↔ 后端 staff identity */
export const STAFF_ROLE_MAP = [
  { label: '项目管理员', api: '管理员' },
  { label: '物业客服', api: '员工' },
  { label: '物管人员', api: '物管人员' },
]

export const STAFF_ROLE_LABELS = STAFF_ROLE_MAP.map((x) => x.label)
export const USER_TYPE_OPTIONS = [ALL_USER_TYPE, ...USER_IDENTITIES]
export const STAFF_ROLE_FILTER_OPTIONS = [ALL_STAFF_ROLE, ...STAFF_ROLE_LABELS]

const PHONE_RE = /^1\d{10}$/

export function isAllFilterIdentity(value, scope) {
  const v = String(value || '')
  if (!v) return true
  return scope === PEOPLE_SCOPE_USERS ? v === ALL_USER_TYPE : v === ALL_STAFF_ROLE
}

export function staffRoleLabel(identity) {
  const value = String(identity || '')
  if (!value || value === '—') return ''
  const hit = STAFF_ROLE_MAP.find((x) => x.api === value || x.label === value)
  return hit?.label || value
}

export function staffRoleApi(identity) {
  const value = String(identity || '')
  if (!value) return DEFAULT_STAFF_IDENTITY
  const hit = STAFF_ROLE_MAP.find((x) => x.label === value || x.api === value)
  return hit?.api || value
}

export function isStaffIdentity(identity) {
  const value = String(identity || '')
  if (!value || USER_IDENTITIES.includes(value)) return false
  return STAFF_IDENTITIES.includes(value) || STAFF_ROLE_LABELS.includes(value)
}

export function isProjectUserIdentity(identity) {
  return USER_IDENTITIES.includes(String(identity || ''))
}

export function scopeFromTab(tab) {
  return tab === 'staff' ? PEOPLE_SCOPE_STAFF : PEOPLE_SCOPE_USERS
}

export function isValidPhone(phone) {
  return PHONE_RE.test(String(phone || '').trim())
}

export function maskPhone(phone) {
  const raw = String(phone ?? '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 11) return `${digits.slice(0, 3)}****${digits.slice(-4)}`
  return raw
}

export function dash(value) {
  if (value == null) return '—'
  const s = String(value).trim()
  return s ? s : '—'
}

export function formatUpdatedAt(value) {
  if (value == null || value === '') return ''
  const raw = String(value)
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function personApiMessage(err, actionLabel) {
  if (err?.status === 404) {
    return `${actionLabel}尚未就绪（/api/v1/people），请确认后端 people U2/U4（scope/spaceId）已合并`
  }
  return err?.message || `${actionLabel}失败`
}

/** 契约 data 为数组；兼容 { items } 以免后端信封差异。 */
export function unwrapPeopleList(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  return []
}

function pick(item, ...keys) {
  for (const key of keys) {
    if (!item) continue
    if (item[key] != null && item[key] !== '') return item[key]
    if (item.values?.[key] != null && item.values[key] !== '') return item.values[key]
  }
  return null
}

export function toPersonRecord(item) {
  if (!item) return null
  const identity = pick(item, 'identity') ?? ''
  const name = pick(item, 'name') ?? item.title ?? ''
  const phone = pick(item, 'phone') ?? (item.subtitle && item.subtitle !== identity ? item.subtitle : '') ?? ''
  return {
    id: item.id,
    title: name || '—',
    subtitle: phone || identity || '—',
    status: item.status || '—',
    tone: item.tone,
    values: {
      name: name || '',
      phone: phone || '',
      identity,
      employeeNo: pick(item, 'employeeNo'),
      teamName: pick(item, 'teamName'),
      roleName: pick(item, 'roleName'),
      onlineStatus: pick(item, 'onlineStatus'),
      spaceId: pick(item, 'spaceId'),
      spaceLabel: pick(item, 'spaceLabel'),
      spacePath: pick(item, 'spacePath'),
      relationStatus: pick(item, 'relationStatus'),
      relationSource: pick(item, 'relationSource'),
      updatedAt: pick(item, 'updatedAt'),
      project: pick(item, 'project', 'projectName') ?? '',
      space: pick(item, 'space', 'spaceLabel'),
      channel: pick(item, 'channel'),
    },
  }
}

export function identityMatchesFilter(actual, selected, scope) {
  if (isAllFilterIdentity(selected, scope)) return true
  const value = String(actual || '')
  if (scope === PEOPLE_SCOPE_USERS) return value === selected
  return staffRoleApi(value) === staffRoleApi(selected) || staffRoleLabel(value) === selected
}

export function applyPeopleClientFilter(list, { scope, keyword, identity } = {}) {
  const scopeKey = scope === PEOPLE_SCOPE_USERS ? PEOPLE_SCOPE_USERS : PEOPLE_SCOPE_STAFF
  let filtered = (list || []).filter((p) =>
    scopeKey === PEOPLE_SCOPE_USERS
      ? isProjectUserIdentity(p.values?.identity)
      : isStaffIdentity(p.values?.identity),
  )
  if (!isAllFilterIdentity(identity, scopeKey)) {
    filtered = filtered.filter((p) => identityMatchesFilter(p.values?.identity, identity, scopeKey))
  }
  const q = String(keyword || '').trim().toLowerCase()
  if (q) {
    filtered = filtered.filter((p) => {
      const name = String(p.title || p.values?.name || '').toLowerCase()
      const phone = String(p.values?.phone || p.subtitle || '').toLowerCase()
      if (scopeKey === PEOPLE_SCOPE_USERS) {
        const space = String(
          p.values?.spacePath || p.values?.spaceLabel || p.values?.space || '',
        ).toLowerCase()
        return name.includes(q) || phone.includes(q) || space.includes(q)
      }
      const no = String(p.values?.employeeNo || '').toLowerCase()
      return name.includes(q) || phone.includes(q) || no.includes(q)
    })
  }
  return filtered
}

export function buildPeopleQuery({ projectId, scope, status, q, identity }) {
  const params = new URLSearchParams()
  params.set('projectId', projectId)
  params.set('scope', scope === PEOPLE_SCOPE_USERS ? PEOPLE_SCOPE_USERS : PEOPLE_SCOPE_STAFF)
  if (status && status !== '全部' && status !== '全部状态') params.set('status', status)
  if (q) params.set('q', q)
  if (identity && !isAllFilterIdentity(identity, scope)) {
    const sent =
      scope === PEOPLE_SCOPE_USERS ? identity : staffRoleApi(identity)
    params.set('identity', sent)
  }
  return params
}

export async function listPeople({ projectId, scope, status, q, identity } = {}) {
  const pid = projectId || getProjectId()
  if (!pid) throw new ApiError('项目ID不能为空', 400)
  const params = buildPeopleQuery({
    projectId: pid,
    scope: scope === PEOPLE_SCOPE_USERS ? PEOPLE_SCOPE_USERS : PEOPLE_SCOPE_STAFF,
    status,
    q,
    identity,
  })
  const data = await api(`/people?${params.toString()}`)
  const items = unwrapPeopleList(data).map(toPersonRecord).filter(Boolean)
  return { items, source: 'api' }
}

/** 列表/详情常用空间：有 spacePath 用完整路径，否则 spaceLabel；空为 —。 */
export function preferredSpaceDisplay(values) {
  const path = values?.spacePath
  if (path != null && String(path).trim()) return String(path).trim()
  return dash(values?.spaceLabel)
}

function normalizeWriteSpaceId(spaceId) {
  if (spaceId == null) return null
  const raw = String(spaceId).trim()
  return raw ? raw : null
}

/**
 * POST/PUT 契约字段：scope/projectId/name/phone/identity/status。
 * 仅 users：spaceId 合法 id 绑定；显式 null 清空；省略则不改 preferredSpaceId。
 */
export function buildPersonWriteBody({ projectId, name, phone, identity, scope, status, spaceId } = {}) {
  const body = {}
  if (projectId) body.projectId = projectId
  if (scope) body.scope = scope
  if (name !== undefined) body.name = name
  if (phone !== undefined) body.phone = phone
  if (identity !== undefined) {
    body.identity =
      scope === PEOPLE_SCOPE_USERS || isProjectUserIdentity(identity)
        ? identity
        : staffRoleApi(identity)
  }
  if (status !== undefined) body.status = status
  if (scope === PEOPLE_SCOPE_USERS && spaceId !== undefined) {
    body.spaceId = normalizeWriteSpaceId(spaceId)
  }
  return body
}

export async function createPerson({ projectId, name, phone, identity, scope, spaceId } = {}) {
  const pid = projectId || getProjectId()
  const resolvedScope = scope === PEOPLE_SCOPE_USERS ? PEOPLE_SCOPE_USERS : PEOPLE_SCOPE_STAFF
  const body = buildPersonWriteBody({
    projectId: pid,
    name,
    phone,
    identity: identity || (resolvedScope === PEOPLE_SCOPE_USERS ? DEFAULT_USER_IDENTITY : DEFAULT_STAFF_IDENTITY),
    scope: resolvedScope,
    ...(resolvedScope === PEOPLE_SCOPE_USERS && spaceId !== undefined ? { spaceId } : {}),
  })
  return api('/people', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updatePerson(id, patch = {}) {
  const scope =
    patch.scope === PEOPLE_SCOPE_USERS
      ? PEOPLE_SCOPE_USERS
      : patch.scope === PEOPLE_SCOPE_STAFF
        ? PEOPLE_SCOPE_STAFF
        : undefined
  const body = buildPersonWriteBody({
    name: patch.name,
    phone: patch.phone,
    identity: patch.identity,
    status: patch.status,
    scope,
    ...(patch.spaceId !== undefined ? { spaceId: patch.spaceId } : {}),
  })
  return api(`/people/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export const PEOPLE_IMPORT_PATH = '/people/import'

export function resolvePeopleScope(scope) {
  return scope === PEOPLE_SCOPE_USERS ? PEOPLE_SCOPE_USERS : PEOPLE_SCOPE_STAFF
}

/** GET /api/v1/people/template?scope=staff|users — scope 仅此接口走 query。 */
export function buildPeopleTemplatePath(scope) {
  const params = new URLSearchParams()
  params.set('scope', resolvePeopleScope(scope))
  return `/people/template?${params.toString()}`
}

export function formatPeopleImportErrors(errors) {
  if (!Array.isArray(errors) || !errors.length) return ''
  return errors
    .map((e) => {
      const row = e?.row != null ? e.row : '?'
      const message = e?.message || '校验失败'
      return `第 ${row} 行: ${message}`
    })
    .join('\n')
}

export function peopleImportSuccessCount(data) {
  if (data == null || typeof data !== 'object') return 0
  const n = data.imported ?? data.count ?? data.successCount
  const num = Number(n)
  return Number.isFinite(num) ? num : 0
}

export function peopleIoApiMessage(err, actionLabel) {
  if (err?.status === 404) return `${actionLabel}接口未就绪`
  return err?.message || `${actionLabel}失败`
}

function authHeaders() {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function throwPeopleIoFailure(res, body, actionLabel) {
  if (res.status === 404) {
    throw new ApiError(`${actionLabel}接口未就绪`, 404, body?.code)
  }
  const errors = body?.data?.errors || body?.errors
  const base = body?.message || `${actionLabel}失败 ${res.status}`
  if (Array.isArray(errors) && errors.length) {
    const err = new ApiError(`${base}\n\n${formatPeopleImportErrors(errors)}`, res.status, body?.code)
    err.errors = errors
    throw err
  }
  throw new ApiError(base, res.status, body?.code)
}

export async function downloadPeopleTemplate({ scope } = {}) {
  const path = buildPeopleTemplatePath(scope)
  let res
  try {
    res = await fetch(`/api/v1${path}`, { headers: authHeaders() })
  } catch {
    throw new ApiError('无法连接后端服务，请确认 API 已启动（pnpm dev:api）', 0)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throwPeopleIoFailure(res, body, '下载模板')
  }
  const blob = await res.blob()
  const filename =
    resolvePeopleScope(scope) === PEOPLE_SCOPE_USERS
      ? 'people_users_template.xlsx'
      : 'people_staff_template.xlsx'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** POST /api/v1/people/import — multipart file + projectId + scope，无 query。 */
export async function importPeople(file, { scope, projectId } = {}) {
  const pid = projectId || getProjectId()
  if (!pid) throw new ApiError('项目ID不能为空', 400)
  if (!file) throw new ApiError('未选择文件', 400)

  const formData = new FormData()
  formData.append('file', file)
  formData.append('projectId', pid)
  formData.append('scope', resolvePeopleScope(scope))

  let res
  try {
    res = await fetch(`/api/v1${PEOPLE_IMPORT_PATH}`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    })
  } catch {
    throw new ApiError('无法连接后端服务，请确认 API 已启动（pnpm dev:api）', 0)
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok || (body.code !== undefined && body.code !== 0)) {
    throwPeopleIoFailure(res, body, '人员导入')
  }
  return body.data !== undefined ? body.data : body
}
