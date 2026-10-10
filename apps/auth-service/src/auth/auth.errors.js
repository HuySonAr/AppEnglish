export class AuthError extends Error {
  constructor(code, message, status = 400, nextAction = undefined) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.nextAction = nextAction;
  }
}

export const authErrors = Object.freeze({
  invalidCredentials: () =>
    new AuthError(10, 'Email or password is invalid', 401),
  unauthorized: () => new AuthError(11, 'Authentication is required', 401),
  accountNotFound: () => new AuthError(12, 'Account was not found', 404),
  emailNotVerified: () =>
    new AuthError(13, 'Email verification is required', 403, 'VERIFY_EMAIL'),
  accountDisabled: () => new AuthError(14, 'Account is disabled', 403),
  otpInvalid: () => new AuthError(15, 'OTP is invalid', 400),
  otpExpired: () => new AuthError(16, 'OTP has expired', 400),
  otpAttemptsExceeded: () => new AuthError(17, 'OTP attempts exceeded', 429),
  otpRateLimited: () => new AuthError(18, 'OTP resend is rate limited', 429),
  emailTaken: () => new AuthError(19, 'Email is already registered', 409),
  refreshTokenReuse: () =>
    new AuthError(20, 'Refresh token reuse detected', 401),
  sessionExpired: () => new AuthError(21, 'Session is expired or invalid', 401),
  accountSuspended: () => new AuthError(22, 'Account is suspended', 403),
  lastAdmin: () =>
    new AuthError(23, 'The last active administrator cannot be demoted or disabled', 409),
  emailVerificationRequired: () =>
    new AuthError(25, 'Email verification is required before activation', 409),
  forbiddenRole: () =>
    new AuthError(26, 'Account does not have the required role', 403),
  invalidRole: () =>
    new AuthError(30, 'Role is not allowed for public registration', 403),
  emailSend: () => new AuthError(31, 'Unable to send verification email', 503),
});
