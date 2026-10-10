import { ResponseCode } from '@appenglish/auth-contracts';
import { ContentResponseCode } from '@appenglish/content-contracts';

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
  [ResponseCode.AUTH_ADMIN_LAST_ACCOUNT]: 'The last active administrator cannot be demoted or disabled.',
  [ResponseCode.AUTH_EMAIL_VERIFICATION_REQUIRED]: 'This account must verify its email before it can be activated.',
  [ResponseCode.AUTH_FORBIDDEN_ROLE]: 'You do not have permission to do this.',
  [ResponseCode.EMAIL_SEND_ERROR]: 'We could not send the email. Check the server email configuration.',
  [ResponseCode.VALIDATION_ERROR]: 'Please check the highlighted fields.',
  [ContentResponseCode.CONTENT_NOT_FOUND]: 'This content no longer exists.',
  [ContentResponseCode.CONTENT_INVALID_STATE]: 'There is no draft to publish.',
  [ContentResponseCode.CONTENT_NOT_PUBLISHABLE]: 'This content does not meet the publishing requirements yet.',
  [ContentResponseCode.MEDIA_INVALID]: 'This file type or size is not allowed.',
  [ContentResponseCode.PRONUNCIATION_UNAVAILABLE]: 'The dictionary is not answering. Try again, or enter the pronunciation yourself.'
});

// data.reason of a MEDIA_INVALID error says which upload rule failed.
const mediaReasons = Object.freeze({
  MEDIA_MIME_TYPE_NOT_ALLOWED: 'This file format is not allowed. Use MP3, MP4 or M4A for audio and JPEG, PNG or WebP for images.',
  MEDIA_EXTENSION_NOT_ALLOWED: 'This file extension is not allowed. Use .mp3, .mp4 or .m4a for audio and .jpg, .jpeg, .png or .webp for images.',
  MEDIA_FILE_TOO_LARGE: 'This file is larger than the upload limit.',
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
  // The gateway refuses files above its own limit before content-service sees them.
  if (error?.response?.status === 413) return mediaReasons.MEDIA_FILE_TOO_LARGE;
  const reason = mediaReasons[error?.response?.data?.data?.reason];
  if (code === ContentResponseCode.MEDIA_INVALID && reason) return reason;
  return messages[code] || error?.response?.data?.data?.message || 'Something went wrong. Please try again.';
}

export function isUnauthorizedError(error) {
  return error?.response?.status === 401 || error?.response?.data?.code === ResponseCode.AUTH_SESSION_EXPIRED;
}
