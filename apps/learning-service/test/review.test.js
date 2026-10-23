import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LearningEventType, vietnamWeekStart } from '@appenglish/learning-contracts';
import { LearningEvents } from '../src/events/learning-events.js';
import { ReviewService } from '../src/review/review.service.js';
import { createEventRepository, fakeTransport, student } from './helpers.js';

const teacher = { id: randomUUID(), role: 'TEACHER' };
const otherTeacher = { id: randomUUID(), role: 'TEACHER' };
const HOUR = 60 * 60 * 1000;

function createReviewRepository(submissions, events) {
  const reviews = [];
  const copy = (row) => (row ? structuredClone(row) : null);
  const active = (row) => row.status === 'WAITING' || row.status === 'DONE';
  return {
    reviews,
    async findBySubmission(id) {
      return copy(reviews.find((row) => row.submissionId === id));
    },
    async findBySubmissions(ids) {
      return reviews.filter((row) => ids.includes(row.submissionId)).map(copy);
    },
    async findReview(id) {
      return copy(reviews.find((row) => row.id === id));
    },
    async countUsed(accountId, weekStart) {
      return reviews.filter((row) => row.accountId === accountId && row.weekStart === weekStart && active(row)).length;
    },
    async reserve(row, limit) {
      if (reviews.filter((item) => item.accountId === row.accountId && item.weekStart === row.weekStart && active(item)).length >= limit) return null;
      const existing = reviews.find((item) => item.submissionId === row.submissionId);
      if (existing) Object.assign(existing, structuredClone(row));
      else reviews.push({ id: randomUUID(), ...structuredClone(row) });
      return copy(reviews.find((item) => item.submissionId === row.submissionId));
    },
    async withdraw(submissionId, accountId, now) {
      const index = reviews.findIndex((row) => row.submissionId === submissionId && row.accountId === accountId && row.status === 'WAITING' && (!row.lockedUntil || row.lockedUntil <= now));
      if (index < 0) return false;
      reviews.splice(index, 1);
      return true;
    },
    async listWaiting(now) {
      return reviews.filter((row) => row.status === 'WAITING' && row.expiresAt > now).sort((a, b) => a.requestedAt - b.requestedAt).map(copy);
    },
    async countDoneSince(teacherId, since) {
      return reviews.filter((row) => row.teacherId === teacherId && row.status === 'DONE' && row.completedAt >= since).length;
    },
    async claim(id, teacherId, now, until) {
      const row = reviews.find((item) => item.id === id);
      if (!row || row.status !== 'WAITING' || row.expiresAt <= now || (row.lockedUntil && row.lockedUntil > now && row.teacherId !== teacherId)) return null;
      Object.assign(row, { teacherId, claimedAt: row.teacherId === teacherId && row.lockedUntil > now ? row.claimedAt : now, lockedUntil: until });
      return copy(row);
    },
    async release(id, teacherId) {
      const row = reviews.find((item) => item.id === id && item.teacherId === teacherId);
      if (row) row.lockedUntil = null;
    },
    async findSubmission(id) {
      return copy(submissions.find((row) => row.id === id));
    },
    async complete(review, submission, event) {
      Object.assign(reviews.find((row) => row.id === review.id), structuredClone(review));
      submissions.find((row) => row.id === submission.id).teacherReview = structuredClone(submission.teacherReview);
      await events.addEvent(event);
    },
    async listExpired(now) {
      return reviews.filter((row) => row.status === 'WAITING' && row.expiresAt <= now && (!row.lockedUntil || row.lockedUntil <= now)).map(copy);
    },
    async expire(review, event) {
      const row = reviews.find((item) => item.id === review.id);
      if (row.status !== 'WAITING') return false;
      Object.assign(row, { status: 'EXPIRED', lockedUntil: null });
      await events.addEvent(event);
      return true;
    },
  };
}

const submission = (fields = {}) => ({
  id: randomUUID(),
  accountId: student.id,
  promptId: randomUUID(),
  kind: 'writing',
  prompt: { title: 'Day off', level: 'A2', instructions: 'Write an email.', sampleAnswer: 'Dear Ms Lee...', keyPoints: ['the day'], minWords: 5, maxWords: 50 },
  answer: 'Dear Ms Lee, I want take Friday off.',
  recording: null,
  recordingDeletedAt: null,
  status: 'DONE',
  result: { scores: { vocabulary: 3, grammar: 2.5, coherence: 3.5, task: 4, total: 3.3 } },
  teacherReview: null,
  ...fields,
});

function harness(rows) {
  const clock = { now: new Date('2026-10-21T03:00:00Z') };
  const eventRepository = createEventRepository();
  const events = new LearningEvents(eventRepository, { transport: fakeTransport(), now: () => clock.now });
  const repository = createReviewRepository(rows, eventRepository);
  const service = new ReviewService(repository, { now: () => clock.now, events });
  return { service, repository, eventRepository, clock, rows };
}

