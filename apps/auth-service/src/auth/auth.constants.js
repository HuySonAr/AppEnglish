export const AccountRole = Object.freeze({
  STUDENT: 'STUDENT',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  ADMIN: 'ADMIN'
});

export const AccountStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED'
});

export const publicRoles = Object.freeze(Object.values(AccountRole));
