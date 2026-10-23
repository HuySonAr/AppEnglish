import test from 'node:test';
import assert from 'node:assert/strict';
import { currentRequestId } from '@appenglish/backend-common/observability';
import { ResultsConsumer } from '../src/events/results.consumer.js';

function fakeChannel() {
  const channel = { acked: [], sent: [] };
  channel.ack = (message) => channel.acked.push(message.tag);
  channel.sendToQueue = (queue, content, options) => channel.sent.push([queue, options.headers['x-attempt']]);
  return channel;
}
const delivery = (tag, body, attempt = 0) => ({
  tag,
  content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
  properties: { messageId: `m${tag}`, headers: attempt ? { 'x-attempt': attempt } : {} },
});

test('applied and duplicate messages are acked; bad ones go to the dead queue; a storing failure is retried, then dead', async () => {
  const seen = [];
  const consumer = new ResultsConsumer('amqp://unused');
  consumer.onMessage = async (message) => {
    seen.push([message.type, currentRequestId()]);
    if (message.type === 'again') return 'duplicate';
    if (message.type === 'bad-shape') {
      const error = new Error('invalid');
      error.name = 'ZodError';
      error.issues = [];
      throw error;
    }
    if (message.type === 'db-away') throw new Error('database away');
    return 'applied';
  };
  const channel = fakeChannel();
  assert.equal(await consumer.handle(channel, delivery(1, { type: 'ok', requestId: 'req-9' })), 'applied');
  assert.equal(await consumer.handle(channel, delivery(2, { type: 'again' })), 'duplicate');
  assert.equal(await consumer.handle(channel, delivery(3, '{not json')), 'dead');
  assert.equal(await consumer.handle(channel, delivery(4, { type: 'bad-shape' })), 'dead');
  assert.equal(await consumer.handle(channel, delivery(5, { type: 'db-away' })), 'retry');
  assert.equal(await consumer.handle(channel, delivery(6, { type: 'db-away' }, 3)), 'dead');
  assert.equal(await consumer.handle(channel, null), 'none');
  assert.deepEqual(channel.acked, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(channel.sent, [['learning.results.dead', 1], ['learning.results.dead', 1], ['learning.results.retry.1', 1], ['learning.results.dead', 4]]);
  assert.deepEqual(seen[0], ['ok', 'req-9']);
});