test('a learner reserves one of three weekly reviews per answer; returned reviews give the turn back', async () => {
  const rows = [submission(), submission(), submission(), submission(), submission({ status: 'SCORING' }), submission({ kind: 'read_aloud', recording: { url: 'x' }, recordingDeletedAt: new Date() })];
  const { service, repository, clock } = harness(rows);
  await assert.rejects(() => service.getQuota(teacher), { code: 26 });
  assert.deepEqual(await service.getQuota(student), { quota: { limit: 3, used: 0, left: 3, weekStart: '2026-10-19' } });
  await assert.rejects(() => service.request(student, { submissionId: rows[4].id }), { code: 73 });
  await assert.rejects(() => service.request(student, { submissionId: rows[5].id }), { code: 73 });
  await assert.rejects(() => service.request({ id: randomUUID(), role: 'STUDENT' }, { submissionId: rows[0].id }), { code: 74 });

  const first = await service.request(student, { submissionId: rows[0].id });
  assert.deepEqual([first.review.status, first.quota.left], ['WAITING', 2]);
  await assert.rejects(() => service.request(student, { submissionId: rows[0].id }), { code: 73 });
  await service.request(student, { submissionId: rows[1].id });
  await service.request(student, { submissionId: rows[2].id });
  await assert.rejects(() => service.request(student, { submissionId: rows[3].id }), { code: 72 });

  clock.now = new Date(clock.now.getTime() + 49 * HOUR);
  assert.equal(await service.expireDue(), 3);
  assert.equal((await service.getQuota(student)).quota.left, 3);
  assert.equal((await service.request(student, { submissionId: rows[0].id })).review.status, 'WAITING');
  assert.equal(repository.reviews.length, 3);
  clock.now = new Date('2026-10-26T17:00:00Z');
  assert.equal(vietnamWeekStart(clock.now), '2026-10-26');
  assert.equal((await service.getQuota(student)).quota.left, 3);
});

test('teachers share one queue, oldest first; taking an answer locks it for two hours', async () => {
  const rows = [submission(), submission({ status: 'SAVED', result: null })];
  const { service, clock } = harness(rows);
  await service.request(student, { submissionId: rows[0].id });
  clock.now = new Date(clock.now.getTime() + 60_000);
  await service.request(student, { submissionId: rows[1].id });
  await assert.rejects(() => service.listQueue(student), { code: 26 });
  const queue = await service.listQueue(teacher);
  assert.deepEqual(queue.reviews.map((item) => [item.title, item.hasAi, item.mine]), [['Day off', true, false], ['Day off', false, false]]);
  assert.equal('accountId' in queue.reviews[0], false);

  const id = queue.reviews[0].id;
  const detail = await service.claim(teacher, id);
  assert.deepEqual([detail.prompt.sampleAnswer, detail.work.answer, detail.ai.scores.total, detail.maxScore, detail.criteria.length], ['Dear Ms Lee...', 'Dear Ms Lee, I want take Friday off.', 3.3, 5, 4]);
  await assert.rejects(() => service.claim(otherTeacher, id), { code: 75 });
  assert.deepEqual((await service.listQueue(otherTeacher)).reviews.map((item) => item.hasAi), [false]);
  assert.equal((await service.listQueue(teacher)).reviews[0].mine, true);
  await assert.rejects(() => service.getReview(otherTeacher, id), { code: 75 });

  clock.now = new Date(clock.now.getTime() + 2 * HOUR + 1);
  assert.equal((await service.claim(otherTeacher, id)).review.id, id);
  await assert.rejects(() => service.getReview(teacher, id), { code: 75 });
  await service.release(otherTeacher, id);
  assert.equal((await service.claim(teacher, id)).review.id, id);
});

test('confirming, changing or grading from the start; a comment is required when the score changes', async () => {
  const rows = [submission(), submission(), submission({ status: 'SAVED', result: null })];
  const { service, eventRepository, rows: stored } = harness(rows);
  for (const row of rows) await service.request(student, { submissionId: row.id });
  const [a, b, c] = (await service.listQueue(teacher)).reviews.map((item) => item.id);

  await service.claim(teacher, a);
  const confirmed = await service.complete(teacher, a, { action: 'CONFIRM', scores: {}, note: '' });
  assert.deepEqual(confirmed.review.scores, { vocabulary: 3, grammar: 2.5, coherence: 3.5, task: 4, total: 3.3 });
  assert.equal(stored[0].teacherReview.action, 'CONFIRM');
  await assert.rejects(() => service.complete(teacher, a, { action: 'CONFIRM' }), { code: 74 });

  await service.claim(teacher, b);
  await assert.rejects(() => service.complete(teacher, b, { action: 'EDIT', scores: { vocabulary: 4, grammar: 3, coherence: 3.5, task: 4 }, note: ' ' }), { code: 30 });
  await assert.rejects(() => service.complete(teacher, b, { action: 'FROM_SCRATCH', scores: {}, note: 'x' }), { code: 30 });
  await assert.rejects(() => service.complete(teacher, b, { action: 'EDIT', scores: { vocabulary: 6, grammar: 3, coherence: 3.5, task: 4 }, note: 'Good' }), { code: 30 });
  const edited = await service.complete(teacher, b, { action: 'EDIT', scores: { vocabulary: 4.2, grammar: 3, coherence: 3.5, task: 4 }, note: 'Nice email; check "want to".' });
  assert.deepEqual(edited.review.scores, { vocabulary: 4, grammar: 3, coherence: 3.5, task: 4, total: 3.6 });
  assert.equal(stored[1].teacherReview.note, 'Nice email; check "want to".');

  await service.claim(teacher, c);
  await assert.rejects(() => service.complete(teacher, c, { action: 'CONFIRM' }), { code: 30 });
  await service.complete(teacher, c, { action: 'FROM_SCRATCH', scores: { vocabulary: 3, grammar: 3, coherence: 3, task: 3 }, note: 'Fine.' });

  const completed = eventRepository.tables.events.filter((event) => event.type === LearningEventType.REVIEW_COMPLETED);
  assert.deepEqual(completed.map((event) => event.payload.total), [3.3, 3.6, 3]);
  assert.equal((await service.listQueue(teacher)).doneThisWeek, 3);
  assert.equal((await service.getQuota(student)).quota.left, 0);
});

