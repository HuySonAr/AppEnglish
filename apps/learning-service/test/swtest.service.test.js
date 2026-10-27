import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SwTestService, speakingItems, writingItems } from '../src/swtest/swtest.service.js';
import { ReviewService } from '../src/review/review.service.js';
import { student } from './helpers.js';

function memoryAttempts() {
  const rows = [];
  const jobs = [];
  const events = [];
  let conversion = null;
  const copy = (row) => (row ? structuredClone(row) : null);
  return {
    rows,
    jobs,
    events,
    async findAttempt(id) {
      return copy(rows.find((row) => row.id === id));
    },
    async findJob(id) {
      return copy(jobs.find((row) => row.id === id));
    },
    async saveScoring(attempt, newJobs = [], newEvents = []) {
      jobs.push(...structuredClone(newJobs));
      events.push(...structuredClone(newEvents));
      return this.saveAttempt(attempt);
    },
    async findConversion() {
      return copy(conversion);
    },
    async saveConversion(row) {
      conversion = { id: 1, ...structuredClone(row) };
      return copy(conversion);
    },
    async listAttempts(accountId, testId) {
      return rows.filter((row) => row.accountId === accountId && (!testId || row.testId === testId)).map(copy);
    },
    async findOpen(accountId, testId, section) {
      return copy(rows.find((row) => row.accountId === accountId && row.testId === testId && row.section === section && row.status === 'IN_PROGRESS'));
    },
    async saveAttempt(attempt) {
      const stored = { id: attempt.id || randomUUID(), ...structuredClone(attempt) };
      const index = rows.findIndex((row) => row.id === stored.id);
      if (index >= 0) rows[index] = stored;
      else rows.push(stored);
      return copy(stored);
    },
    async deleteAttempt(id) {
      rows.splice(0, rows.length, ...rows.filter((row) => row.id !== id));
    },
    async listExpiredRecordings(before) {
      return rows.filter((row) => row.status === 'SUBMITTED' && !row.recordingDeletedAt && new Date(row.submittedAt) < before && Object.keys(row.recordings).length).map(copy);
    },
    async markRecordingsDeleted(id, at) {
      rows.find((row) => row.id === id).recordingDeletedAt = at;
    },
  };
}

const testId = randomUUID();
const asked = (text) => ({ text, audioMediaId: 'a' });
const content = {
  speaking: {
    readAloud: [{ text: 'One.' }, { text: 'Two.' }],
    pictures: [{ imageMediaId: 'i' }, { imageMediaId: 'i' }],
    respondQuestions: { context: 'Survey.', questions: [asked('Q5'), asked('Q6'), asked('Q7')] },
    respondInfo: { info: 'Schedule', questions: [asked('Q8'), asked('Q9'), asked('Q10')] },
    opinion: { text: 'Opinion?', audioMediaId: null },
  },
  writing: {
    pictureSentences: Array.from({ length: 5 }, () => ({ imageMediaId: 'i', keywords: ['a', 'b'] })),
    emails: [{ email: 'E1', instructions: 'Do it.' }, { email: 'E2', instructions: 'Do it.' }],
    essay: { question: 'Essay?' },
  },
};
const media = { a: { kind: 'audio', url: 'https://media.test/a.mp3' }, i: { kind: 'image', url: 'https://media.test/i.png' } };

function harness({ withKey = false } = {}) {
  const clock = { now: new Date('2026-10-27T08:00:00Z') };
  const repository = memoryAttempts();
  const deleted = [];
  const contentClient = {
    async listPublishedSwTests() {
      return { swTests: [{ id: testId, title: 'S&W 1' }] };
    },
    async getSwTestPaper(id) {
      return id === testId ? { swTest: { id, title: 'S&W 1' }, versionId: 'v1', versionNumber: 1, content: structuredClone(content), media } : null;
    },
    async storeLearnerRecording(mimeType, data) {
      return { recording: { storage: 'r2', storageId: `rec-${randomUUID()}`, url: 'https://media.test/rec.webm', mimeType, sizeBytes: data.byteLength } };
    },
    async deleteLearnerRecordings(recordings) {
      deleted.push(...recordings.map((item) => item.storageId));
      return { deleted: recordings.map((item) => item.storageId) };
    },
  };
  const keys = { findKey: async (accountId) => (withKey && accountId === student.id ? { accountId, sealed: { v: 1 }, model: null, thinkingLevel: null } : null) };
  const service = new SwTestService(repository, contentClient, { now: () => new Date(clock.now), keys });
  const advance = (minutes) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60000);
  };
  return { service, repository, deleted, advance };
}

