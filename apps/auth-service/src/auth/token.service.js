import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { authErrors } from './auth.errors.js';

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function parseDuration(value, fallbackSeconds) {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(value || '');
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  const multiplier =
    { s: 1, m: 60, h: 3600, d: 86400 }[(match[2] || 's').toLowerCase()] || 1;
  return amount * multiplier;
}

export class TokenService {
  constructor() {
    this.secret = process.env.AUTH_JWT_SECRET;
    if (!this.secret || this.secret.length < 32) {
      throw new Error('AUTH_JWT_SECRET must be set to at least 32 characters');
    }
    this.accessTtlSeconds = parseDuration(process.env.AUTH_ACCESS_TTL, 900);
    this.refreshTtlSeconds = parseDuration(
      process.env.AUTH_REFRESH_TTL,
      604800,
    );
    this.cookieSecure =
      process.env.NODE_ENV === 'production' ||
      process.env.AUTH_COOKIE_SECURE === 'true';
    this.sameSite = process.env.AUTH_COOKIE_SAMESITE || 'Lax';
    this.cookiePath = process.env.AUTH_COOKIE_PATH || '/';
  }

  createAccessToken(account) {
    const now = Math.floor(Date.now() / 1000);
    return this.sign({
      sub: account.id,
      email: account.email,
      role: account.role,
      iat: now,
      exp: now + this.accessTtlSeconds,
      type: 'access',
      sv: account.sessionVersion || 0,
    });
  }

  createRefreshToken(account, familyId = randomUUID()) {
    const rawToken = randomBytes(48).toString('base64url');
    return {
      rawToken,
      tokenHash: this.hashRefreshToken(rawToken),
      familyId,
      expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
    };
  }

  verifyAccessToken(token) {
    try {
      const [encodedHeader, encodedPayload, encodedSignature] =
        token.split('.');
      if (!encodedHeader || !encodedPayload || !encodedSignature)
        throw new Error('invalid token');
      const expected = this.signEncoded(encodedHeader, encodedPayload);
      const actualBuffer = Buffer.from(encodedSignature);
      const expectedBuffer = Buffer.from(expected);
      if (
        actualBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(actualBuffer, expectedBuffer)
      ) {
        throw new Error('invalid signature');
      }
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      );
      if (
        payload.type !== 'access' ||
        !payload.sub ||
        payload.exp <= Math.floor(Date.now() / 1000)
      ) {
        throw new Error('expired token');
      }
      return payload;
    } catch {
      throw authErrors.sessionExpired();
    }
  }

  hashRefreshToken(rawToken) {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  accessCookie(token) {
    return this.cookie('appenglish_access', token, this.accessTtlSeconds);
  }

  refreshCookie(token) {
    return this.cookie('appenglish_refresh', token, this.refreshTtlSeconds);
  }

  clearCookies() {
    return [
      this.cookie('appenglish_access', '', 0),
      this.cookie('appenglish_refresh', '', 0),
    ];
  }

  cookie(name, value, maxAge) {
    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      `Max-Age=${maxAge}`,
      `Path=${this.cookiePath}`,
      `HttpOnly`,
      `SameSite=${this.sameSite}`,
    ];
    if (this.cookieSecure) parts.push('Secure');
    return parts.join('; ');
  }

  sign(payload) {
    const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64Url(JSON.stringify(payload));
    return `${header}.${body}.${this.signEncoded(header, body)}`;
  }

  signEncoded(header, body) {
    return createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64url');
  }
}