test('read-aloud and open speaking reviews recompute their totals; a review left too long is returned with a notice', async () => {
  const reading = submission({ kind: 'read_aloud', answer: null, recording: { url: 'https://media.test/r.webm', durationSeconds: 4 }, result: { scores: { accuracy: 8, completeness: 9, fluency: 7, total: 8.1 } } });
  const speaking = submission({ kind: 'open_speaking', answer: null, recording: { url: 'https://media.test/o.webm', durationSeconds: 30 }, result: { transcript: 'I like it', scores: { fluency: 8, pronunciation: 9, total: null }, gemini: null } });
  const late = submission();
  const { service, eventRepository, clock } = harness([reading, speaking, late]);
  for (const row of [reading, speaking, late]) await service.request(student, { submissionId: row.id });
  const [r, o, l] = (await service.listQueue(teacher)).reviews.map((item) => item.id);
  await service.claim(teacher, r);
  assert.equal((await service.complete(teacher, r, { action: 'EDIT', scores: { accuracy: 9, completeness: 9, fluency: 8 }, note: 'Clearer th sound.' })).review.scores.total, 8.8);
  const detail = await service.claim(teacher, o);
  assert.deepEqual([detail.ai.scores, detail.work.recordingUrl, detail.criteria.map((item) => item.key)], [null, 'https://media.test/o.webm', ['task', 'vocabulary', 'grammar', 'coherence', 'fluency', 'pronunciation']]);
  assert.equal((await service.complete(teacher, o, { action: 'FROM_SCRATCH', scores: { task: 4, vocabulary: 3, grammar: 3, coherence: 4, fluency: 8, pronunciation: 9 }, note: 'Good ideas.' })).review.scores.total, 7.6);

  await service.claim(teacher, l);
  clock.now = new Date(clock.now.getTime() + 47 * HOUR);
  assert.equal(await service.expireDue(), 0);
  clock.now = new Date(clock.now.getTime() + 2 * HOUR);
  assert.equal(await service.expireDue(), 1);
  const expired = eventRepository.tables.events.find((event) => event.type === LearningEventType.REVIEW_EXPIRED);
  assert.deepEqual([expired.payload.submissionId, expired.payload.title], [late.id, 'Day off']);
  assert.equal((await service.reviewFor(late.id)).status, 'EXPIRED');
});

test('a learner takes back a waiting review and gets the turn back, but not once a teacher holds it', async () => {
  const rows = [submission(), submission(), submission({ status: 'DONE' })];
  const { service, repository } = harness(rows);
  await service.request(student, { submissionId: rows[0].id });
  await service.request(student, { submissionId: rows[1].id });
  assert.equal((await service.getQuota(student)).quota.left, 1);
  const back = await service.withdraw(student, { submissionId: rows[0].id });
  assert.deepEqual([back.review, back.quota.left], [null, 2]);
  assert.equal(await service.reviewFor(rows[0].id), null);
  await assert.rejects(() => service.withdraw(student, { submissionId: rows[0].id }), { code: 74 });
  await assert.rejects(() => service.withdraw(teacher, { submissionId: rows[1].id }), { code: 26 });
  await assert.rejects(() => service.withdraw({ id: randomUUID(), role: 'STUDENT' }, { submissionId: rows[1].id }), { code: 74 });

  const held = repository.reviews.find((row) => row.submissionId === rows[1].id);
  await service.claim(teacher, held.id);
  await assert.rejects(() => service.withdraw(student, { submissionId: rows[1].id }), { code: 75 });
  await service.complete(teacher, held.id, { action: 'CONFIRM' });
  await assert.rejects(() => service.withdraw(student, { submissionId: rows[1].id }), { code: 74 });
  assert.equal((await service.request(student, { submissionId: rows[0].id })).review.status, 'WAITING');
});
