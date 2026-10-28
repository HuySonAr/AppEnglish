import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LearningEventType, LearningQueue, StudyActivity } from '@appenglish/learning-contracts';
import { student } from './helpers.js';
import { other, scored, speakingHarness as harness } from './speaking-helpers.js';

const audio = (bytes = 10) => ({ mimeType: 'audio/webm;codecs=opus', data: new Uint8Array(bytes), durationSeconds: 4.26 });

test('learners see published read-aloud prompts without the open kinds, with their own best score', async () => {
  const { service, readAloud } = harness();
  await assert.rejects(() => service.listPrompts({ id: randomUUID(), role: 'TEACHER' }), { code: 26 });
  const listed = await service.listPrompts(student);
  assert.deepEqual(listed.prompts.map((item) => [item.id, item.attempts, item.bestTotal]), [[readAloud.id, 0, null]]);
  const opened = await service.getPrompt(student, readAloud.id);
  assert.equal(opened.prompt.audioUrl, 'https://media.test/model.mp3');
  assert.equal(opened.prompt.maxSeconds, 45);
  assert.equal('sampleAnswer' in opened.prompt, false);
  assert.deepEqual(opened.submissions, []);
});

test('a submission stores the recording, queues scoring through the outbox and counts as a study day', async () => {
  const { service, readAloud, writing, stored, eventRepository, transport, events } = harness();
  await assert.rejects(() => service.submit(student, writing.id, audio()), { code: 65 });
  await assert.rejects(() => service.submit(student, readAloud.id, { ...audio(), mimeType: 'text/plain' }), { code: 67 });
  await assert.rejects(() => service.submit(student, readAloud.id, audio(0)), { code: 67 });
  await assert.rejects(() => service.submit(student, readAloud.id, { ...audio(), durationSeconds: 60 }), { code: 67 });
  await assert.rejects(() => service.submit(student, readAloud.id, audio(6 * 1024 * 1024)), { code: 67 });

  const { submission } = await service.submit(student, readAloud.id, audio());
  assert.deepEqual(stored, [['audio/webm', 10]]);
  assert.equal(submission.status, 'SCORING');
  assert.equal(submission.durationSeconds, 4.3);
  assert.equal(submission.recordingUrl, 'https://media.test/rec-1.webm');
  assert.equal(submission.versionNumber, 2);

  const [request, activity] = eventRepository.tables.events;
  assert.equal(request.type, LearningEventType.SPEAKING_REQUESTED);
  assert.equal(request.queue, LearningQueue.SPEAKING_REQUESTS);
  assert.deepEqual(request.payload, { submissionId: submission.id, kind: 'read_aloud', audioUrl: 'https://media.test/rec-1.webm', text: 'The train leaves at nine.' });
  assert.equal(activity.type, LearningEventType.ACTIVITY_RECORDED);
  assert.equal(activity.payload.activity, StudyActivity.SPEAKING);

  await new Promise((resolve) => setImmediate(resolve));
  await events.flush();
  const routed = transport.sent.map((message, index) => [message.type, transport.queues[index]]);
  assert.deepEqual(routed, [
    [LearningEventType.SPEAKING_REQUESTED, LearningQueue.SPEAKING_REQUESTS],
    [LearningEventType.ACTIVITY_RECORDED, LearningQueue.RESULTS],
  ]);

  await assert.rejects(() => service.getSubmission(other, submission.id), { code: 66 });
  assert.equal((await service.getSubmission(student, submission.id)).submission.status, 'SCORING');
});

