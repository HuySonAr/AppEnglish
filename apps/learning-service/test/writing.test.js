import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { open } from '@appenglish/backend-common/secret-box';
import { LearningEventType, LearningQueue, StudyActivity } from '@appenglish/learning-contracts';
import { LearningEvents } from '../src/events/learning-events.js';
import { WritingService } from '../src/writing/writing.service.js';
import { aiSettingsSchema, saveAiKeySchema } from '../src/writing/writing.schemas.js';
import { createEventRepository, fakeTransport, student } from './helpers.js';
import { createSpeakingRepository, other } from './speaking-helpers.js';

const secret = 'k'.repeat(40);
const goodKey = 'AIzaSyGoodKey_1234567890abcd';

function harness({ check = async () => ({ status: 'VALID' }), models = async () => ({ status: 'UNAVAILABLE' }) } = {}) {
  const at = new Date('2026-10-23T08:00:00Z');
  const eventRepository = createEventRepository();
  const events = new LearningEvents(eventRepository, { transport: fakeTransport(), now: () => at });
  const repository = createSpeakingRepository(eventRepository);
  const keys = new Map();
  const keyRepository = {
    async findKey(accountId) {
      return keys.has(accountId) ? structuredClone(keys.get(accountId)) : null;
    },
    async saveKey(row) {
      keys.set(row.accountId, structuredClone(row));
      return row;
    },
    async deleteKey(accountId) {
      keys.delete(accountId);
      for (const event of eventRepository.tables.events) if (event.type === 'writing.requested' && event.payload.accountId === accountId) delete event.payload.key;
    },
  };
  const writing = {
    id: randomUUID(),
    kind: 'writing',
    versionId: randomUUID(),
    versionNumber: 1,
    content: {
      title: 'Ask for a day off',
      level: 'A2',
      topic: 'Work',
      taskType: 'email',
      instructions: 'Write an email to your manager.',
      imageMediaId: null,
      minWords: 5,
      maxWords: 20,
      sampleAnswer: 'Dear Ms Lee, could I take Friday off? Thank you.',
      keyPoints: ['the day', 'thanks'],
    },
    media: {},
  };
  const reading = { ...writing, id: randomUUID(), kind: 'read_aloud', content: { title: 'Read', level: 'A2', topic: 'x', text: 'Hi.' } };
  const content = {
    async listPublishedPracticePrompts() {
      return { prompts: [writing, reading].map((item) => ({ id: item.id, kind: item.kind, title: item.content.title, level: 'A2', topic: item.content.topic })) };
    },
    async getPracticePaper(id) {
      const found = [writing, reading].find((item) => item.id === id);
      return found ? { prompt: structuredClone(found) } : null;
    },
  };
  const checks = [];
  const listed = [];
  const checker = {
    async check(sealed) {
      checks.push(sealed);
      return check(sealed);
    },
    async listModels(sealed) {
      listed.push(sealed);
      return models(sealed);
    },
  };
  const service = new WritingService(repository, keyRepository, content, { checker, secret, now: () => at, events });
  return { service, repository, eventRepository, keys, checks, listed, writing, reading };
}

const result = {
  criteria: { cohesion: 3.5, syntax: 3, vocabulary: 3.5, phraseology: 3, grammar: 2.5, conventions: 2.5, task: 5 },
  scores: { vocabulary: 1, grammar: 1, coherence: 1, task: 1, total: 1 },
  feedback: 'Good.',
  errors: [{ text: 'want take', suggestion: 'want to take', explanation: 'Use to.' }],
  rewrite: 'Better.',
};

test('a learner saves a Gemini key only after writing-service accepts it; only the last four characters come back', async () => {
  const { service, keys, checks } = harness();
  await assert.rejects(() => service.getKey({ id: randomUUID(), role: 'TEACHER' }), { code: 26 });
  assert.deepEqual(await service.getKey(student), { key: null });
  const saved = await service.saveKey(student, { key: goodKey });
  assert.deepEqual(saved, { key: { last4: 'abcd', verifiedAt: '2026-10-23T08:00:00.000Z', model: 'gemini-3.8-flash', thinkingLevel: null } });
  assert.equal(JSON.stringify(keys.get(student.id)).includes(goodKey), false);
  assert.equal(open(keys.get(student.id).sealed, secret), goodKey);
  assert.equal(open(checks[0], secret), goodKey);
  assert.deepEqual(await service.deleteKey(student), { key: null });
  assert.equal(keys.size, 0);
  assert.throws(() => saveAiKeySchema.parse({ key: 'short' }));
  assert.throws(() => saveAiKeySchema.parse({ key: 'has spaces in it and is long enough' }));
  assert.equal(saveAiKeySchema.parse({ key: 'AQ.Ab8RN6IexampleAuthKey_with-dots.and-dashes' }).key, 'AQ.Ab8RN6IexampleAuthKey_with-dots.and-dashes');
  assert.equal(saveAiKeySchema.parse({ key: '  AIzaSyOldStandardKey1234567890  ' }).key, 'AIzaSyOldStandardKey1234567890');
});

