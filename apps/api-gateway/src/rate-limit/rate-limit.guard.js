import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { ResponseCode } from '@appenglish/auth-contracts';
import { keysFor, policiesFor, retryAfterSeconds } from './rate-limit.policies.js';
import { RATE_LIMIT_STORE } from './rate-limit.store.js';

const logger = new Logger('RateLimit');

// Decides one request from the counters it just incremented: the first key
// over its limit wins. Pure, so the rule is testable without Nest.
export function decide(hits) {
  const exceeded = hits.find((hit) => hit.count > hit.limit);
  if (!exceeded) return { allowed: true };
  return { allowed: false, scope: exceeded.scope, limit: exceeded.limit, retryAfterSeconds: retryAfterSeconds(exceeded.resetAt) };
}

// The 429 envelope (D117): the shared { code, msg, data } shape, Retry-After set.
export function tooManyRequests(decision) {
  return new HttpException(
    { code: ResponseCode.RATE_LIMITED, msg: 'fail', data: { scope: decision.scope, limit: decision.limit, retryAfterSeconds: decision.retryAfterSeconds } },
    429,
  );
}

// Global guard of the gateway (D117): counts every request under the policies
// that apply to it and refuses with 429 once a limit is passed. Health routes
// are never limited. If the store fails, the request passes (fail open).
export class RateLimitGuard {
  constructor(store) {
    this.store = store;
    this.enabled = process.env.RATE_LIMIT_ENABLED !== 'false';
    this.lastWarning = 0;
  }

  async canActivate(context) {
    if (!this.enabled) return true;
    const http = context.switchToHttp();
    const request = http.getRequest();
    if (String(request.url || '').startsWith('/health')) return true;
    const applicable = policiesFor(request.method, request.url);
    let hits;
    try {
      hits = await Promise.all(
        applicable.flatMap((policy) =>
          keysFor(policy, request).map(async (rule) => ({ ...rule, scope: policy.scope, ...(await this.store.hit(rule.key, rule.windowMs)) })),
        ),
      );
    } catch (error) {
      const now = Date.now();
      if (now - this.lastWarning > 60000) {
        this.lastWarning = now;
        logger.warn(`Rate limit store failed, request allowed (${error?.message || error})`);
      }
      return true;
    }
    const decision = decide(hits);
    if (decision.allowed) return true;
    http.getResponse().setHeader('Retry-After', String(decision.retryAfterSeconds));
    throw tooManyRequests(decision);
  }
}

Injectable()(RateLimitGuard);
Inject(RATE_LIMIT_STORE)(RateLimitGuard, undefined, 0);
