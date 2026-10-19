import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultsConsumer } from '../src/events/results.consumer.js';

// A channel that records acks and nacks.
function fakeChannel() {
  const channel = { acked: [], nacked: [] };
  channel.ack = (message) => channel.acked.push(message.tag);
  channel.nack = (message, all, requeue) => channel.nacked.push([message.tag, requeue]);
  return channel;
}
const delivery = (tag, body) => ({ tag, content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) });

test('an applied message is acked; unreadable ones are dropped; a storing failure requeues after a pause', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const seen = [];
  const consumer = new ResultsConsumer('amqp://unused');
  consumer.onMessage = async (message) => {
    seen.push(message);
    if (message.type === 'bad-shape') {
      const error = new Error('invalid');
      error.name = 'ZodError';
      error.issues = [];
      throw error;
    }
    if (message.type === 'db-away') throw new Error('database away');
  };
  const channel = fakeChannel();
  assert.equal(await consumer.handle(channel, delivery(1, { type: 'ok' })), 'applied');
  assert.equal(await consumer.handle(channel, delivery(2, '{not json')), 'dropped');
  assert.equal(await consumer.handle(channel, delivery(3, { type: 'bad-shape' })), 'dropped');
  assert.equal(await consumer.handle(channel, delivery(4, { type: 'db-away' })), 'requeued');
  assert.equal(await consumer.handle(channel, null), 'none');
  assert.deepEqual(channel.acked, [1, 2, 3]);
  assert.deepEqual(seen.map((message) => message.type), ['ok', 'bad-shape', 'db-away']);
  // The nack comes after a pause, so a broken database is not hammered.
  assert.deepEqual(channel.nacked, []);
  t.mock.timers.tick(5_000);
  assert.deepEqual(channel.nacked, [[4, true]]);
});
