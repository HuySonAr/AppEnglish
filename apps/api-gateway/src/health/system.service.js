import { metrics, parsePrometheus, quantileFromBuckets } from '@appenglish/backend-common/metrics';

const SERVICES = Object.freeze([
  { name: 'api-gateway', self: true },
  { name: 'auth-service', port: 'AUTH_SERVICE_PORT', fallback: 3001 },
  { name: 'content-service', port: 'CONTENT_SERVICE_PORT', fallback: 3002 },
  { name: 'learning-service', port: 'LEARNING_SERVICE_PORT', fallback: 3003 },
  { name: 'progress-service', port: 'PROGRESS_SERVICE_PORT', fallback: 3004 },
  { name: 'writing-service', port: 'WRITING_SERVICE_PORT', fallback: 3005 },
]);
const QUEUE_PREFIXES = ['learning.results', 'speech.', 'writing.'];
const TIMEOUT_MS = 2000;

const sum = (samples, name, match = () => true) => samples.filter((sample) => sample.name === name && match(sample.labels)).reduce((total, sample) => total + sample.value, 0);
const one = (samples, name) => samples.find((sample) => sample.name === name)?.value ?? null;
const round = (value, digits = 3) => (value === null || value === undefined ? null : Number(value.toFixed(digits)));

export function summarizeService(name, samples) {
  const requests = sum(samples, 'http_requests_total') + sum(samples, 'grpc_requests_total');
  const errors = sum(samples, 'http_requests_total', (labels) => labels.status === '5xx') + sum(samples, 'grpc_requests_total', (labels) => labels.result === 'error');
  const latency = quantileFromBuckets(samples, 'http_request_duration_seconds', 0.95) ?? quantileFromBuckets(samples, 'grpc_request_duration_seconds', 0.95);
  const outcomes = {};
  for (const sample of samples.filter((item) => item.name === 'messages_handled_total')) outcomes[sample.labels.outcome] = (outcomes[sample.labels.outcome] || 0) + sample.value;
  const sessions = {};
  for (const sample of samples.filter((item) => item.name === 'session_lookups_total')) sessions[sample.labels.source] = sample.value;
  const speechCount = sum(samples, 'speech_jobs_total');
  const gradingCount = sum(samples, 'grading_jobs_total');
  return {
    name,
    status: 'ok',
    uptimeSeconds: round(one(samples, 'process_uptime_seconds'), 0),
    cpuSeconds: round(one(samples, 'process_cpu_seconds_total'), 2),
    memoryMb: round((one(samples, 'process_resident_memory_bytes') || 0) / 1048576, 1),
    requests,
    errors,
    p95Seconds: latency,
    outbox: samples.some((sample) => sample.name === 'outbox_published_total' || sample.name === 'outbox_pending')
      ? { published: sum(samples, 'outbox_published_total'), pending: sum(samples, 'outbox_pending') }
      : null,
    messages: Object.keys(outcomes).length ? outcomes : null,
    sessions: Object.keys(sessions).length ? sessions : null,
    speech: speechCount
      ? {
          finished: speechCount,
          failed: sum(samples, 'speech_jobs_total', (labels) => labels.status === 'FAILED'),
          waitP95Seconds: quantileFromBuckets(samples, 'speech_job_wait_seconds', 0.95),
          workP95Seconds: quantileFromBuckets(samples, 'speech_job_work_seconds', 0.95),
        }
      : null,
    grading: samples.some((sample) => sample.name === 'grading_jobs_total' || sample.name === 'key_checks_total')
      ? {
          finished: gradingCount,
          failed: sum(samples, 'grading_jobs_total', (labels) => labels.status === 'FAILED'),
          workP95Seconds: quantileFromBuckets(samples, 'grading_job_seconds', 0.95),
          keyChecks: sum(samples, 'key_checks_total'),
        }
      : null,
  };
}

export function managementUrl(env = process.env) {
  if (env.RABBITMQ_MANAGEMENT_URL) return env.RABBITMQ_MANAGEMENT_URL.replace(/\/$/, '');
  try {
    const amqp = new URL(env.RABBITMQ_URL || 'amqp://localhost:5672');
    return `http://${amqp.hostname}:15672`;
  } catch {
    return 'http://localhost:15672';
  }
}

function managementAuth(env = process.env) {
  try {
    const amqp = new URL(env.RABBITMQ_URL || 'amqp://localhost:5672');
    const user = decodeURIComponent(amqp.username || 'guest');
    const password = decodeURIComponent(amqp.password || 'guest');
    return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
  } catch {
    return `Basic ${Buffer.from('guest:guest').toString('base64')}`;
  }
}

async function fetchWithTimeout(fetchImpl, url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function systemOverview({ env = process.env, fetchImpl = fetch } = {}) {
  const services = await Promise.all(
    SERVICES.map(async (spec) => {
      try {
        const text = spec.self ? await metrics.render() : await (async () => {
          const response = await fetchWithTimeout(fetchImpl, `http://localhost:${env[spec.port] || spec.fallback}/metrics`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })();
        return summarizeService(spec.name, parsePrometheus(text));
      } catch (error) {
        return { name: spec.name, status: 'down', detail: error?.name === 'AbortError' ? 'no answer' : error?.message || 'down' };
      }
    }),
  );
  let queues = null;
  let queuesError = null;
  try {
    const response = await fetchWithTimeout(fetchImpl, `${managementUrl(env)}/api/queues`, { headers: { authorization: managementAuth(env) } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    queues = (await response.json())
      .filter((queue) => QUEUE_PREFIXES.some((prefix) => queue.name.startsWith(prefix)))
      .map((queue) => ({
        name: queue.name,
        kind: queue.name.endsWith('.dead') ? 'dead' : /\.retry\.\d+$/.test(queue.name) ? 'retry' : 'main',
        ready: queue.messages_ready ?? 0,
        unacked: queue.messages_unacknowledged ?? 0,
        consumers: queue.consumers ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    queuesError = error?.name === 'AbortError' ? 'RabbitMQ management did not answer' : `RabbitMQ management: ${error?.message || 'unavailable'}`;
  }
  return { checkedAt: new Date().toISOString(), services, queues, queuesError };
}
