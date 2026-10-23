import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTEMPT_HEADER, assertRetryTopology, deadQueue, retryOrDead, retryQueue, sendToDead } from '../src/messaging.js';
import { MetricsRegistry, parsePrometheus, quantileFromBuckets } from '../src/metrics.js';
import { JsonLogger, cleanRequestId, currentRequestId, requestIdFromMetadata, runWithRequestId } from '../src/observability.js';

test('the request id follows async work and reaches the JSON log', async () => {
  const lines = [];
  const logger = new JsonLogger('test-service', { write: (line) => lines.push(JSON.parse(line)) });
  assert.equal(cleanRequestId('abc-123'), 'abc-123');
  assert.equal(cleanRequestId('bad id with spaces'), null);
  await runWithRequestId('req-1', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    assert.equal(currentRequestId(), 'req-1');
    logger.log('hello', 'Context');
  });
  assert.equal(currentRequestId(), null);
  assert.deepEqual([lines[0].service, lines[0].level, lines[0].context, lines[0].requestId, lines[0].message], ['test-service', 'info', 'Context', 'req-1', 'hello']);
  runWithRequestId('bad id', () => assert.match(currentRequestId(), /^[0-9a-f-]{36}$/));
  assert.equal(requestIdFromMetadata({ get: () => ['req-2'] }), 'req-2');
});

test('metrics render in the Prometheus format and parse back', async () => {
  const registry = new MetricsRegistry();
  const total = registry.counter('jobs_total', 'Jobs.');
  total.inc({ status: 'ok' });
  total.inc({ status: 'ok' });
  const duration = registry.histogram('job_seconds', 'Job time.', [1, 5]);
  duration.observe({}, 0.5);
  duration.observe({}, 3);
  duration.observe({}, 9);
  registry.collect((target) => target.gauge('queue_depth', 'Depth.').set({ queue: 'q' }, 4));
  const samples = parsePrometheus(await registry.render());
  const value = (name, labels = {}) => samples.find((sample) => sample.name === name && Object.entries(labels).every(([key, v]) => sample.labels[key] === v))?.value;
  assert.equal(value('jobs_total', { status: 'ok' }), 2);
  assert.equal(value('queue_depth', { queue: 'q' }), 4);
  assert.equal(value('job_seconds_count'), 3);
  assert.equal(value('job_seconds_bucket', { le: '5' }), 2);
  assert.equal(quantileFromBuckets(samples, 'job_seconds', 0.5), 5);
  assert.ok(value('process_resident_memory_bytes') > 0);
});

test('a failed message goes to the next retry queue, then to the dead queue', async () => {
  const sent = [];
  const acked = [];
  const asserted = [];
  const channel = {
    assertQueue: async (name, options) => asserted.push([name, options?.arguments?.['x-message-ttl'] ?? null]),
    sendToQueue: (queue, content, options) => sent.push({ queue, attempt: options.headers[ATTEMPT_HEADER], messageId: options.messageId }),
    ack: (message) => acked.push(message),
  };
  await assertRetryTopology(channel, 'q');
  assert.deepEqual(asserted, [['q.retry.1', 10000], ['q.retry.2', 60000], ['q.retry.3', 300000], ['q.dead', null]]);
  const message = (attempt) => ({ content: Buffer.from('{}'), properties: { messageId: 'm1', headers: attempt ? { [ATTEMPT_HEADER]: attempt } : {} } });
  assert.equal(retryOrDead(channel, 'q', message(0), 'db away'), 'retry');
  assert.equal(retryOrDead(channel, 'q', message(2), 'db away'), 'retry');
  assert.equal(retryOrDead(channel, 'q', message(3), 'db away'), 'dead');
  assert.equal(sendToDead(channel, 'q', message(0), 'bad shape'), 'dead');
  assert.deepEqual(sent.map((item) => [item.queue, item.attempt, item.messageId]), [[retryQueue('q', 1), 1, 'm1'], [retryQueue('q', 3), 3, 'm1'], [deadQueue('q'), 4, 'm1'], [deadQueue('q'), 1, 'm1']]);
  assert.equal(acked.length, 4);
});
