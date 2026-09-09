import { describe, expect, it } from 'vitest'
import {
  isStaffIdentity,
  toPersonRecord,
  unwrapPeopleList,
  personApiMessage,
  STAFF_IDENTITIES,
  EXCLUDED_IDENTITIES,
  PERSON_STATUSES,
} from './people.js'

describe('people /api/v1/people helpers', () => {
  it('locks staff identity to 物管人员 not 管家人员', () => {
    expect(STAFF_IDENTITIES).toEqual(['管理员', '物管人员', '员工'])
    expect(STAFF_IDENTITIES).not.toContain('管家人员')
    expect(EXCLUDED_IDENTITIES).toEqual(['业主', '租户'])
    expect(PERSON_STATUSES).toEqual(['有效', '停用'])
    expect(isStaffIdentity('管理员')).toBe(true)
    expect(isStaffIdentity('物管人员')).toBe(true)
    expect(isStaffIdentity('员工')).toBe(true)
    expect(isStaffIdentity('管家人员')).toBe(false)
    expect(isStaffIdentity('业主')).toBe(false)
    expect(isStaffIdentity('租户')).toBe(false)
  })

  it('unwraps list data as array', () => {
    expect(unwrapPeopleList([{ id: '1' }])).toEqual([{ id: '1' }])
    expect(unwrapPeopleList({ items: [{ id: '2' }] })).toEqual([{ id: '2' }])
  })

  it('maps API item { id, name, phone, identity, status }', () => {
    const rec = toPersonRecord({
      id: 'u1',
      name: '赵晴',
      phone: '13800000021',
      identity: '物管人员',
      status: '有效',
    })
    expect(rec.title).toBe('赵晴')
    expect(rec.subtitle).toBe('13800000021')
    expect(rec.values.identity).toBe('物管人员')
    expect(rec.status).toBe('有效')
  })

  it('404 toast points at /api/v1/people and PR #31', () => {
    const msg = personApiMessage({ status: 404 }, 'PUT /api/v1/people/:id')
    expect(msg).toContain('/api/v1/people')
    expect(msg).toContain('PR #31')
    expect(msg).toContain('404')
  })
})
