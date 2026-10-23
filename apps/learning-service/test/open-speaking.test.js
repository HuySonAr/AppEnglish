import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LearningEventType, LearningQueue } from '@appenglish/learning-contracts';
import { LearningEvents } from '../src/events/learning-events.js';
import { SpeakingService } from '../src/speaking/speaking.service.js';
import { createEventRepository, fakeTransport, student } from './helpers.js';
import { createSpeakingRepository } from './speaking-helpers.js';

const sealed = { v: 1, iv: 'aXY=', data: 'ZGF0YQ==', tag: 'dGFn' };

function harness({ withKey = true } = {}) {
  const at = new Date('2026-10-23T08:00:00Z');
  const eventRepository = createEventRepository();
  const events = new LearningEvents(eventRepository, { transport: fakeTransport(), now: () => at });
  const repository = createSpeakingRepository(eventRepository);
  const open = {
    id: randomUUID(),
    kind: 'open_speaking',
    versionId: randomUUID(),
    versionNumber: 3,
    content: {
      title: 'A trip',
      level: 'B1',
      topic: 'Travel',
      instructions: 'Talk about a place you like to visit.',
      imageMediaId: 'img',
      maxSeconds: 60,
      sampleAnswer: 'I love visiting Hoi An because of its old town.',
      keyPoints: ['the place', 'why'],
    },
    media: { img: { kind: 'image', url: 'https://media.test/beach.jpg' } },
  };
  const content = {
    async listPublishedPracticePrompts() {
      return { prompts: [{ id: open.id, kind: open.kind, title: 'A trip', level: 'B1', topic: 'Travel' }] };
    },
    async getPracticePaper(id) {
      return id === open.id ? { prompt: structuredClone(open) } : null;
    },
    async storeLearnerRecording(mimeType, data) {
      return { recording: { storage: 'r2', storageId: 'rec', url: 'https://media.test/rec.webm', mimeType, sizeBytes: data.byteLength } };
    },
  };
  const keys = { findKey: async (accountId) => (withKey && accountId === student.id ? { accountId, sealed, last4: 'abcd' } : null) };
  const service = new SpeakingService(repository, content, { now: () => at, events, keys });
  return { service, repository, eventRepository, open };
}

const recording = (durationSeconds = 20) => ({ mimeType: 'audio/webm', data: new Uint8Array(20), durationSeconds });
const heard = { transcript: 'I um like travel to Da Nang because the beach is beautiful', scores: { fluency: 8, pronunciation: 9 }, wordsPerMinute: 110, pauses: 1, fillers: 1, words: 11 };
const graded = {
  criteria: { task: 4, vocabulary: 3, grammar: 3, coherence: 4 },
  feedback: 'You named the place and gave a reason.',
  errors: [{ text: 'like travel', suggestion: 'like travelling', explanation: 'Use -ing after like.' }],
  rewrite: 'I like travelling to Da Nang.',
};

test('open prompts show the task and image, allow the prompt time, and hide the sample answer until submitted', async () => {
  const { service, open } = harness();
  assert.deepEqual((await service.listPrompts(student)).prompts.map((prompt) => prompt.kind), ['open_speaking']);
  const opened = await service.getPrompt(student, open.id);
  assert.deepEqual([opened.prompt.instructions, opened.prompt.imageUrl, opened.prompt.maxSeconds, opened.hasKey], [open.content.instructions, 'https://media.test/beach.jpg', 60, true]);
  assert.equal('sampleAnswer' in opened.prompt, false);
  await assert.rejects(() => service.submit(student, open.id, recording(62)), { code: 67 });
  const { submission } = await service.submit(student, open.id, recording(58));
  assert.equal(submission.stage, 'listening');
  assert.equal(submission.prompt.sampleAnswer, open.content.sampleAnswer);
});

