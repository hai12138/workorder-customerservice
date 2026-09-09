import { describe, expect, it } from 'vitest'
import { isStaffIdentity, unwrapPeopleList, toPersonRecord, STAFF_IDENTITIES } from './people.js'

describe('people API helpers', () => {
  it('unwraps array and { items, total }', () => {
    expect(unwrapPeopleList([{ id: '1' }])).toEqual({ items: [{ id: '1' }], total: 1 })
    expect(unwrapPeopleList({ items: [{ id: '2' }], total: 9 })).toEqual({
      items: [{ id: '2' }],
      total: 9,
    })
  })

  it('filters staff identity by locked enum', () => {
    expect(STAFF_IDENTITIES).toEqual(['管理员', '物管人员', '员工'])
    expect(isStaffIdentity('管理员')).toBe(true)
    expect(isStaffIdentity('物管人员')).toBe(true)
    expect(isStaffIdentity('员工')).toBe(true)
    expect(isStaffIdentity('业主')).toBe(false)
    expect(isStaffIdentity('租户')).toBe(false)
  })

  it('maps API item to list record', () => {
    const rec = toPersonRecord({ id: 'u1', name: '赵晴', phone: '13800000021', identity: '物管人员', status: '有效' })
    expect(rec.title).toBe('赵晴')
    expect(rec.subtitle).toBe('13800000021')
    expect(rec.values.identity).toBe('物管人员')
    expect(rec.status).toBe('有效')
  })
})
