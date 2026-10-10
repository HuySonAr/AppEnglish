import { AccountRole } from './auth.constants.js';
import { authErrors } from './auth.errors.js';

export class AuthorizationService {
  assertRole(account, allowedRoles) {
    if (!account || !allowedRoles.includes(account.role)) {
      throw authErrors.forbiddenRole();
    }
    return account;
  }

  assertAnyRole(account) {
    return this.assertRole(account, Object.values(AccountRole));
  }
}
