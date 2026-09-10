import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_ROLE_ID, ROLE_PERM_GROUPS, ROLE_PERM_ITEMS, ROLE_PERM_TOTAL, STATIC_ROLES } from '../data/roles-static.js'
import { roles, setSelectedRoleId } from './pages.js'

function switchOnCount(html: string) {
  return (html.match(/class="switch on"/g) || []).length
}

describe('roles WEB-04 readonly three-column', () => {
  beforeEach(() => {
    setSelectedRoleId(DEFAULT_ROLE_ID)
  })

  it('keeps 4 groups / 16 permissions and five roles', () => {
    expect(ROLE_PERM_GROUPS.map((g) => g.title)).toEqual(['查看', '工单处置', 'AI 与知识', '配置与管理'])
    expect(ROLE_PERM_TOTAL).toBe(16)
    expect(ROLE_PERM_ITEMS).toHaveLength(16)
    expect(STATIC_ROLES.map((r) => r.title)).toEqual(['项目用户', '物业客服', '物管人员', '项目管理员', '平台管理员'])
  })

  it('defaults to 项目用户 with readonly matrix, impact card and deferred create', () => {
    const html = roles()
    expect(html).toContain('WEB-04')
    expect(html).toContain('class="role-layout"')
    expect(html).toContain('class="card role-impact"')
    expect(html).toContain('范围与影响')
    expect(html).toContain('项目数据范围')
    expect(html).toContain('授权人数')
    expect(html).toContain('已开启权限')
    expect(html).toContain('data-action="new-role"')
    expect(html).toContain('class="btn is-disabled"')
    expect(html).toContain('＋ 新建自定义角色')
    expect(html).toContain('class="role on"')
    expect(html).toContain('data-id="project-user"')
    expect(html).toContain('基础角色 · 本人数据')
    expect(html).toContain('项目角色 · 本项目')
    expect(html).toContain('平台角色 · 全部项目')
    expect(html).toContain('系统基础角色，基础能力只读，不可在此处调整')
    expect(html).toContain('只读')
    expect(html).toContain('3 / 16')
    expect(html).toContain('14 人')
    expect(html).toContain('本人数据')
    expect(html).not.toContain('编辑权限')
    expect(switchOnCount(html)).toBe(3)
    for (const label of ROLE_PERM_ITEMS) expect(html).toContain(label)
    for (const title of ROLE_PERM_GROUPS.map((g) => g.title)) expect(html).toContain(title)
  })

  it('select-role switches matrix and impact instead of staying on list[0]', () => {
    setSelectedRoleId('property-cs')
    const cs = roles()
    expect(cs).toContain('data-id="property-cs"')
    expect(cs).toMatch(/class="role on"[^>]*data-id="property-cs"/)
    expect(cs).toContain('物业客服 · 功能权限')
    expect(cs).toContain('编辑权限')
    expect(cs).toContain('data-action="edit-role"')
    expect(cs).toContain('11 / 16')
    expect(cs).toContain('8 人')
    expect(cs).toContain('本项目')
    expect(cs).not.toContain('只读')
    expect(switchOnCount(cs)).toBe(11)

    setSelectedRoleId('property-staff')
    const staff = roles()
    expect(staff).toContain('物管人员 · 功能权限')
    expect(staff).toContain('7 / 16')
    expect(staff).toContain('6 人')
    expect(staff).toContain('编辑权限')
    expect(switchOnCount(staff)).toBe(7)

    setSelectedRoleId('project-admin')
    const admin = roles()
    expect(admin).toContain('项目管理员 · 功能权限')
    expect(admin).toContain('16 / 16')
    expect(admin).toContain('2 人')
    expect(admin).toContain('编辑权限')
    expect(switchOnCount(admin)).toBe(16)
    expect(admin).not.toContain('perm-fixed')

    setSelectedRoleId('platform-admin')
    const platform = roles()
    expect(platform).toContain('平台管理员 · 功能权限')
    expect(platform).toContain('16 / 16')
    expect(platform).toContain('1 人')
    expect(platform).toContain('全部项目')
    expect(platform).toContain('只读')
    expect(platform).toContain('平台内置角色，权限固定只读，不可在此处调整')
    expect(platform).toContain('perm-fixed')
    expect(platform).not.toContain('编辑权限')
    expect(switchOnCount(platform)).toBe(16)
  })
})
