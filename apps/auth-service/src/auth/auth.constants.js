export const AccountRole = Object.freeze({
  STUDENT: 'STUDENT',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  TEACHER: 'TEACHER',
  ADMIN: 'ADMIN',
});

export const AccountStatus = Object.freeze({
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  SUSPENDED: 'SUSPENDED',
});

export const publicRoles = Object.freeze(Object.values(AccountRole));
