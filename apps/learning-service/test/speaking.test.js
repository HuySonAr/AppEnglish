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
  assert.equal(opened.prompt.maxSeconds, 30);
  assert.equal('sampleAnswer' in opened.prompt, false);
  assert.deepEqual(opened.submissions, []);
});

test('a submission stores the recording, queues scoring through the outbox and counts as a study day', async () => {
  const { service, readAloud, writing, stored, eventRepository, transport, events } = harness();
  await assert.rejects(() => service.submit(student, writing.id, audio()), { code: 65 });
  await assert.rejects(() => service.submit(student, readAloud.id, { ...audio(), mimeType: 'text/plain' }), { code: 67 });
  await assert.rejects(() => service.submit(student, readAloud.id, audio(0)), { code: 67 });
  await assert.rejects(() => service.submit(student, readAloud.id, { ...audio(), durationSeconds: 45 }), { code: 67 });
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
