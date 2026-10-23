import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrometheus } from '@appenglish/backend-common/metrics';
import { managementUrl, summarizeService, systemOverview } from '../src/health/system.service.js';

const TEXT = `process_uptime_seconds 120
process_cpu_seconds_total 3.5
process_resident_memory_bytes 104857600
grpc_requests_total{method="GetMockTest",result="ok"} 98
grpc_requests_total{method="GetMockTest",result="error"} 2
grpc_request_duration_seconds_bucket{method="GetMockTest",le="0.05"} 90
grpc_request_duration_seconds_bucket{method="GetMockTest",le="0.1"} 99
grpc_request_duration_seconds_bucket{method="GetMockTest",le="+Inf"} 100
outbox_published_total{outbox="learning_events"} 40
outbox_pending{outbox="learning_events"} 3
messages_handled_total{queue="learning.results",outcome="applied"} 30
messages_handled_total{queue="learning.results",outcome="duplicate"} 2
`;

test('a service summary reads uptime, memory, requests, errors, p95, outbox and messages', () => {
  const summary = summarizeService('learning-service', parsePrometheus(TEXT));
  assert.deepEqual(
    [summary.uptimeSeconds, summary.cpuSeconds, summary.memoryMb, summary.requests, summary.errors, summary.p95Seconds],
    [120, 3.5, 100, 100, 2, 0.1],
  );
  assert.deepEqual(summary.outbox, { published: 40, pending: 3 });
  assert.deepEqual(summary.messages, { applied: 30, duplicate: 2 });
  assert.equal(summary.speech, null);
});

test('the overview marks a silent service down and lists only the app queues', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/api/queues'))
      return { ok: true, json: async () => [
        { name: 'learning.results', messages_ready: 0, messages_unacknowledged: 1, consumers: 1 },
        { name: 'learning.results.dead', messages_ready: 2, messages_unacknowledged: 0, consumers: 0 },
        { name: 'speech.autotime.results.retry.1', messages_ready: 1, messages_unacknowledged: 0, consumers: 0 },
        { name: 'other.queue', messages_ready: 9 },
      ] };
    if (url.includes(':3004')) throw new Error('connect ECONNREFUSED');
    return { ok: true, text: async () => TEXT };
  };
  const overview = await systemOverview({ env: {}, fetchImpl });
  assert.deepEqual(overview.services.map((service) => [service.name, service.status]), [['api-gateway', 'ok'], ['auth-service', 'ok'], ['content-service', 'ok'], ['learning-service', 'ok'], ['progress-service', 'down']]);
  assert.deepEqual(overview.queues.map((queue) => [queue.name, queue.kind, queue.ready]), [['learning.results', 'main', 0], ['learning.results.dead', 'dead', 2], ['speech.autotime.results.retry.1', 'retry', 1]]);
  assert.equal(managementUrl({ RABBITMQ_URL: 'amqp://user:pw@broker:5672' }), 'http://broker:15672');
});
