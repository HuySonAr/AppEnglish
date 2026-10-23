import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { parseArgs } from 'node:util';
import amqp from 'amqplib';
import { seal } from '@appenglish/backend-common/secret-box';
import { WRITING_CRITERIA } from '@appenglish/learning-contracts';
import { WritingBroker } from '../src/broker.js';
import { GeminiClient } from '../src/gemini.js';

const { values } = parseArgs({
  options: {
    jobs: { type: 'string', default: '200' },
    concurrency: { type: 'string', default: '4' },
    quota: { type: 'string', default: '0.1' },
    outage: { type: 'string', default: '0.05' },
    garbage: { type: 'string', default: '0.05' },
    restart: { type: 'boolean', default: true },
    timeout: { type: 'string', default: '180' },
  },
});
const total = Number(values.jobs);
const rates = { quota: Number(values.quota), outage: Number(values.outage), garbage: Number(values.garbage) };
const calls = { ok: 0, quota: 0, outage: 0, garbage: 0 };
const answer = 'I want take Friday off because my sister has her wedding. I will finish the report on Thursday. Thank you.';

const mock = createServer((request, response) => {
  if (request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'application/json' });
    return response.end('{}');
  }
  request.resume();
  request.on('end', () => {
    setTimeout(() => {
      const roll = Math.random();
      const send = (status, body) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      };
      if (roll < rates.quota) return calls.quota++, send(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } });
      if (roll < rates.quota + rates.outage) return calls.outage++, send(503, { error: { status: 'UNAVAILABLE', message: 'busy' } });
      if (roll < rates.quota + rates.outage + rates.garbage) return calls.garbage++, send(200, { candidates: [{ content: { parts: [{ text: 'not json' }] } }] });
      calls.ok++;
      const criteria = Object.fromEntries(WRITING_CRITERIA.map((key) => [key, 2 + Math.round(Math.random() * 6) / 2]));
      send(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ criteria, feedback: 'ok', errors: [{ text: 'want take', suggestion: 'want to take', explanation: 'Use to.' }], rewrite: 'ok' }) }] } }] });
    }, 50 + Math.random() * 350);
  });
});
await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
const apiUrl = `http://127.0.0.1:${mock.address().port}`;

const run = `loadtest.${randomUUID().slice(0, 8)}`;
const queues = { requests: `${run}.requests`, results: `${run}.results`, openResults: `${run}.open-results`, keyChecks: `${run}.key-checks` };
const retryDelays = [300, 600, 1200];
const secret = randomBytes(32).toString('base64url');
const config = { rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672', model: 'mock-model', secret, concurrency: Number(values.concurrency), queues, retryDelays };
const quiet = { log() {}, warn() {} };
const makeBroker = () => new WritingBroker(config, { gemini: new GeminiClient({ apiUrl, model: 'mock-model', timeoutMs: 5000 }), logger: quiet });

let broker = makeBroker();
await broker.start();
const connection = await amqp.connect(config.rabbitmqUrl);
const channel = await connection.createChannel();
await channel.assertQueue(queues.requests, { durable: true });
await channel.assertQueue(queues.results, { durable: true });

const sentAt = new Map();
const answers = new Map();
const latencies = [];
let restarted = false;
const finished = new Promise((resolve) => {
  channel.consume(queues.results, async (message) => {
    if (!message) return;
    const body = JSON.parse(message.content.toString());
    channel.ack(message);
    const seen = answers.get(body.submissionId) || [];
    seen.push(body.status);
    answers.set(body.submissionId, seen);
    if (seen.length === 1) latencies.push(Date.now() - sentAt.get(body.submissionId));
    if (values.restart && !restarted && answers.size >= total * 0.3) {
      restarted = true;
      await broker.stop();
      broker = makeBroker();
      await broker.start();
    }
    if (answers.size >= total) resolve();
  });
});

const started = Date.now();
const key = seal('AIzaLoadTestKey000000000000', secret);
for (let i = 0; i < total; i++) {
  const submissionId = randomUUID();
  sentAt.set(submissionId, Date.now());
  channel.sendToQueue(
    queues.requests,
    Buffer.from(JSON.stringify({ id: randomUUID(), type: 'writing.requested', payload: { submissionId, accountId: randomUUID(), prompt: { title: 'Day off', level: 'A2', taskType: 'email', instructions: 'Write an email.', minWords: 5, maxWords: 80, sampleAnswer: 'Dear Ms Lee...', keyPoints: [] }, answer, key } })),
    { persistent: true, contentType: 'application/json', messageId: submissionId },
  );
}

const timedOut = await Promise.race([finished.then(() => false), new Promise((resolve) => setTimeout(() => resolve(true), Number(values.timeout) * 1000))]);
const elapsed = (Date.now() - started) / 1000;
const statuses = [...answers.values()].map((list) => list[0]);
const sorted = [...latencies].sort((a, b) => a - b);
const pick = (q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null);
const report = {
  jobs: total,
  answered: answers.size,
  missing: total - answers.size,
  answeredTwice: [...answers.values()].filter((list) => list.length > 1).length,
  done: statuses.filter((status) => status === 'DONE').length,
  failed: statuses.filter((status) => status === 'FAILED').length,
  geminiCalls: calls,
  workerRestarted: restarted,
  concurrency: config.concurrency,
  seconds: Math.round(elapsed * 10) / 10,
  perSecond: Math.round((answers.size / elapsed) * 10) / 10,
  latencyMs: { p50: pick(0.5), p95: pick(0.95), max: sorted.at(-1) ?? null },
  timedOut,
};

await broker.stop();
for (const queue of [queues.requests, `${queues.requests}.retry.1`, `${queues.requests}.retry.2`, `${queues.requests}.retry.3`, `${queues.requests}.dead`, queues.results, queues.openResults, queues.keyChecks])
  await channel.deleteQueue(queue).catch(() => {});
await connection.close();
mock.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.missing === 0 && !timedOut ? 0 : 1);
