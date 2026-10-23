import { AccountRole, AccountStatus, ResponseCode } from '@appenglish/auth-contracts';

export const Roles = AccountRole;

export const RoleLabels = Object.freeze({
  [Roles.STUDENT]: 'Student',
  [Roles.CONTENT_MANAGER]: 'Content Manager',
  [Roles.TEACHER]: 'Teacher',
  [Roles.ADMIN]: 'Admin'
});

export { AccountStatus, ResponseCode };