const voice = (questionNumber, durationSeconds = 10) => ({ section: 'speaking', questionNumber, durationSeconds, mimeType: 'audio/webm', data: new Uint8Array(10) });

test('the papers follow the ETS order (D196)', () => {
  const speaking = speakingItems(content);
  assert.deepEqual(speaking.map((item) => item.task), ['read_aloud', 'read_aloud', 'describe_picture', 'describe_picture', 'respond_questions', 'respond_questions', 'respond_questions', 'respond_info', 'respond_info', 'respond_info', 'express_opinion']);
  assert.deepEqual(speaking.map((item) => item.number), Array.from({ length: 11 }, (_, index) => index + 1));
  assert.deepEqual(writingItems(content).map((item) => item.task), ['picture_sentence', 'picture_sentence', 'picture_sentence', 'picture_sentence', 'picture_sentence', 'respond_email', 'respond_email', 'opinion_essay']);
});

test('a Speaking attempt records questions in order, locks them and is saved unscored (D196)', async () => {
  const { service, repository, deleted } = harness();
  await assert.rejects(() => service.listTests({ id: randomUUID(), role: 'TEACHER' }), { code: 26 });
  const started = await service.start(student, testId, { section: 'speaking' });
  assert.deepEqual([started.items.length, started.items[4].audioUrl, started.lockedThrough], [11, 'https://media.test/a.mp3', 0]);
  await service.saveRecording(student, testId, voice(1, 40));
  await assert.rejects(() => service.saveRecording(student, testId, voice(1)), { code: 78 });
  await assert.rejects(() => service.saveRecording(student, testId, voice(5, 20)), (error) => error.code === 67 && error.data.reason === 'DURATION');
  await service.saveRecording(student, testId, voice(5, 14));
  await service.skipTo(student, testId, { section: 'speaking', questionNumber: 7 });
  await assert.rejects(() => service.saveRecording(student, testId, voice(6)), { code: 78 });
  const result = await service.submit(student, testId, { section: 'speaking' });
  assert.deepEqual([result.attempt.answered, result.attempt.scored, result.items[0].recordingUrl, result.items[1].recordingUrl], [2, false, 'https://media.test/rec.webm', null]);
  await assert.rejects(() => service.submit(student, testId, { section: 'speaking' }), { code: 77 });

  await service.start(student, testId, { section: 'speaking' });
  await service.saveRecording(student, testId, voice(1));
  await service.start(student, testId, { section: 'speaking' });
  assert.equal(deleted.length, 1);
  assert.equal(repository.rows.filter((row) => row.status === 'IN_PROGRESS').length, 1);
  const listed = (await service.listTests(student)).swTests[0];
  assert.deepEqual([listed.speaking.attempts.length, listed.speaking.inProgress, listed.writing.attempts.length], [1, true, 0]);
});

test('a Writing attempt locks a group once the learner moves on and closes itself when time runs out (D196)', async () => {
  const { service, advance } = harness();
  await service.start(student, testId, { section: 'writing' });
  await assert.rejects(() => service.saveAnswers(student, testId, { section: 'writing', answers: {}, lockThrough: 3 }), { code: 78 });
  await service.saveAnswers(student, testId, { section: 'writing', answers: { 1: 'A plane is at the airport, so people wait.' }, lockThrough: 5 });
  await service.saveAnswers(student, testId, { section: 'writing', answers: { 1: 'Changed.', 6: 'Dear committee,' } });
  advance(71);
  await assert.rejects(() => service.saveAnswers(student, testId, { section: 'writing', answers: {} }), { code: 77 });
  const result = await service.getResult(student, testId, { section: 'writing' });
  assert.deepEqual([result.items[0].answer, result.items[5].answer, result.attempt.answered], ['A plane is at the airport, so people wait.', 'Dear committee,', 2]);
});

test('Speaking test recordings go after the keeping period; the attempt stays', async () => {
  const { service, advance, deleted } = harness();
  await service.start(student, testId, { section: 'speaking' });
  await service.saveRecording(student, testId, voice(1));
  await service.submit(student, testId, { section: 'speaking' });
  advance(181 * 24 * 60);
  assert.equal(await service.purgeRecordings(), 1);
  assert.equal(deleted.length, 1);
  assert.equal((await service.getResult(student, testId, { section: 'speaking' })).items[0].recordingUrl, null);
});

