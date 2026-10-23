import { HttpException, Logger } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { metrics } from '@appenglish/backend-common/metrics';
import { callAuth, sessionTokens } from './auth-gateway.controller.js';

export const SESSION_CACHE_SECONDS = 30;

const logger = new Logger('SessionCache');
const lookups = metrics.counter('session_lookups_total', 'Sessions resolved by the gateway, by source.');

const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

export function verifyAccessToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token || !secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = decode(parts[0]);
    if (header.alg !== 'HS256') return null;
    const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const given = Buffer.from(parts[2], 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const claims = decode(parts[1]);
    if (claims.type !== 'access' || !claims.sub || !Number.isFinite(claims.exp) || claims.exp <= nowSeconds) return null;
    return claims;
  } catch {
    return null;
  }
}

export class MemorySessionStore {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.entries = new Map();
  }

  async get(key) {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, seconds) {
    if (this.entries.size > 10_000) this.entries.clear();
    this.entries.set(key, { value, expiresAt: this.now() + seconds * 1000 });
  }
}

export class RedisSessionStore {
  constructor(url) {
    this.url = url;
    this.client = null;
    this.lastWarning = 0;
  }

  async connect() {
    if (this.client) return this.client;
    const { default: Redis } = await import('ioredis');
    this.client = new Redis(this.url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2000 });
    this.client.on('error', (error) => this.warn(error));
    await this.client.connect();
    return this.client;
  }

  async get(key) {
    try {
      const value = await (await this.connect()).get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.warn(error);
      return null;
    }
  }

  async set(key, value, seconds) {
    try {
      await (await this.connect()).set(key, JSON.stringify(value), 'EX', seconds);
    } catch (error) {
      this.warn(error);
    }
  }

  warn(error) {
    if (Date.now() - this.lastWarning < 60_000) return;
    this.lastWarning = Date.now();
    logger.warn(`Redis unavailable, sessions are checked with auth-service (${error?.message || error})`);
  }
}

export class SessionResolver {
  constructor({ store, secret, now = () => Date.now() }) {
    this.store = store;
    this.secret = secret;
    this.now = now;
  }

  async resolve(auth, request) {
    const token = sessionTokens(request).accessToken;
    const nowSeconds = Math.floor(this.now() / 1000);
    const claims = verifyAccessToken(token, this.secret, nowSeconds);
    const key = claims ? `session:${createHash('sha256').update(token).digest('hex')}` : null;
    if (key) {
      const cached = await this.store.get(key);
      if (cached) {
        lookups.inc({ source: 'cache' });
        return cached;
      }
    }
    const { status, payload } = await callAuth(auth, 'Me', { accessToken: token });
    if (status >= 400) {
      lookups.inc({ source: 'refused' });
      throw new HttpException(payload, status);
    }
    const { id, role, email } = payload.data.account;
    const account = { id, role, email: email || '' };
    lookups.inc({ source: 'auth' });
    if (key && claims.sub === id) await this.store.set(key, account, Math.max(1, Math.min(SESSION_CACHE_SECONDS, claims.exp - nowSeconds)));
    return account;
  }
}

let shared = null;

export function sessionResolver(env = process.env) {
  if (shared) return shared;
  const kind = env.RATE_LIMIT_STORE || (env.REDIS_URL ? 'redis' : 'memory');
  shared = new SessionResolver({
    store: kind === 'redis' && env.REDIS_URL ? new RedisSessionStore(env.REDIS_URL) : new MemorySessionStore(),
    secret: env.AUTH_JWT_SECRET || '',
  });
  return shared;
}

export function resolveSession(auth, request) {
  return sessionResolver().resolve(auth, request);
}
