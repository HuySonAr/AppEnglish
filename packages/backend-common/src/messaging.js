import { metrics } from './metrics.js';

export const RETRY_DELAYS_MS = Object.freeze([10_000, 60_000, 300_000]);
export const ATTEMPT_HEADER = 'x-attempt';
export const ERROR_HEADER = 'x-last-error';

export const retryQueue = (queue, attempt) => `${queue}.retry.${attempt}`;
export const deadQueue = (queue) => `${queue}.dead`;

const messagesTotal = metrics.counter('messages_handled_total', 'Broker messages handled, by queue and outcome.');

export function countMessage(queue, outcome) {
  messagesTotal.inc({ queue, outcome });
}

export async function assertRetryTopology(channel, queue, delays = RETRY_DELAYS_MS) {
  for (const [index, delay] of delays.entries())
    await channel.assertQueue(retryQueue(queue, index + 1), {
      durable: true,
      arguments: { 'x-message-ttl': delay, 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': queue },
    });
  await channel.assertQueue(deadQueue(queue), { durable: true });
}

export function attemptOf(message) {
  const value = Number(message?.properties?.headers?.[ATTEMPT_HEADER] || 0);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function republish(channel, queue, message, attempt, reason) {
  const { headers = {}, ...properties } = message.properties || {};
  channel.sendToQueue(queue, message.content, {
    ...properties,
    persistent: true,
    headers: { ...headers, [ATTEMPT_HEADER]: attempt, [ERROR_HEADER]: String(reason || '').slice(0, 500) },
  });
}

export function retryOrDead(channel, queue, message, reason, delays = RETRY_DELAYS_MS) {
  const attempt = attemptOf(message);
  const dead = attempt >= delays.length;
  republish(channel, dead ? deadQueue(queue) : retryQueue(queue, attempt + 1), message, attempt + 1, reason);
  channel.ack(message);
  countMessage(queue, dead ? 'dead' : 'retry');
  return dead ? 'dead' : 'retry';
}

export function sendToDead(channel, queue, message, reason) {
  republish(channel, deadQueue(queue), message, attemptOf(message) + 1, reason);
  channel.ack(message);
  countMessage(queue, 'dead');
  return 'dead';
}
