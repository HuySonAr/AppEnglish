import { Logger } from '@nestjs/common';

export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

const logger = new Logger('RateLimit');

// A store answers hit(key, windowMs) with { count, resetAt }: the number of
// hits of that key in its current fixed window, this one included.

// Counters in process memory: for tests and for a single gateway without Redis.
export class MemoryRateLimitStore {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.windows = new Map();
    this.lastPrune = 0;
  }

  async hit(key, windowMs) {
    const now = this.now();
    this.prune(now);
    let entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, entry);
    }
    entry.count += 1;
    return { count: entry.count, resetAt: entry.resetAt };
  }

  // Expired windows are dropped at most once a minute so memory stays bounded.
  prune(now) {
    if (now - this.lastPrune < 60000) return;
    this.lastPrune = now;
    for (const [key, entry] of this.windows) if (entry.resetAt <= now) this.windows.delete(key);
  }
}

// Counters in Redis, shared by every gateway instance: INCR, and the window's
// expiry set when the key is new. The client is created lazily so the gateway
// starts without Redis; a failing call throws and the guard lets the request
// through (fail open), logging at most once a minute.
export class RedisRateLimitStore {
  constructor({ url, client } = {}) {
    this.url = url;
    this.client = client || null;
    this.lastWarning = 0;
  }

  async connect() {
    if (this.client) return this.client;
    const { default: Redis } = await import('ioredis');
    this.client = new Redis(this.url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2000 });
    this.client.on('error', (error) => this.warn(error));
    await this.client.connect().catch((error) => {
      this.warn(error);
      throw error;
    });
    return this.client;
  }

  async hit(key, windowMs) {
    const client = await this.connect();
    const [[, count], [, ttl]] = await client.multi().incr(key).pttl(key).exec().then((results) => {
      for (const [error] of results) if (error) throw error;
      return results;
    });
    let remaining = Number(ttl);
    if (remaining < 0) {
      await client.pexpire(key, windowMs);
      remaining = windowMs;
    }
    return { count: Number(count), resetAt: Date.now() + remaining };
  }

  warn(error) {
    const now = Date.now();
    if (now - this.lastWarning < 60000) return;
    this.lastWarning = now;
    logger.warn(`Redis unavailable, requests pass without limits (${error?.message || error})`);
  }
}

// RATE_LIMIT_STORE=redis (default when REDIS_URL is set) or memory.
export function createRateLimitStore(env = process.env) {
  const kind = env.RATE_LIMIT_STORE || (env.REDIS_URL ? 'redis' : 'memory');
  if (kind === 'memory') return new MemoryRateLimitStore();
  if (kind === 'redis') {
    if (!env.REDIS_URL) throw new Error('REDIS_URL is required when RATE_LIMIT_STORE is redis');
    return new RedisRateLimitStore({ url: env.REDIS_URL });
  }
  throw new Error(`Unsupported RATE_LIMIT_STORE: ${kind}`);
}
