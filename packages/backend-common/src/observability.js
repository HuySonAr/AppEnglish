import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

const store = new AsyncLocalStorage();

export function cleanRequestId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(value) ? value : null;
}

export function newRequestId() {
  return randomUUID();
}

export function runWithRequestId(requestId, task) {
  return store.run({ requestId: cleanRequestId(requestId) || newRequestId() }, task);
}

export function currentRequestId() {
  return store.getStore()?.requestId || null;
}

export function requestIdFromMetadata(metadata) {
  const value = metadata?.get?.(REQUEST_ID_HEADER)?.[0];
  return cleanRequestId(typeof value === 'string' ? value : value?.toString?.());
}

const LEVELS = ['error', 'warn', 'log', 'debug', 'verbose', 'fatal'];

export class JsonLogger {
  constructor(service, { write = (line) => process.stdout.write(`${line}\n`) } = {}) {
    this.service = service;
    this.write = write;
    for (const level of LEVELS) this[level] = (message, ...rest) => this.print(level, message, rest);
  }

  print(level, message, rest) {
    const context = rest.length && typeof rest.at(-1) === 'string' ? rest.at(-1) : undefined;
    const stack = level === 'error' && rest.length > 1 && typeof rest[0] === 'string' ? rest[0] : undefined;
    const entry = {
      time: new Date().toISOString(),
      level: level === 'log' ? 'info' : level,
      service: this.service,
      ...(context ? { context } : {}),
      ...(currentRequestId() ? { requestId: currentRequestId() } : {}),
      message: message instanceof Error ? message.message : typeof message === 'string' ? message : JSON.stringify(message),
      ...(stack ? { stack } : {}),
    };
    this.write(JSON.stringify(entry));
  }

  setLogLevels() {}
}
