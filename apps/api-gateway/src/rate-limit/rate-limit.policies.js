import { createHash } from 'node:crypto';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const RateLimitScope = Object.freeze({
  GLOBAL: 'global',
  LOGIN: 'login',
  REGISTER: 'register',
  OTP: 'otp',
  PASSWORD: 'password',
  UPLOAD: 'upload',
});

export const policies = Object.freeze([
  {
    scope: RateLimitScope.LOGIN,
    routes: [['POST', '/auth/login']],
    limits: [{ by: 'ip+email', limit: 10, windowMs: 15 * MINUTE }, { by: 'ip', limit: 30, windowMs: 15 * MINUTE }],
  },
  {
    scope: RateLimitScope.REGISTER,
    routes: [['POST', '/auth/register']],
    limits: [{ by: 'ip', limit: 5, windowMs: HOUR }],
  },
  {
    scope: RateLimitScope.OTP,
    routes: [['POST', '/auth/verify-email'], ['POST', '/auth/resend-verification'], ['POST', '/auth/forgot-password'], ['POST', '/auth/reset-password'], ['POST', '/auth/accept-invite']],
    limits: [{ by: 'ip+email', limit: 10, windowMs: 15 * MINUTE }, { by: 'ip', limit: 30, windowMs: 15 * MINUTE }],
  },
  {
    scope: RateLimitScope.PASSWORD,
    routes: [['POST', '/auth/profile/password/verify'], ['POST', '/auth/profile/password']],
    limits: [{ by: 'ip', limit: 10, windowMs: 15 * MINUTE }],
  },
  {
    scope: RateLimitScope.UPLOAD,
    routes: [['POST', '/auth/profile/avatar'], ['POST', '/content/media']],
    limits: [{ by: 'ip', limit: 60, windowMs: HOUR }],
  },
  {
    scope: RateLimitScope.GLOBAL,
    routes: null,
    limits: [{ by: 'ip', limit: 300, windowMs: MINUTE }],
  },
]);

export function normalizePath(url = '/') {
  const path = String(url).split('?')[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function policiesFor(method, url) {
  const path = normalizePath(url);
  const verb = String(method || 'GET').toUpperCase();
  return policies.filter((policy) => !policy.routes || policy.routes.some(([m, p]) => m === verb && p === path));
}

export function clientIp(request) {
  return request?.ip || request?.socket?.remoteAddress || 'unknown';
}

export function emailOf(request) {
  const email = request?.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

const short = (value) => createHash('sha256').update(value).digest('hex').slice(0, 16);

export function keysFor(policy, request) {
  const ip = clientIp(request);
  const email = emailOf(request);
  return policy.limits
    .filter((rule) => rule.by === 'ip' || email)
    .map((rule) => ({
      key: `rl:${policy.scope}:${rule.by}:${rule.by === 'ip' ? ip : `${ip}:${short(email)}`}`,
      limit: rule.limit,
      windowMs: rule.windowMs,
    }));
}

export function retryAfterSeconds(resetAt, now = Date.now()) {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}