test('a rejected or unchecked key is not saved', async () => {
  const rejected = harness({ check: async () => ({ status: 'INVALID', reason: 'Your Gemini key was rejected. Check it in your profile.' }) });
  await assert.rejects(() => rejected.service.saveKey(student, { key: goodKey }), { code: 69, message: 'Your Gemini key was rejected. Check it in your profile.' });
  const down = harness({ check: async () => { throw new Error('timeout'); } });
  await assert.rejects(() => down.service.saveKey(student, { key: goodKey }), { code: 70, status: 503 });
  const busy = harness({ check: async () => ({ status: 'UNAVAILABLE' }) });
  await assert.rejects(() => busy.service.saveKey(student, { key: goodKey }), { code: 70 });
  assert.equal(rejected.keys.size + down.keys.size + busy.keys.size, 0);
});

test('without a key a text is saved; with a key it is queued for Gemini with the sealed key; word limits are checked', async () => {
  const { service, writing, reading, eventRepository } = harness();
  const listed = await service.listPrompts(student);
  assert.deepEqual([listed.prompts.map((item) => item.id), listed.hasKey], [[writing.id], false]);
  const opened = await service.getPrompt(student, writing.id);
  assert.equal('sampleAnswer' in opened.prompt, false);
  assert.equal('keyPoints' in opened.prompt, false);
  assert.deepEqual([opened.prompt.minWords, opened.prompt.maxWords], [5, 20]);
  await assert.rejects(() => service.getPrompt(student, reading.id), { code: 65 });
  await assert.rejects(() => service.submit(student, writing.id, { text: 'Too short.' }), { code: 71 });
  await assert.rejects(() => service.submit(student, writing.id, { text: 'word '.repeat(21) }), { code: 71 });

  const saved = (await service.submit(student, writing.id, { text: '  Dear Ms Lee,\r\nI want take Friday off. Thanks.  ' })).submission;
  assert.equal(saved.status, 'SAVED');
  assert.equal(saved.answer, 'Dear Ms Lee,\nI want take Friday off. Thanks.');
  assert.equal(saved.words, 9);
  assert.equal('sampleAnswer' in saved.prompt, false);
  assert.equal('keyPoints' in saved.prompt, false);
  assert.deepEqual(eventRepository.tables.events.map((event) => [event.type, event.payload.activity]), [[LearningEventType.ACTIVITY_RECORDED, StudyActivity.WRITING]]);

  await service.saveKey(student, { key: goodKey });
  const queued = (await service.submit(student, writing.id, { text: 'Dear Ms Lee, I want take Friday off. Thanks.' })).submission;
  assert.equal(queued.status, 'SCORING');
  const request = eventRepository.tables.events.find((event) => event.type === LearningEventType.WRITING_REQUESTED);
  assert.equal(request.queue, LearningQueue.WRITING_REQUESTS);
  assert.equal(request.payload.submissionId, queued.id);
  assert.equal(request.payload.prompt.sampleAnswer, writing.content.sampleAnswer);
  assert.deepEqual(request.payload.prompt.keyPoints, ['the day', 'thanks']);
  assert.equal(open(request.payload.key, secret), goodKey);
  assert.equal(JSON.stringify(request).includes(goodKey), false);

  await service.deleteKey(student);
  assert.equal('key' in request.payload, false);
});

test('Gemini results are applied once, with the total recomputed from the seven criteria', async () => {
  const { service, writing, eventRepository } = harness();
  await service.saveKey(student, { key: goodKey });
  const { submission } = await service.submit(student, writing.id, { text: 'Dear Ms Lee, I want take Friday off. Thanks.' });
  assert.equal(await service.applyResult({ submissionId: submission.id, status: 'DONE', result }), 'applied');
  assert.equal(await service.applyResult({ submissionId: submission.id, status: 'DONE', result }), 'duplicate');
  const view = (await service.getSubmission(student, submission.id)).submission;
  assert.deepEqual(view.result.scores, { vocabulary: 3.3, grammar: 2.7, coherence: 3.5, task: 5, total: 3.6 });
  assert.equal(view.total, 3.6);
  const scored = eventRepository.tables.events.find((event) => event.type === LearningEventType.WRITING_SCORED);
  assert.deepEqual([scored.payload.status, scored.payload.total, scored.queue], ['DONE', 3.6, null]);
  await assert.rejects(() => service.getSubmission(other, submission.id), { code: 66 });

  const second = (await service.submit(student, writing.id, { text: 'Dear Ms Lee, I want take Friday off. Thanks.' })).submission;
  await service.applyResult({ submissionId: second.id, status: 'FAILED', error: 'Your Gemini key has used up its quota for now. Try again later.' });
  const failed = (await service.getSubmission(student, second.id)).submission;
  assert.deepEqual([failed.status, failed.error], ['FAILED', 'Your Gemini key has used up its quota for now. Try again later.']);
  const third = (await service.submit(student, writing.id, { text: 'Dear Ms Lee, I want take Friday off. Thanks.' })).submission;
  await service.applyResult({ submissionId: third.id, status: 'DONE', result: { ...result, criteria: { ...result.criteria, task: 9 } } });
  assert.equal((await service.getSubmission(student, third.id)).submission.error, 'The scoring result was not valid');
  const history = (await service.getPrompt(student, writing.id)).submissions;
  assert.equal(history.length, 3);
});

