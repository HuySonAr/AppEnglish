import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithRequestId } from '@appenglish/backend-common/observability';
import { ContentService } from '../src/content/content.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { listeningContentSchema } from '../src/listening/listening.schemas.js';
import { ContentEvents } from '../src/speech/content-events.js';
import { SpeechBroker } from '../src/speech/speech.broker.js';
import { createMemoryRepository, teacher, toeicTopicId } from './memory-repository.js';

test('a speech job and its request are stored together; the relay sends it once the broker is up (outbox)', async () => {
  const repository = createMemoryRepository();
  const content = new ContentService(repository, { async upload(input) { return { id: 's', kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: 1, url: `https://media.test/${input.fileName}`, storage: 'r2' }; }, async delete() {} });
  const sent = [];
  const broker = { ready: false, send: async (queue, message, options) => sent.push({ queue, message, options }) };
  const relay = new ContentEvents(repository.listening, broker);
  const service = new ListeningService(repository.listening, content, { broker, relay });
  const { exercise } = await service.createExercise(teacher, { topicId: toeicTopicId, title: 'Talk', level: 'B1', kind: 'part4' });
  const audioId = (await content.uploadMedia(teacher, { kind: 'audio', fileName: 't.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]), section: 'listening' })).media.id;
  await service.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: [] }));

  const { job } = await runWithRequestId('req-7', () => service.requestTranscribe(teacher, exercise.id));
  assert.equal(job.status, 'QUEUED');
  await relay.flush();
  assert.equal(sent.length, 0, 'nothing is sent while the broker is down, and the job is not lost');
  assert.equal(repository.tables.contentEvents[0].requestId, 'req-7');

  broker.ready = true;
  await relay.flush();
  await relay.flush();
  assert.equal(sent.length, 1);
  assert.deepEqual([sent[0].queue, sent[0].message.jobId, sent[0].message.requestId, sent[0].options.messageId], ['speech.autotime.requests', job.id, 'req-7', repository.tables.contentEvents[0].id]);
  assert.ok(repository.tables.contentEvents[0].publishedAt);

  assert.equal(await service.onAutoTimeResult({ jobId: job.id, status: 'RUNNING' }, { messageId: 'r1' }), 'applied');
  assert.equal(await service.onAutoTimeResult({ jobId: job.id, status: 'RUNNING' }, { messageId: 'r1' }), 'duplicate');
});

test('a speech answer that cannot be stored is retried, then goes to the dead queue', async () => {
  const broker = new SpeechBroker('amqp://unused');
  const channel = { acked: [], sent: [], ack(message) { this.acked.push(message.tag); }, sendToQueue(queue, content, options) { this.sent.push([queue, options.headers['x-attempt']]); } };
  broker.onResult = async (answer) => {
    if (answer.fail) throw new Error('database away');
    return answer.again ? 'duplicate' : 'applied';
  };
  const delivery = (tag, body, attempt = 0) => ({ tag, content: Buffer.from(JSON.stringify(body)), properties: { messageId: `m${tag}`, headers: attempt ? { 'x-attempt': attempt } : {} } });
  assert.equal(await broker.handleResult(channel, delivery(1, { jobId: 'j' })), 'applied');
  assert.equal(await broker.handleResult(channel, delivery(2, { jobId: 'j', again: true })), 'duplicate');
  assert.equal(await broker.handleResult(channel, delivery(3, { jobId: 'j', fail: true })), 'retry');
  assert.equal(await broker.handleResult(channel, delivery(4, { jobId: 'j', fail: true }, 3)), 'dead');
  assert.deepEqual(channel.acked, [1, 2, 3, 4]);
  assert.deepEqual(channel.sent, [['speech.autotime.results.retry.1', 1], ['speech.autotime.results.dead', 4]]);
});
