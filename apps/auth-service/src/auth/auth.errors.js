export class AuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

export const authErrors = Object.freeze({
  invalidCredentials: () => new AuthError('INVALID_CREDENTIALS', 'Email or password is invalid', 401),
  accountDisabled: () => new AuthError('ACCOUNT_DISABLED', 'Account is disabled', 403),
  emailTaken: () => new AuthError('EMAIL_ALREADY_REGISTERED', 'Email is already registered', 409),
  invalidRole: () => new AuthError('INVALID_ROLE', 'Role is not allowed for public registration', 403)
});