test('a learner picks the Gemini model and thinking level used for their own key', async () => {
  const { service, writing, eventRepository } = harness();
  await assert.rejects(() => service.saveSettings(student, { model: 'gemini-3.5-flash-lite', thinkingLevel: null }), { code: 69 });
  await service.saveKey(student, { key: goodKey });
  const { key } = await service.saveSettings(student, { model: 'gemini-3.5-flash-lite', thinkingLevel: 'low' });
  assert.deepEqual([key.model, key.thinkingLevel, key.last4], ['gemini-3.5-flash-lite', 'low', 'abcd']);
  await service.submit(student, writing.id, { text: 'Dear Ms Lee, I want take Friday off. Thanks.' });
  const job = eventRepository.tables.events.find((event) => event.type === 'writing.requested');
  assert.deepEqual([job.payload.model, job.payload.thinkingLevel], ['gemini-3.5-flash-lite', 'low']);
  assert.throws(() => aiSettingsSchema.parse({ model: 'gemini-3.8-flash', thinkingLevel: 'minimal' }));
  assert.throws(() => aiSettingsSchema.parse({ model: 'gpt-4', thinkingLevel: null }));
  assert.deepEqual(aiSettingsSchema.parse({ model: 'gemini-3.6-flash' }), { model: 'gemini-3.6-flash', thinkingLevel: null });
});

test('the model list comes from the learner key: known models first with thinking levels, others by name; choices are checked against it', async () => {
  const available = [
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', thinking: true },
    { id: 'gemini-4-argon', label: 'Gemini 4 Argon', thinking: true },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', thinking: true },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', thinking: true },
  ];
  const { service, listed } = harness({ models: async () => ({ status: 'VALID', models: available }) });
  await assert.rejects(() => service.listModels(student), { code: 69 });
  await service.saveKey(student, { key: goodKey });
  const { models } = await service.listModels(student);
  assert.deepEqual(models.map((item) => [item.id, item.recommended, item.levels.length]), [
    ['gemini-3.8-flash', true, 3],
    ['gemini-3.5-flash-lite', true, 4],
    ['gemini-4-argon', false, 0],
    ['gemini-3.1-pro-preview', false, 0],
  ]);
  await service.listModels(student);
  assert.equal(listed.length, 1);
  await service.listModels(student, { fresh: true });
  assert.equal(listed.length, 2);

  const { key } = await service.saveSettings(student, { model: 'gemini-4-argon', thinkingLevel: null });
  assert.equal(key.model, 'gemini-4-argon');
  await assert.rejects(() => service.saveSettings(student, { model: 'gemini-3.6-flash', thinkingLevel: null }), { code: 69, message: 'This model is not available for your key' });
  assert.throws(() => aiSettingsSchema.parse({ model: 'gemini-4-argon', thinkingLevel: 'low' }));
  assert.throws(() => aiSettingsSchema.parse({ model: 'gemini-3.5-transcribe', thinkingLevel: null }));
  assert.deepEqual(aiSettingsSchema.parse({ model: 'gemini-4-argon' }), { model: 'gemini-4-argon', thinkingLevel: null });
});

test('when the list cannot be fetched, only known models can be chosen', async () => {
  const { service } = harness({ models: async () => ({ status: 'UNAVAILABLE' }) });
  await service.saveKey(student, { key: goodKey });
  await assert.rejects(() => service.listModels(student), { code: 70 });
  assert.equal((await service.saveSettings(student, { model: 'gemini-3.6-flash', thinkingLevel: 'low' })).key.model, 'gemini-3.6-flash');
  await assert.rejects(() => service.saveSettings(student, { model: 'gemini-4-argon', thinkingLevel: null }), { code: 70 });
});

test('a practice text of an ETS task also keeps the TOEIC score from the same Gemini call (D199)', async () => {
  const { service, writing, eventRepository } = harness();
  writing.content.etsTask = 'respond_email';
  writing.content.email = 'Can you join the meeting on Friday?';
  await service.saveKey(student, { key: goodKey });
  const { submission } = await service.submit(student, writing.id, { text: 'Dear Ms Lee, I want take Friday off. Thanks.' });
  const job = eventRepository.tables.events.find((event) => event.type === 'writing.requested');
  assert.equal(job.payload.etsTask, 'respond_email');
  await service.applyResult({ submissionId: submission.id, status: 'DONE', result: { ...result, etsScore: 3 } });
  const view = (await service.getSubmission(student, submission.id)).submission;
  assert.deepEqual(view.result.ets, { task: 'respond_email', score: 3, max: 4 });
  assert.equal('etsScore' in view.result, false);
  assert.equal(view.total, 3.6);

  writing.content.etsTask = null;
  const plain = (await service.submit(student, writing.id, { text: 'Dear Ms Lee, I want take Friday off. Thanks.' })).submission;
  await service.applyResult({ submissionId: plain.id, status: 'DONE', result });
  assert.equal((await service.getSubmission(student, plain.id)).submission.result.ets, null);
});
