import { ResponseCode } from '@appenglish/auth-contracts';

const messages = Object.freeze({
  [ResponseCode.AUTH_INVALID_CREDENTIALS]: 'Email or password is invalid.',
  [ResponseCode.AUTH_EMAIL_NOT_VERIFIED]: 'Verify your email before signing in.',
  [ResponseCode.AUTH_ACCOUNT_DISABLED]: 'This account is disabled.',
  [ResponseCode.AUTH_ACCOUNT_SUSPENDED]: 'This account is suspended.',
  [ResponseCode.AUTH_OTP_INVALID]: 'The verification code is invalid.',
  [ResponseCode.AUTH_OTP_EXPIRED]: 'The verification code has expired.',
  [ResponseCode.AUTH_OTP_ATTEMPTS_EXCEEDED]: 'Too many code attempts. Request a new code.',
  [ResponseCode.AUTH_OTP_RATE_LIMITED]: 'Please wait before requesting another code.',
  [ResponseCode.AUTH_EMAIL_ALREADY_REGISTERED]: 'This email is already registered.',
  [ResponseCode.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ResponseCode.EMAIL_SEND_ERROR]: 'We could not send the email. Check the server email configuration.',
  [ResponseCode.VALIDATION_ERROR]: 'Please check the highlighted fields.'
});

export function responseData(response) {
  return response?.data?.data ?? {};
}

export function responseCode(response) {
  return response?.data?.code;
}

export function errorCode(error) {
  return error?.response?.data?.code;
}

// Reads data.nextAction from an error envelope, e.g.
// { code: 13, msg: 'fail', data: { nextAction: 'VERIFY_EMAIL' } }.
export function errorNextAction(error) {
  return error?.response?.data?.data?.nextAction ?? null;
}

export function getApiErrorMessage(error) {
  const code = errorCode(error);
  return messages[code] || error?.response?.data?.data?.message || 'Something went wrong. Please try again.';
}

export function isUnauthorizedError(error) {
  return error?.response?.status === 401 || error?.response?.data?.code === ResponseCode.AUTH_SESSION_EXPIRED;
}