test('a submitted Speaking part is scored item by item and converted to 0–200 (D198)', async () => {
  const { service, repository } = harness({ withKey: true });
  await service.start(student, testId, { section: 'speaking' });
  await service.saveRecording(student, testId, voice(1, 30));
  await service.saveRecording(student, testId, voice(11, 50));
  const submitted = await service.submit(student, testId, { section: 'speaking' });
  assert.equal(submitted.scoring.status, 'SCORING');
  const requests = repository.events.filter((event) => event.type === 'speaking.requested');
  assert.deepEqual(requests.map((event) => event.payload.kind), ['read_aloud', 'open_speaking']);
  assert.equal(requests[0].payload.text, 'One.');
  const [readJob, openJob] = requests.map((event) => event.payload.submissionId);
  assert.equal(await service.applyWhisper({ submissionId: randomUUID(), status: 'DONE', result: {} }), 'unknown');
  const read = { words: [], extra: [], scores: { accuracy: 9, completeness: 10, fluency: 6.5, total: 8 }, wordsPerMinute: 120, pauses: 1 };
  assert.equal(await service.applyWhisper({ submissionId: readJob, status: 'DONE', result: read }), 'applied');
  assert.equal(await service.applyWhisper({ submissionId: readJob, status: 'DONE', result: read }), 'duplicate');
  await service.applyWhisper({ submissionId: openJob, status: 'DONE', result: { transcript: 'I think a low salary is fine', scores: { fluency: 7, pronunciation: 8 }, wordsPerMinute: 100, pauses: 2, fillers: 0, words: 7 } });
  const grading = repository.events.find((event) => event.type === 'sw.grading.requested');
  assert.deepEqual([grading.payload.submissionId, grading.payload.task, grading.payload.maxScore, grading.payload.answer], [openJob, 'express_opinion', 5, 'I think a low salary is fine']);
  await service.applyGrading({ submissionId: openJob, status: 'DONE', result: { score: 4, feedback: 'Clear opinion.', model: 'gemini' } });
  const result = await service.getResult(student, testId, { section: 'speaking' });
  assert.equal(result.scoring.status, 'DONE');
  assert.deepEqual([result.items[0].ai.pronunciation, result.items[0].ai.intonation, result.items[0].ai.score, result.items[1].ai.score, result.items[10].ai.score], [3, 2, 2.5, 0, 4]);
  assert.deepEqual([result.scoring.final.raw, result.scoring.final.rawMax, result.scoring.final.scaled, result.scoring.final.pronunciationLevel], [6.5, 35, 40, 'Medium']);
  assert.equal(result.attempt.scaled, 40);
  assert.equal(repository.events.filter((event) => event.type === 'sw.scored').length, 1);
});

test('Writing is graded by Gemini; no key leaves it unscored; failures can be scored again (D198)', async () => {
  const noKey = harness();
  await noKey.service.start(student, testId, { section: 'writing' });
  await noKey.service.saveAnswers(student, testId, { section: 'writing', answers: { 8: 'An essay.' } });
  assert.equal((await noKey.service.submit(student, testId, { section: 'writing' })).scoring.status, 'NO_KEY');

  const { service, repository } = harness({ withKey: true });
  await service.start(student, testId, { section: 'writing' });
  await service.saveAnswers(student, testId, { section: 'writing', answers: { 1: 'People wait at the airport, so the plane is late.', 6: 'Dear committee, where is the library?' } });
  await service.submit(student, testId, { section: 'writing' });
  const jobs = repository.events.filter((event) => event.type === 'sw.grading.requested').map((event) => event.payload);
  assert.deepEqual(jobs.map((job) => [job.number, job.task, job.maxScore]), [[1, 'picture_sentence', 3], [6, 'respond_email', 4]]);
  assert.deepEqual(jobs[0].prompt.keywords, ['a', 'b']);
  await service.applyGrading({ submissionId: jobs[0].submissionId, status: 'DONE', result: { score: 9, feedback: 'Good.' } });
  await service.applyGrading({ submissionId: jobs[1].submissionId, status: 'FAILED', error: 'Your Gemini key has used up its quota for now. Try again later.' });
  const failed = await service.getResult(student, testId, { section: 'writing' });
  assert.deepEqual([failed.scoring.status, failed.scoring.error, failed.items[0].ai.score], ['FAILED', 'Your Gemini key has used up its quota for now. Try again later.', 3]);
  const retried = await service.retryScoring(student, testId, { section: 'writing' });
  assert.equal(retried.scoring.status, 'SCORING');
  const again = repository.events.filter((event) => event.type === 'sw.grading.requested').slice(-2).map((event) => event.payload.submissionId);
  for (const jobId of again) await service.applyGrading({ submissionId: jobId, status: 'DONE', result: { score: 3, feedback: 'OK.' } });
  const done = await service.getResult(student, testId, { section: 'writing' });
  assert.deepEqual([done.scoring.status, done.scoring.final.raw, done.scoring.final.scaled], ['DONE', 6, 40]);
});

