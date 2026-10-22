import { createHash } from 'node:crypto';

// Rate limits of the public gateway (D117). Pure: which policies apply to a
// request and under which keys they count. Windows are fixed; a key may be
// used at most `limit` times per `windowMs`.

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

// Each policy: the routes it covers, its limits per key kind ('ip' or
// 'ip+email'), and the window. Order matters only for the error message: the
// first exceeded policy is reported.
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
    routes: null, // every route
    limits: [{ by: 'ip', limit: 300, windowMs: MINUTE }],
  },
]);

// The path without query string or trailing slash.
export function normalizePath(url = '/') {
  const path = String(url).split('?')[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

// The policies that apply to one request.
export function policiesFor(method, url) {
  const path = normalizePath(url);
  const verb = String(method || 'GET').toUpperCase();
  return policies.filter((policy) => !policy.routes || policy.routes.some(([m, p]) => m === verb && p === path));
}

// The caller's address. Behind a trusted proxy Express fills request.ip from
// X-Forwarded-For; otherwise it is the socket address.
export function clientIp(request) {
  return request?.ip || request?.socket?.remoteAddress || 'unknown';
}

// The email a sign-in or OTP request is about, lower-cased, or '' when absent.
export function emailOf(request) {
  const email = request?.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

const short = (value) => createHash('sha256').update(value).digest('hex').slice(0, 16);

// The counter keys of one request under one policy: [{ key, limit, windowMs }].
// Emails are hashed so the store never holds them in clear.
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

// Seconds the caller should wait, from a window's reset time.
export function retryAfterSeconds(resetAt, now = Date.now()) {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}