test('a scoring answer is applied once, then the learner sees the words and scores', async () => {
  const { service, readAloud, eventRepository } = harness();
  const { submission } = await service.submit(student, readAloud.id, audio());
  assert.equal(await service.applyResult({ submissionId: randomUUID(), status: 'DONE', result: scored }), 'unknown');
  assert.equal(await service.applyResult({ submissionId: submission.id, status: 'RUNNING' }), 'ignored');
  assert.equal(await service.applyResult({ submissionId: submission.id, status: 'DONE', result: scored }), 'applied');
  assert.equal(await service.applyResult({ submissionId: submission.id, status: 'DONE', result: scored }), 'duplicate');
  const view = (await service.getSubmission(student, submission.id)).submission;
  assert.equal(view.status, 'DONE');
  assert.equal(view.total, 8.1);
  assert.equal(view.result.words[1].status, 'mispronounced');
  assert.deepEqual(view.result.ets, { task: 'read_aloud', pronunciation: 2, intonation: 3, score: 2.5, max: 3 });
  const scoredEvents = eventRepository.tables.events.filter((event) => event.type === LearningEventType.SPEAKING_SCORED);
  assert.equal(scoredEvents.length, 1);
  assert.equal(scoredEvents[0].queue, null);
  assert.deepEqual({ ...scoredEvents[0].payload, scoredAt: undefined }, { accountId: student.id, submissionId: submission.id, promptId: readAloud.id, kind: 'read_aloud', title: 'Train times', status: 'DONE', total: 8.1, scoredAt: undefined });

  const listed = await service.listPrompts(student);
  assert.deepEqual([listed.prompts[0].attempts, listed.prompts[0].bestTotal], [1, 8.1]);
  const history = (await service.getPrompt(student, readAloud.id)).submissions;
  assert.deepEqual(history.map((item) => [item.status, item.total]), [['DONE', 8.1]]);
});

test('failures and invalid answers end as FAILED with a reason', async () => {
  const { service, readAloud } = harness();
  const first = (await service.submit(student, readAloud.id, audio())).submission;
  await service.applyResult({ submissionId: first.id, status: 'FAILED', error: 'No speech was heard in the recording.' });
  const failed = (await service.getSubmission(student, first.id)).submission;
  assert.deepEqual([failed.status, failed.error, failed.total], ['FAILED', 'No speech was heard in the recording.', null]);
  const second = (await service.submit(student, readAloud.id, audio())).submission;
  await service.applyResult({ submissionId: second.id, status: 'DONE', result: { words: 'nope' } });
  const broken = (await service.getSubmission(student, second.id)).submission;
  assert.deepEqual([broken.status, broken.error], ['FAILED', 'The scoring result was not valid']);
});

test('recordings older than 180 days are deleted; scores stay', async () => {
  const { service, readAloud, removed, setClock, repository } = harness();
  setClock(new Date('2026-01-01T08:00:00Z'));
  const old = (await service.submit(student, readAloud.id, audio())).submission;
  const failing = (await service.submit(student, readAloud.id, audio())).submission;
  await service.applyResult({ submissionId: old.id, status: 'DONE', result: scored });
  setClock(new Date('2026-06-29T08:00:00Z'));
  const recent = (await service.submit(student, readAloud.id, audio())).submission;
  setClock(new Date('2026-07-01T08:00:00Z'));
  assert.equal(await service.purgeRecordings(), 1);
  assert.deepEqual(removed, ['rec-1', 'rec-2']);
  const gone = (await service.getSubmission(student, old.id)).submission;
  assert.equal(gone.recordingUrl, null);
  assert.equal(gone.total, 8.1);
  assert.notEqual((await service.getSubmission(student, failing.id)).submission.recordingUrl, null);
  assert.notEqual((await service.getSubmission(student, recent.id)).submission.recordingUrl, null);
  assert.equal(repository.tables.submissions.filter((row) => row.recordingDeletedAt).length, 1);
});