test('an admin edits the Speaking and Writing conversion; the default is linear (D198)', async () => {
  const { service } = harness();
  const admin = { id: randomUUID(), role: 'ADMIN' };
  await assert.rejects(() => service.getConversion(student), { code: 26 });
  const first = await service.getConversion(admin);
  assert.deepEqual([first.isDefault, first.conversion.speaking.length, first.conversion.speaking.at(-1), first.conversion.writing.length], [true, 36, 200, 29]);
  const speaking = first.conversion.speaking.map((value, index) => (index === 35 ? 200 : Math.min(190, value)));
  const saved = await service.updateConversion(admin, { speaking, writing: first.conversion.writing });
  assert.deepEqual([saved.isDefault, saved.conversion.speaking[34]], [false, 190]);
});

function memoryReviews(attempts) {
  const reviews = [];
  const copy = (row) => (row ? structuredClone(row) : null);
  return {
    reviews,
    async findBySubmission(id) {
      return copy(reviews.find((row) => row.submissionId === id));
    },
    async findReview(id) {
      return copy(reviews.find((row) => row.id === id));
    },
    async countUsed(accountId, weekStart) {
      return reviews.filter((row) => row.accountId === accountId && row.weekStart === weekStart && row.status !== 'EXPIRED').length;
    },
    async reserve(row, limit) {
      if (reviews.filter((item) => item.accountId === row.accountId && item.weekStart === row.weekStart).length >= limit) return null;
      reviews.push({ id: randomUUID(), ...structuredClone(row) });
      return copy(reviews.at(-1));
    },
    async listWaiting(now) {
      return reviews.filter((row) => row.status === 'WAITING' && row.expiresAt > now).map(copy);
    },
    async countDoneSince() {
      return 0;
    },
    async claim(id, teacherId, now, until) {
      const row = reviews.find((item) => item.id === id);
      Object.assign(row, { teacherId, claimedAt: now, lockedUntil: until });
      return copy(row);
    },
    async completeSw(review, attemptId, teacherReview) {
      Object.assign(reviews.find((row) => row.id === review.id), structuredClone(review));
      Object.assign(attempts.rows.find((row) => row.id === attemptId), { teacherReview: structuredClone(teacherReview) });
      return review;
    },
  };
}

test('a learner sends a whole test part to a teacher, who grades each question; the teacher score wins (D198)', async () => {
  const { service, repository } = harness();
  const reviews = new ReviewService(memoryReviews(repository), { now: () => new Date('2026-10-27T09:00:00Z'), swTests: service });
  service.useReviews(reviews);
  await service.start(student, testId, { section: 'writing' });
  await service.saveAnswers(student, testId, { section: 'writing', answers: { 1: 'At the airport, so.', 8: 'My essay.' } });
  const submitted = await service.submit(student, testId, { section: 'writing' });
  assert.deepEqual([submitted.scoring.status, submitted.review, submitted.reviewQuota.left], ['NO_KEY', null, 3]);
  const sent = await reviews.requestSw(student, { swTestId: testId, section: 'writing' });
  assert.deepEqual([sent.review.status, sent.quota.left], ['WAITING', 2]);
  await assert.rejects(() => reviews.requestSw(student, { swTestId: testId, section: 'writing' }), (error) => error.data.reason === 'ALREADY_SENT');
  const teacher = { id: randomUUID(), role: 'TEACHER' };
  const queue = await reviews.listQueue(teacher);
  assert.deepEqual([queue.reviews[0].kind, queue.reviews[0].title, queue.reviews[0].hasAi], ['sw_writing', 'S&W 1 · Writing', false]);
  const claimed = await reviews.claim(teacher, queue.reviews[0].id);
  assert.deepEqual([claimed.sw.items.length, claimed.sw.items[7].answer, claimed.sw.items[5].maxScore], [8, 'My essay.', 4]);
  await assert.rejects(() => reviews.complete(teacher, queue.reviews[0].id, { action: 'FROM_SCRATCH', items: { 1: 2 }, note: 'Good start.' }), { code: 30 });
  const items = { 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 3 };
  const done = await reviews.complete(teacher, queue.reviews[0].id, { action: 'FROM_SCRATCH', items, note: 'Write more in the emails.' });
  assert.deepEqual([done.review.final.raw, done.review.final.scaled], [5, 40]);
  const result = await service.getResult(student, testId, { section: 'writing' });
  assert.deepEqual([result.attempt.scaled, result.attempt.reviewed, result.teacherReview.note, result.items[7].teacher.score, result.review.status], [40, true, 'Write more in the emails.', 3, 'DONE']);
});