test('with a key, the transcript goes to Gemini and the total mixes 60% Gemini with Fluency and Pronunciation', async () => {
  const { service, open, eventRepository } = harness();
  const { submission } = await service.submit(student, open.id, recording());
  const request = eventRepository.tables.events.find((event) => event.type === LearningEventType.SPEAKING_REQUESTED);
  assert.deepEqual([request.payload.kind, request.payload.text], ['open_speaking', '']);

  assert.equal(await service.applyGrading({ submissionId: submission.id, status: 'DONE', result: graded }), 'duplicate');
  assert.equal(await service.applyResult({ submissionId: submission.id, status: 'DONE', result: heard }), 'applied');
  assert.equal(await service.applyResult({ submissionId: submission.id, status: 'DONE', result: heard }), 'duplicate');
  const grading = (await service.getSubmission(student, submission.id)).submission;
  assert.deepEqual([grading.status, grading.stage, grading.result.transcript], ['SCORING', 'grading', heard.transcript]);
  const job = eventRepository.tables.events.find((event) => event.type === LearningEventType.SPEAKING_GRADING_REQUESTED);
  assert.equal(job.queue, LearningQueue.WRITING_REQUESTS);
  assert.deepEqual(job.payload.key, sealed);
  assert.equal(job.payload.answer, heard.transcript);
  assert.deepEqual([job.payload.prompt.maxSeconds, job.payload.prompt.keyPoints, job.payload.durationSeconds], [60, ['the place', 'why'], 20]);

  assert.equal(await service.applyGrading({ submissionId: submission.id, status: 'DONE', result: graded }), 'applied');
  assert.equal(await service.applyGrading({ submissionId: submission.id, status: 'DONE', result: graded }), 'duplicate');
  const done = (await service.getSubmission(student, submission.id)).submission;
  assert.equal(done.status, 'DONE');
  assert.deepEqual(done.result.scores, { fluency: 8, pronunciation: 9, task: 4, vocabulary: 3, grammar: 3, coherence: 4, total: 7.6 });
  assert.equal(done.total, 7.6);
  assert.equal(done.result.gemini.errors[0].suggestion, 'like travelling');
  assert.equal('stage' in done.result, false);
  const scored = eventRepository.tables.events.filter((event) => event.type === LearningEventType.SPEAKING_SCORED);
  assert.deepEqual(scored.map((event) => event.payload.total), [7.6]);
});

test('without a key the learner gets the transcript with Fluency and Pronunciation but no total', async () => {
  const { service, open, eventRepository } = harness({ withKey: false });
  const { submission } = await service.submit(student, open.id, recording());
  await service.applyResult({ submissionId: submission.id, status: 'DONE', result: heard });
  const done = (await service.getSubmission(student, submission.id)).submission;
  assert.deepEqual([done.status, done.total, done.result.scores, done.result.gemini], ['DONE', null, { fluency: 8, pronunciation: 9, total: null }, null]);
  assert.equal(eventRepository.tables.events.some((event) => event.type === LearningEventType.SPEAKING_GRADING_REQUESTED), false);
  assert.equal(eventRepository.tables.events.find((event) => event.type === LearningEventType.SPEAKING_SCORED).payload.total, null);
});

test('a Gemini failure keeps the transcript and the Whisper scores', async () => {
  const { service, open } = harness();
  const { submission } = await service.submit(student, open.id, recording());
  await service.applyResult({ submissionId: submission.id, status: 'DONE', result: heard });
  await service.applyGrading({ submissionId: submission.id, status: 'FAILED', error: 'Your Gemini key has used up its quota for now. Try again later.' });
  const failed = (await service.getSubmission(student, submission.id)).submission;
  assert.deepEqual([failed.status, failed.error, failed.result.transcript, failed.result.scores.total], ['FAILED', 'Your Gemini key has used up its quota for now. Try again later.', heard.transcript, null]);
  const second = (await service.submit(student, open.id, recording())).submission;
  await service.applyResult({ submissionId: second.id, status: 'DONE', result: { transcript: 'x' } });
  assert.equal((await service.getSubmission(student, second.id)).submission.error, 'The scoring result was not valid');
});
