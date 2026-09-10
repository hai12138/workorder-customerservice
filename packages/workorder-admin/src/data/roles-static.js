/** WEB-04 角色权限只读页静态数据（R1；写入 / 新建 / 鉴权挂钩留 R2）。 */

export const ROLE_PERM_GROUPS = [
  {
    title: '查看',
    items: ['查看项目数据', '查看本人任务', '查看全部工单'],
  },
  {
    title: '工单处置',
    items: ['派单', '接单', '提交处理记录', '完成工单', '转派', '取消工单'],
  },
  {
    title: 'AI 与知识',
    items: ['AI 助手代客报单', '知识问询'],
  },
  {
    title: '配置与管理',
    items: ['工单配置', '用户管理', '角色权限管理', '上线检查', '异常处理'],
  },
]

export const ROLE_PERM_ITEMS = ROLE_PERM_GROUPS.flatMap((g) => g.items)
export const ROLE_PERM_TOTAL = ROLE_PERM_ITEMS.length

const VIEW = ['查看项目数据', '查看本人任务', '查看全部工单']
const HANDLE = ['派单', '接单', '提交处理记录', '完成工单', '转派', '取消工单']
const AI = ['AI 助手代客报单', '知识问询']

export const DEFAULT_ROLE_ID = 'project-user'
export const ROLE_READONLY_NOTE = '系统基础角色，基础能力只读，不可在此处调整。'

export const STATIC_ROLES = [
  {
    id: 'project-user',
    title: '项目用户',
    kind: '基础角色',
    scope: '本人数据',
    members: 14,
    readonly: true,
    readonlyNote: ROLE_READONLY_NOTE,
    permissions: ['查看本人任务', 'AI 助手代客报单', '知识问询'],
  },
  {
    id: 'property-cs',
    title: '物业客服',
    kind: '项目角色',
    scope: '本项目',
    members: 8,
    readonly: false,
    permissions: [...VIEW, ...HANDLE, ...AI],
  },
  {
    id: 'property-staff',
    title: '物管人员',
    kind: '项目角色',
    scope: '本项目',
    members: 6,
    readonly: false,
    permissions: ['查看项目数据', '查看本人任务', '接单', '提交处理记录', '完成工单', 'AI 助手代客报单', '知识问询'],
  },
  {
    id: 'project-admin',
    title: '项目管理员',
    kind: '项目角色',
    scope: '本项目',
    members: 2,
    readonly: false,
    permissions: [...ROLE_PERM_ITEMS],
  },
  {
    id: 'platform-admin',
    title: '平台管理员',
    kind: '平台角色',
    scope: '全部项目',
    members: 1,
    readonly: true,
    fixed: true,
    readonlyNote: ROLE_READONLY_NOTE,
    permissions: [...ROLE_PERM_ITEMS],
  },
]
