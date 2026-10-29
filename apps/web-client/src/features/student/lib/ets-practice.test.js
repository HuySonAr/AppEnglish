import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupBySet,
  hasTimer,
  isSetPrompt,
  newSetId,
  nextSetStep,
  playCount,
  prepareSeconds,
  readNoTimer,
  readSeconds,
  recordSeconds,
  setIntroHint,
  remainingSeconds,
  setTotal,
  timerStorageKey,
  writeNoTimer,
  writingLocked,
} from './ets-practice.js';

const info = {
  etsTask: 'respond_info',
  maxSeconds: 60,
  timing: { readSeconds: 45, prepareSeconds: 3, respondSeconds: [15, 15, 30], playTwice: [2] },
  questions: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
};

test('set prompts run three questions with their own timing', () => {
  assert.equal(isSetPrompt(info), true);
  assert.equal(isSetPrompt({ ...info, questions: [] }), false);
  assert.equal(isSetPrompt({ etsTask: 'express_opinion', questions: [] }), false);
  assert.deepEqual([0, 1, 2].map((index) => recordSeconds(info, index)), [15, 15, 30]);
  assert.equal(recordSeconds({ ...info, maxSeconds: 60 }, 2), 30);
  assert.equal(recordSeconds({ ...info, maxSeconds: 20 }, 0), 15);
  assert.deepEqual([0, 1, 2].map((index) => playCount(info, index)), [1, 1, 2]);
  assert.deepEqual([prepareSeconds(info), readSeconds(info)], [3, 45]);
  assert.deepEqual(nextSetStep(0), { phase: 'question', index: 1 });
  assert.deepEqual(nextSetStep(2), { phase: 'done', index: 2 });
});

test('old prompts have no timer', () => {
  const old = { etsTask: null, timing: null, maxSeconds: 90 };
  assert.equal(hasTimer(old), false);
  assert.equal(recordSeconds(old), 90);
  assert.equal(prepareSeconds(old), 0);
});

test('countdowns and the writing lock follow the clock', () => {
  assert.equal(remainingSeconds(null, 96, 5000), 96);
  assert.equal(remainingSeconds(1000, 96, 11000), 86);
  assert.equal(remainingSeconds(0, 10, 20000), 0);
  const prompt = { timing: { writeSeconds: 96 } };
  assert.equal(writingLocked(prompt, true, 0), true);
  assert.equal(writingLocked(prompt, false, 0), false);
  assert.equal(writingLocked(prompt, true, 12), false);
  assert.equal(writingLocked({ timing: null }, true, 0), false);
});

test('set ids look like uuids', () => {
  assert.match(newSetId(null), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(newSetId({ randomUUID: () => 'fixed' }), 'fixed');
});

test('the no-timer choice is kept per learner and survives broken storage', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  assert.equal(readNoTimer(storage, 'u1'), false);
  writeNoTimer(storage, 'u1', true);
  assert.equal(readNoTimer(storage, 'u1'), true);
  assert.equal(readNoTimer(storage, 'u2'), false);
  writeNoTimer(storage, 'u1', false);
  assert.equal(data.has(timerStorageKey('u1')), false);
  const fail = () => {
    throw new Error('blocked');
  };
  const broken = { getItem: fail, setItem: fail, removeItem: fail };
  assert.equal(readNoTimer(broken, 'u1'), false);
  assert.doesNotThrow(() => writeNoTimer(broken, 'u1', true));
  assert.equal(readNoTimer(undefined, 'u1'), false);
});

test('history groups the answers of one try', () => {
  const groups = groupBySet([
    { id: 's6', setId: 'B', questionIndex: 2, status: 'SCORING', total: null, submittedAt: '2026-10-26T10:02:00Z' },
    { id: 's5', setId: 'B', questionIndex: 1, status: 'DONE', total: 6, submittedAt: '2026-10-26T10:01:00Z' },
    { id: 's4', setId: 'B', questionIndex: 0, status: 'DONE', total: 7, submittedAt: '2026-10-26T10:00:00Z' },
    { id: 's3', setId: 'A', questionIndex: 2, status: 'DONE', total: 8, submittedAt: '2026-10-25T10:02:00Z' },
    { id: 's2', setId: 'A', questionIndex: 1, status: 'DONE', total: 6, submittedAt: '2026-10-25T10:01:00Z' },
    { id: 's1', setId: 'A', questionIndex: 0, status: 'DONE', total: 7, submittedAt: '2026-10-25T10:00:00Z' },
    { id: 's0', setId: null, questionIndex: null, status: 'DONE', total: 5, submittedAt: '2026-10-20T10:00:00Z' },
  ]);
  assert.deepEqual(groups.map((group) => group.id), ['B', 'A', 's0']);
  assert.deepEqual(groups[0].answers.map((answer) => answer.id), ['s4', 's5', 's6']);
  assert.deepEqual([groups[0].status, groups[0].total], ['SCORING', null]);
  assert.deepEqual([groups[1].status, groups[1].total, groups[1].submittedAt], ['DONE', 7, '2026-10-25T10:02:00Z']);
  assert.equal(groups[2].total, 5);
  assert.equal(setTotal([{ total: 7 }, { total: null }]), null);
});

test('the set intro says the ETS order: read, hear, prepare, answer', () => {
  const heard = { ...info, questions: info.questions.map((question) => ({ ...question, audioUrl: 'q.mp3' })) };
  assert.equal(setIntroHint(heard, 8), '45 s to read, then hear 3 questions (question 10 twice): prepare 3 s, answer 15 / 15 / 30 s.');
  assert.equal(setIntroHint(heard, 8, false), 'Hear 3 questions (question 10 twice), up to 15 / 15 / 30 s each.');
  const asked = { etsTask: 'respond_questions', timing: { prepareSeconds: 3, respondSeconds: [15, 15, 30] }, questions: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] };
  assert.equal(setIntroHint(asked, 5), 'Answer 3 questions one by one: prepare 3 s, answer 15 / 15 / 30 s.');
});

