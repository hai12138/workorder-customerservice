export const EMPLOYEE_IDENTITIES = ['管理员', '物管人员', '员工'] as const;
export const CONSUMER_IDENTITIES = ['业主', '租户'] as const;

export type EmployeeIdentity = (typeof EMPLOYEE_IDENTITIES)[number];

export const DEFAULT_EMPLOYEE_IDENTITY: EmployeeIdentity = '物管人员';

export const USER_STATUS_ACTIVE = '有效';
export const USER_STATUS_DISABLED = '停用';
export const USER_STATUSES = [USER_STATUS_ACTIVE, USER_STATUS_DISABLED] as const;
export type UserStatusValue = (typeof USER_STATUSES)[number];

export function isEmployeeIdentity(identity: string): identity is EmployeeIdentity {
  return (EMPLOYEE_IDENTITIES as readonly string[]).includes(identity);
}

export function isUserStatus(status: string): status is UserStatusValue {
  return (USER_STATUSES as readonly string[]).includes(status);
}