test('with a Gemini key a read-aloud score waits for feedback, which never changes the score', async () => {
  const sealed = { v: 1, iv: 'aXY=', data: 'ZGF0YQ==', tag: 'dGFn' };
  const { service, readAloud, eventRepository } = harness({ key: { sealed, model: 'gemini-3.8-flash', thinkingLevel: null } });
  const { submission } = await service.submit(student, readAloud.id, audio());
  assert.equal(await service.applyResult({ submissionId: submission.id, status: 'DONE', result: scored }), 'applied');
  const waiting = (await service.getSubmission(student, submission.id)).submission;
  assert.deepEqual([waiting.status, waiting.stage, waiting.result.scores.total], ['SCORING', 'grading', 8.1]);
  const job = eventRepository.tables.events.find((event) => event.type === LearningEventType.SPEAKING_GRADING_REQUESTED);
  assert.equal(job.queue, LearningQueue.WRITING_REQUESTS);
  assert.equal(job.payload.answer, 'The train');
  assert.equal(job.payload.readAloud.text, 'The train leaves at nine.');
  assert.deepEqual(job.payload.readAloud.ets, { task: 'read_aloud', pronunciation: 2, intonation: 3, score: 2.5, max: 3 });
  assert.equal('etsTask' in job.payload, false);
  const feedback = { feedback: 'Clear start.', strengths: ['Steady pace'], improvements: ['Say "train" slowly.'], practiceWords: ['train'], vi: { feedback: 'Mở đầu rõ.', strengths: [], improvements: [] }, model: 'gemini-3.8-flash' };
  assert.equal(await service.applyGrading({ submissionId: submission.id, status: 'DONE', result: feedback }), 'applied');
  assert.equal(await service.applyGrading({ submissionId: submission.id, status: 'DONE', result: feedback }), 'duplicate');
  const done = (await service.getSubmission(student, submission.id)).submission;
  assert.deepEqual([done.status, done.stage, done.total, done.result.gemini.feedback, done.result.gemini.vi.feedback, done.result.stage], ['DONE', null, 8.1, 'Clear start.', 'Mở đầu rõ.', undefined]);

  const second = (await service.submit(student, readAloud.id, audio())).submission;
  await service.applyResult({ submissionId: second.id, status: 'DONE', result: scored });
  await service.applyGrading({ submissionId: second.id, status: 'FAILED', error: 'Your Gemini key has used up its quota for now. Try again later.' });
  const kept = (await service.getSubmission(student, second.id)).submission;
  assert.deepEqual([kept.status, kept.total, kept.result.gemini, kept.result.geminiError], ['DONE', 8.1, null, 'Your Gemini key has used up its quota for now. Try again later.']);

  const silent = (await service.submit(student, readAloud.id, audio())).submission;
  await service.applyResult({ submissionId: silent.id, status: 'DONE', result: { ...scored, heard: ' ' } });
  assert.equal((await service.getSubmission(student, silent.id)).submission.status, 'DONE');
});

test('a learner deletes an attempt or every attempt of a prompt, but not one being scored or sent to a teacher', async () => {
  const { service, readAloud, repository } = harness();
  const removed = [];
  service.contentClient.deleteLearnerRecordings = async (recordings) => {
    removed.push(...recordings.map((item) => item.storageId));
    return { deleted: recordings.map((item) => item.storageId), failed: [] };
  };
  const sent = new Set();
  service.reviews = { reviewFor: async (id) => (sent.has(id) ? { status: 'WAITING' } : null), quotaOf: async () => null };
  const first = (await service.submit(student, readAloud.id, audio())).submission;
  await assert.rejects(() => service.deleteSubmission(student, first.id), { code: 79, data: { reason: 'SCORING' } });
  await service.applyResult({ submissionId: first.id, status: 'DONE', result: scored });
  await assert.rejects(() => service.deleteSubmission(other, first.id), { code: 66 });
  assert.deepEqual(await service.deleteSubmission(student, first.id), { deleted: [first.id] });
  assert.deepEqual(removed, ['rec-1']);
  assert.equal(repository.tables.submissions.length, 0);

  const kept = (await service.submit(student, readAloud.id, audio())).submission;
  const gone = (await service.submit(student, readAloud.id, audio())).submission;
  for (const item of [kept, gone]) await service.applyResult({ submissionId: item.id, status: 'DONE', result: scored });
  sent.add(kept.id);
  await assert.rejects(() => service.deleteSubmission(student, kept.id), { data: { reason: 'SENT' } });
  assert.deepEqual(await service.clearPrompt(student, readAloud.id), { deleted: [gone.id], kept: 1 });
  assert.deepEqual(repository.tables.submissions.map((row) => row.id), [kept.id]);

  service.contentClient.deleteLearnerRecordings = async (recordings) => ({ deleted: [], failed: recordings.map((item) => item.storageId) });
  sent.clear();
  await assert.rejects(() => service.deleteSubmission(student, kept.id), { status: 503 });
  assert.equal(repository.tables.submissions.length, 1);
});
