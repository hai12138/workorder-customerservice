import { beforeEach, describe, expect, it } from 'vitest'
import { toPersonRecord } from '../api/people.js'
import {
  clearPeopleFilterState,
  clearPeopleListCache,
  setPeopleFilterState,
  setPeopleListCache,
  setPeopleTab,
} from '../store/app-state.js'
import { peopleView } from './pages.js'

const mixed = [
  toPersonRecord({
    id: 'staff-1',
    name: '赵晴',
    phone: '13800000021',
    identity: '物管人员',
    status: '有效',
    employeeNo: null,
    teamName: '客服一组',
    roleName: null,
    onlineStatus: null,
    updatedAt: null,
  }),
  toPersonRecord({
    id: 'admin-1',
    name: '项目管理员',
    phone: '13800000000',
    identity: '管理员',
    status: '有效',
  }),
  toPersonRecord({
    id: 'user-1',
    name: '林悦',
    phone: '13800138120',
    identity: '业主',
    status: '有效',
    spaceId: null,
    spaceLabel: null,
    spacePath: null,
    relationStatus: null,
    relationSource: null,
    updatedAt: null,
  }),
  toPersonRecord({
    id: 'user-2',
    name: '陈途',
    phone: '13800138002',
    identity: '租户',
    status: '有效',
    spaceId: 'spc_101',
    spaceLabel: '101',
    spacePath: 'A栋/1层/101',
    relationStatus: null,
    relationSource: null,
    updatedAt: null,
  }),
]

describe('peopleView U2 tabs / columns / filters', () => {
  beforeEach(() => {
    setPeopleTab('projectUsers')
    clearPeopleFilterState('projectUsers')
    clearPeopleFilterState('staff')
    clearPeopleListCache()
  })

  it('renders 项目用户 tab copy, type filter and required columns', () => {
    setPeopleListCache({ items: mixed, source: 'api' })
    const html = peopleView()
    expect(html).toContain('项目用户')
    expect(html).toContain('员工账号')
    expect(html).toContain('全部类型')
    expect(html).toContain('类型未设置')
    expect(html).toContain('业主')
    expect(html).toContain('租户')
    expect(html).toContain('家属')
    expect(html).toContain('姓名 / 手机号 / 空间')
    expect(html).toContain('导入项目用户')
    expect(html).toContain('新增项目用户')
    expect(html).toContain('data-action="download-people-template"')
    expect(html).toContain('data-action="import-people"')
    expect(html).toContain('data-scope="users"')
    expect(html).not.toContain('people-u3-toast')
    for (const col of ['姓名', '手机号', '项目用户类型', '常用空间', '项目关系状态', '关系来源', '更新时间', '操作']) {
      expect(html).toContain(`<th>${col}</th>`)
    }
    expect(html).toContain('林悦')
    expect(html).not.toContain('赵晴')
    expect(html).toContain('—')
    expect(html).toContain('A栋/1层/101')
    expect(html).toContain('陈途')
  })

  it('renders 员工账号 role filter, mapped role label, masked phone and columns', () => {
    setPeopleTab('staff')
    setPeopleListCache({ items: mixed, source: 'api' })
    const html = peopleView()
    expect(html).toContain('全部项目角色')
    expect(html).toContain('项目管理员')
    expect(html).toContain('物业客服')
    expect(html).toContain('物管人员')
    expect(html).toContain('姓名 / 手机号 / 员工编号')
    expect(html).toContain('导入员工')
    expect(html).toContain('新增员工')
    expect(html).toContain('data-action="download-people-template"')
    expect(html).toContain('data-action="import-people"')
    expect(html).toContain('data-scope="staff"')
    expect(html).not.toContain('people-u3-toast')
    for (const col of ['姓名', '手机号', '员工编号', '部门/班组', '当前项目角色', '在线状态', '更新时间', '操作']) {
      expect(html).toContain(`<th>${col}</th>`)
    }
    expect(html).toContain('赵晴')
    expect(html).toContain('138****0021')
    expect(html).not.toContain('林悦')
    expect(html).toContain('项目管理员')
  })

  it('applies query/reset filter state on the current tab only', () => {
    setPeopleListCache({ items: mixed, source: 'api' })
    setPeopleFilterState('林悦', '业主', 'projectUsers')
    expect(peopleView()).toContain('林悦')
    clearPeopleFilterState('projectUsers')
    setPeopleTab('staff')
    setPeopleFilterState('赵晴', '物管人员', 'staff')
    const staffHtml = peopleView()
    expect(staffHtml).toContain('赵晴')
    expect(staffHtml).not.toContain('林悦')
  })
})
