export const PEOPLE_SCOPES = ['staff', 'users'] as const;
export type PeopleScope = (typeof PEOPLE_SCOPES)[number];
export const DEFAULT_PEOPLE_SCOPE: PeopleScope = 'staff';

export const EMPLOYEE_IDENTITIES = ['管理员', '物管人员', '员工'] as const;
export const USER_IDENTITIES = ['业主', '租户', '家属', '类型未设置'] as const;
export const CONSUMER_IDENTITIES = USER_IDENTITIES;

export type EmployeeIdentity = (typeof EMPLOYEE_IDENTITIES)[number];
export type UserIdentity = (typeof USER_IDENTITIES)[number];
export type PeopleIdentity = EmployeeIdentity | UserIdentity;

export const ALL_PEOPLE_IDENTITIES = [...EMPLOYEE_IDENTITIES, ...USER_IDENTITIES] as const;

export const DEFAULT_EMPLOYEE_IDENTITY: EmployeeIdentity = '物管人员';
export const DEFAULT_USER_IDENTITY: UserIdentity = '业主';

export const USER_STATUS_ACTIVE = '有效';
export const USER_STATUS_DISABLED = '停用';
export const USER_STATUSES = [USER_STATUS_ACTIVE, USER_STATUS_DISABLED] as const;
export type UserStatusValue = (typeof USER_STATUSES)[number];

export function isPeopleScope(scope: string): scope is PeopleScope {
  return (PEOPLE_SCOPES as readonly string[]).includes(scope);
}

export function isEmployeeIdentity(identity: string): identity is EmployeeIdentity {
  return (EMPLOYEE_IDENTITIES as readonly string[]).includes(identity);
}

export function isUserIdentity(identity: string): identity is UserIdentity {
  return (USER_IDENTITIES as readonly string[]).includes(identity);
}

export function identitiesForScope(scope: PeopleScope): readonly PeopleIdentity[] {
  return scope === 'staff' ? EMPLOYEE_IDENTITIES : USER_IDENTITIES;
}

export function defaultIdentityForScope(scope: PeopleScope): PeopleIdentity {
  return scope === 'staff' ? DEFAULT_EMPLOYEE_IDENTITY : DEFAULT_USER_IDENTITY;
}

export function scopeOfIdentity(identity: string): PeopleScope | null {
  if (isEmployeeIdentity(identity)) return 'staff';
  if (isUserIdentity(identity)) return 'users';
  return null;
}

export function isUserStatus(status: string): status is UserStatusValue {
  return (USER_STATUSES as readonly string[]).includes(status);
}
