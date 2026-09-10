import { describe, expect, it } from 'vitest'
import {
  ALL_STAFF_ROLE,
  ALL_USER_TYPE,
  EXCLUDED_IDENTITIES,
  STAFF_IDENTITIES,
  USER_IDENTITIES,
  applyPeopleClientFilter,
  buildPeopleQuery,
  buildPersonWriteBody,
  dash,
  isProjectUserIdentity,
  isStaffIdentity,
  isValidPhone,
  maskPhone,
  staffRoleApi,
  staffRoleLabel,
  toPersonRecord,
  unwrapPeopleList,
} from './people.js'

function rec(partial) {
  return toPersonRecord({ id: partial.id || 'x', ...partial })
}

describe('people U2 helpers', () => {
  it('locks staff API identity and user types', () => {
    expect(STAFF_IDENTITIES).toEqual(['管理员', '物管人员', '员工'])
    expect(STAFF_IDENTITIES).not.toContain('管家人员')
    expect(USER_IDENTITIES).toEqual(['业主', '租户', '家属', '类型未设置'])
    expect(EXCLUDED_IDENTITIES).toEqual(USER_IDENTITIES)
    expect(isStaffIdentity('管理员')).toBe(true)
    expect(isStaffIdentity('员工')).toBe(true)
    expect(isStaffIdentity('物管人员')).toBe(true)
    expect(isStaffIdentity('项目管理员')).toBe(true)
    expect(isStaffIdentity('物业客服')).toBe(true)
    expect(isStaffIdentity('业主')).toBe(false)
    expect(isStaffIdentity('租户')).toBe(false)
    expect(isStaffIdentity('家属')).toBe(false)
    expect(isStaffIdentity('类型未设置')).toBe(false)
    expect(isProjectUserIdentity('业主')).toBe(true)
    expect(isProjectUserIdentity('家属')).toBe(true)
    expect(isProjectUserIdentity('类型未设置')).toBe(true)
    expect(isProjectUserIdentity('管理员')).toBe(false)
    expect(isProjectUserIdentity('物业客服')).toBe(false)
  })

  it('maps staff role display ↔ API identity', () => {
    expect(staffRoleLabel('管理员')).toBe('项目管理员')
    expect(staffRoleLabel('员工')).toBe('物业客服')
    expect(staffRoleLabel('物管人员')).toBe('物管人员')
    expect(staffRoleLabel('项目管理员')).toBe('项目管理员')
    expect(staffRoleApi('项目管理员')).toBe('管理员')
    expect(staffRoleApi('物业客服')).toBe('员工')
    expect(staffRoleApi('物管人员')).toBe('物管人员')
    expect(staffRoleApi('管理员')).toBe('管理员')
  })

  it('builds GET query with scope and mapped identity', () => {
    const staff = buildPeopleQuery({
      projectId: 'prj_1',
      scope: 'staff',
      q: '赵',
      identity: '项目管理员',
    })
    expect(staff.get('projectId')).toBe('prj_1')
    expect(staff.get('scope')).toBe('staff')
    expect(staff.get('q')).toBe('赵')
    expect(staff.get('identity')).toBe('管理员')

    const users = buildPeopleQuery({
      projectId: 'prj_1',
      scope: 'users',
      identity: '家属',
    })
    expect(users.get('scope')).toBe('users')
    expect(users.get('identity')).toBe('家属')

    const all = buildPeopleQuery({
      projectId: 'prj_1',
      scope: 'staff',
      identity: ALL_STAFF_ROLE,
    })
    expect(all.get('identity')).toBeNull()
    expect(ALL_USER_TYPE).toBe('全部类型')
  })

  it('write body 只传契约字段，员工 identity 映射到后端枚举', () => {
    expect(
      buildPersonWriteBody({
        projectId: 'prj_1',
        scope: 'staff',
        name: '周管理',
        phone: '13800000000',
        identity: '项目管理员',
      }),
    ).toEqual({
      projectId: 'prj_1',
      scope: 'staff',
      name: '周管理',
      phone: '13800000000',
      identity: '管理员',
    })
    expect(
      buildPersonWriteBody({
        projectId: 'prj_1',
        scope: 'users',
        name: '林悦',
        phone: '13800138120',
        identity: '类型未设置',
      }),
    ).toEqual({
      projectId: 'prj_1',
      scope: 'users',
      name: '林悦',
      phone: '13800138120',
      identity: '类型未设置',
    })
    expect(buildPersonWriteBody({ status: '停用' })).toEqual({ status: '停用' })
  })

  it('unwraps list data as array', () => {
    expect(unwrapPeopleList([{ id: '1' }])).toEqual([{ id: '1' }])
    expect(unwrapPeopleList({ items: [{ id: '2' }] })).toEqual([{ id: '2' }])
  })

  it('maps staff and user list keys; empty stays null', () => {
    const staff = toPersonRecord({
      id: 'u1',
      name: '赵晴',
      phone: '13800000021',
      identity: '物管人员',
      status: '有效',
      employeeNo: 'E001',
      teamName: '客服一组',
      roleName: null,
      onlineStatus: null,
    })
    expect(staff.title).toBe('赵晴')
    expect(staff.values.phone).toBe('13800000021')
    expect(staff.values.identity).toBe('物管人员')
    expect(staff.values.employeeNo).toBe('E001')
    expect(staff.values.teamName).toBe('客服一组')
    expect(staff.values.roleName).toBeNull()
    expect(staff.values.onlineStatus).toBeNull()

    const user = toPersonRecord({
      id: 'u2',
      name: '林悦',
      phone: '13800138120',
      identity: '业主',
      status: '有效',
      spaceLabel: 'A栋-1-101',
      relationStatus: null,
      relationSource: null,
      updatedAt: null,
    })
    expect(user.values.spaceLabel).toBe('A栋-1-101')
    expect(user.values.relationStatus).toBeNull()
    expect(user.values.relationSource).toBeNull()
    expect(dash(user.values.relationStatus)).toBe('—')
    expect(dash(user.values.relationSource)).toBe('—')
    expect(dash(user.values.updatedAt)).toBe('—')
  })

  it('masks staff phone and validates 11 digits', () => {
    expect(maskPhone('13800000021')).toBe('138****0021')
    expect(maskPhone('')).toBe('')
    expect(dash(maskPhone(''))).toBe('—')
    expect(isValidPhone('13800000021')).toBe(true)
    expect(isValidPhone('138000')).toBe(false)
  })

  it('client-filters by tab scope, type/role and keyword', () => {
    const items = [
      rec({ id: 'a', name: '赵晴', phone: '13800000021', identity: '物管人员', employeeNo: 'E21' }),
      rec({ id: 'b', name: '管理员甲', phone: '13800000000', identity: '管理员' }),
      rec({ id: 'c', name: '林悦', phone: '13900001111', identity: '业主', spaceLabel: 'A栋' }),
      rec({ id: 'd', name: '家属乙', phone: '13700002222', identity: '家属', spaceLabel: 'B栋' }),
    ]
    const staff = applyPeopleClientFilter(items, { scope: 'staff', identity: ALL_STAFF_ROLE })
    expect(staff.map((p) => p.id)).toEqual(['a', 'b'])
    const users = applyPeopleClientFilter(items, { scope: 'users', identity: ALL_USER_TYPE })
    expect(users.map((p) => p.id)).toEqual(['c', 'd'])
    expect(applyPeopleClientFilter(items, { scope: 'staff', identity: '项目管理员' }).map((p) => p.id)).toEqual(['b'])
    expect(applyPeopleClientFilter(items, { scope: 'users', identity: '业主' }).map((p) => p.id)).toEqual(['c'])
    expect(applyPeopleClientFilter(items, { scope: 'staff', keyword: 'e21' }).map((p) => p.id)).toEqual(['a'])
    expect(applyPeopleClientFilter(items, { scope: 'users', keyword: 'a栋' }).map((p) => p.id)).toEqual(['c'])
  })
})
