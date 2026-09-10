import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ALL_STAFF_ROLE,
  ALL_USER_TYPE,
  EXCLUDED_IDENTITIES,
  PEOPLE_IMPORT_PATH,
  STAFF_IDENTITIES,
  USER_IDENTITIES,
  applyPeopleClientFilter,
  buildPeopleQuery,
  buildPeopleTemplatePath,
  buildPersonWriteBody,
  dash,
  preferredSpaceDisplay,
  formatPeopleImportErrors,
  importPeople,
  isProjectUserIdentity,
  isStaffIdentity,
  isValidPhone,
  maskPhone,
  peopleImportSuccessCount,
  peopleIoApiMessage,
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
    expect(buildPersonWriteBody({ status: '停用' })).not.toHaveProperty('spaceId')
    expect(
      buildPersonWriteBody({
        projectId: 'prj_1',
        scope: 'users',
        name: '林悦',
        phone: '13800138120',
        identity: '业主',
        spaceId: 'spc_room',
      }),
    ).toEqual({
      projectId: 'prj_1',
      scope: 'users',
      name: '林悦',
      phone: '13800138120',
      identity: '业主',
      spaceId: 'spc_room',
    })
    const cleared = buildPersonWriteBody({
      scope: 'users',
      name: '林悦',
      phone: '13800138120',
      identity: '业主',
      spaceId: null,
    })
    expect(cleared).toMatchObject({ spaceId: null })
    expect(JSON.stringify(cleared)).toContain('"spaceId":null')
    expect(
      buildPersonWriteBody({
        scope: 'users',
        name: '林悦',
        phone: '13800138120',
        identity: '业主',
      }),
    ).not.toHaveProperty('spaceId')
    expect(
      buildPersonWriteBody({
        projectId: 'prj_1',
        scope: 'staff',
        name: '周管理',
        phone: '13800000000',
        identity: '项目管理员',
        spaceId: 'spc_room',
      }),
    ).not.toHaveProperty('spaceId')
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
      spaceId: 'spc_101',
      spaceLabel: 'A栋/1层/101',
      spacePath: 'A栋/1层/101',
      relationStatus: null,
      relationSource: null,
      updatedAt: null,
    })
    expect(user.values.spaceId).toBe('spc_101')
    expect(user.values.spaceLabel).toBe('A栋/1层/101')
    expect(user.values.spacePath).toBe('A栋/1层/101')
    expect(preferredSpaceDisplay(user.values)).toBe('A栋/1层/101')
    expect(preferredSpaceDisplay({ spaceLabel: 'A栋/1层/101', spacePath: 'A栋/1层/101' })).toBe('A栋/1层/101')
    expect(preferredSpaceDisplay({ spaceLabel: 'A栋/1层/101', spacePath: 'ignored' })).toBe('A栋/1层/101')
    expect(preferredSpaceDisplay({ spaceLabel: null, spacePath: 'A栋/1层/101' })).toBe('A栋/1层/101')
    expect(preferredSpaceDisplay({ spaceLabel: 'A栋-1-101' })).toBe('A栋-1-101')
    expect(preferredSpaceDisplay({ spaceId: null, spaceLabel: null, spacePath: null })).toBe('—')
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
      rec({ id: 'c', name: '林悦', phone: '13900001111', identity: '业主', spaceLabel: 'A栋', spacePath: 'A栋' }),
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

describe('people U3 template / import contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('puts scope on template query only; import path has no query', () => {
    expect(buildPeopleTemplatePath('users')).toBe('/people/template?scope=users')
    expect(buildPeopleTemplatePath('staff')).toBe('/people/template?scope=staff')
    expect(buildPeopleTemplatePath('unknown')).toBe('/people/template?scope=staff')
    expect(PEOPLE_IMPORT_PATH).toBe('/people/import')
    expect(PEOPLE_IMPORT_PATH).not.toContain('?')
    expect(PEOPLE_IMPORT_PATH).not.toContain('scope=')
  })

  it('formats import row errors and success count', () => {
    expect(formatPeopleImportErrors([{ row: 2, message: '手机号无效' }])).toBe('第 2 行: 手机号无效')
    expect(
      formatPeopleImportErrors([
        { row: 3, message: '身份非法' },
        { row: 5, message: '状态非法' },
      ]),
    ).toBe('第 3 行: 身份非法\n第 5 行: 状态非法')
    expect(peopleImportSuccessCount({ imported: 4 })).toBe(4)
    expect(peopleImportSuccessCount({ count: 2 })).toBe(2)
    expect(peopleIoApiMessage({ status: 404 }, '人员导入')).toBe('人员导入接口未就绪')
    expect(peopleIoApiMessage({ status: 404 }, '下载模板')).toBe('下载模板接口未就绪')
  })

  it('POSTs import as multipart file+projectId+scope without query', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(url).toBe('/api/v1/people/import')
      expect(String(url)).not.toContain('?')
      expect(String(url)).not.toContain('scope=')
      expect(init.method).toBe('POST')
      expect(init.body).toBeInstanceOf(FormData)
      expect(init.body.get('projectId')).toBe('prj_1')
      expect(init.body.get('scope')).toBe('staff')
      expect(init.body.get('file')).toBeTruthy()
      expect(init.headers.Authorization).toBeUndefined()
      return {
        ok: true,
        status: 200,
        json: async () => ({ code: 0, data: { imported: 2 } }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['xlsx'], 'staff.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const data = await importPeople(file, { scope: 'staff', projectId: 'prj_1' })
    expect(data).toEqual({ imported: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces data.errors row+message and 404 接口未就绪', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          code: 400,
          message: '导入失败',
          data: { errors: [{ row: 2, message: '手机号无效' }] },
        }),
      })),
    )
    const file = new File(['xlsx'], 'users.xlsx')
    await expect(importPeople(file, { scope: 'users', projectId: 'prj_1' })).rejects.toMatchObject({
      message: expect.stringContaining('第 2 行: 手机号无效'),
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' }),
      })),
    )
    await expect(importPeople(file, { scope: 'users', projectId: 'prj_1' })).rejects.toMatchObject({
      status: 404,
      message: '人员导入接口未就绪',
    })
  })
})
