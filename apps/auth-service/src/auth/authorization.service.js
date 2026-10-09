import { AccountRole } from './auth.constants.js';
import { AuthError } from './auth.errors.js';

export class AuthorizationService {
  assertRole(account, allowedRoles) {
    if (!account || !allowedRoles.includes(account.role)) {
      throw new AuthError(
        'FORBIDDEN_ROLE',
        'Account does not have the required role',
        403,
      );
    }
    return account;
  }

  assertAnyRole(account) {
    return this.assertRole(account, Object.values(AccountRole));
  }
}
