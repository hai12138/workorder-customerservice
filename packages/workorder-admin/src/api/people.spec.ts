import { describe, expect, it } from 'vitest'
import { isStaffIdentity, toPersonRecord, STAFF_IDENTITIES, EXCLUDED_IDENTITIES, PERSON_STATUSES } from './people.js'

describe('people staff口径', () => {
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

  it('maps bootstrap-shaped record', () => {
    const rec = toPersonRecord({
      id: 'u1',
      title: '赵晴',
      subtitle: '13800000021',
      status: '有效',
      values: { identity: '物管人员' },
    })
    expect(rec.title).toBe('赵晴')
    expect(rec.values.identity).toBe('物管人员')
    expect(rec.status).toBe('有效')
  })
})
