export const AccountRole = Object.freeze({
  STUDENT: 'STUDENT',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  TEACHER: 'TEACHER',
  ADMIN: 'ADMIN'
});

export const AccountStatus = Object.freeze({
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  SUSPENDED: 'SUSPENDED'
});

export const AuthCookie = Object.freeze({
  ACCESS: 'appenglish_access',
  REFRESH: 'appenglish_refresh'
});

export const OtpPurpose = Object.freeze({
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  RESET_PASSWORD: 'RESET_PASSWORD',
  INVITE: 'INVITE'
});

export const ResponseCode = Object.freeze({
  SUCCESS: 0,
  ADDITIONAL: 1,
  FAIL: -1,
  AUTH_INVALID_CREDENTIALS: 10,
  AUTH_UNAUTHORIZED: 11,
  AUTH_NOT_FOUND: 12,
  AUTH_EMAIL_NOT_VERIFIED: 13,
  AUTH_ACCOUNT_DISABLED: 14,
  AUTH_OTP_INVALID: 15,
  AUTH_OTP_EXPIRED: 16,
  AUTH_OTP_ATTEMPTS_EXCEEDED: 17,
  AUTH_OTP_RATE_LIMITED: 18,
  AUTH_EMAIL_ALREADY_REGISTERED: 19,
  AUTH_REFRESH_TOKEN_REUSED: 20,
  AUTH_SESSION_EXPIRED: 21,
  AUTH_ACCOUNT_SUSPENDED: 22,
  AUTH_ADMIN_LAST_ACCOUNT: 23,
  AUTH_ADMIN_AUDIT_ERROR: 24,
  AUTH_EMAIL_VERIFICATION_REQUIRED: 25,
  AUTH_FORBIDDEN_ROLE: 26,
  AUTH_CURRENT_PASSWORD_INVALID: 27,
  AVATAR_INVALID: 28,
  AUTH_REASON_REQUIRED: 29,
  VALIDATION_ERROR: 30,
  EMAIL_SEND_ERROR: 31,
  SYSTEM_ERROR: 32,
  RATE_LIMITED: 33
});

export const ResponseMsg = Object.freeze({ SUCCESS: 'success', ADDITIONAL: 'additional', FAIL: 'fail' });
export const NextAction = Object.freeze({ VERIFY_EMAIL: 'VERIFY_EMAIL', LOGIN: 'LOGIN', RESET_PASSWORD: 'RESET_PASSWORD' });

export const PROFILE_LIMITS = Object.freeze({
  displayNameMax: 50,
  avatarMaxBytes: 2 * 1024 * 1024,
  avatarMimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  avatarExtensions: Object.freeze(['.jpg', '.jpeg', '.png', '.webp']),
  avatarSize: 256
});

export function displayNameOf({ displayName, email } = {}) {
  const name = typeof displayName === 'string' ? displayName.trim() : '';
  if (name) return name;
  const local = String(email || '').split('@')[0];
  return local || 'Learner';
}

export function avatarInitialOf(account) {
  return displayNameOf(account).slice(0, 1).toUpperCase();
}

export const AdminAccountAction = Object.freeze({
  REVOKE_SESSIONS: 'REVOKE_SESSIONS',
  SEND_PASSWORD_RESET: 'SEND_PASSWORD_RESET',
  REMOVE_AVATAR: 'REMOVE_AVATAR',
  RESET_DISPLAY_NAME: 'RESET_DISPLAY_NAME',
  ACTIVATE: 'ACTIVATE',
  RESEND_VERIFICATION: 'RESEND_VERIFICATION',
  RESEND_INVITE: 'RESEND_INVITE',
  RESET_PLACEMENT: 'RESET_PLACEMENT'
});

export const AccountAuditAction = Object.freeze({
  ROLE_UPDATED: 'ROLE_UPDATED',
  STATUS_UPDATED: 'STATUS_UPDATED',
  ROLE_STATUS_UPDATED: 'ROLE_STATUS_UPDATED',
  SESSIONS_REVOKED: 'SESSIONS_REVOKED',
  PASSWORD_RESET_SENT: 'PASSWORD_RESET_SENT',
  AVATAR_REMOVED: 'AVATAR_REMOVED',
  DISPLAY_NAME_RESET: 'DISPLAY_NAME_RESET',
  ACCOUNT_INVITED: 'ACCOUNT_INVITED',
  INVITE_RESENT: 'INVITE_RESENT',
  INVITE_ACCEPTED: 'INVITE_ACCEPTED',
  VERIFICATION_RESENT: 'VERIFICATION_RESENT',
  ACCOUNT_ACTIVATED: 'ACCOUNT_ACTIVATED',
  PLACEMENT_RESET: 'PLACEMENT_RESET'
});

export const AdminAccountSort = Object.freeze({
  NEWEST: 'newest',
  OLDEST: 'oldest',
  LAST_LOGIN: 'lastLogin',
  EMAIL: 'email'
});

export const STALE_PENDING_DAYS = 7;
export const ADMIN_STATS_DAYS = 30;
export const ADMIN_AUDIT_LIMIT = 50;
export const INVITE_TTL_HOURS = 72;
