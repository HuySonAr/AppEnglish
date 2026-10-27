import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { attemptBadgeText, attemptStatus, canRetry, canSendToTeacher, formatScore, isScoring, itemScore, rawText, retryErrorText, reviewErrorText, shownFinal, swBandInfo, swResultPath } from './sw-score.js';

test('the result path keeps the section and the attempt', () => {
  assert.equal(swResultPath('t1', 'speaking', 2), '/student/sw-tests/t1/result?section=speaking&attempt=2');
  assert.equal(swResultPath('t1', 'writing'), '/student/sw-tests/t1/result?section=writing');
});

test('the band shows the ETS range of the scaled score', () => {
  const speaking = swBandInfo('speaking', 170);
  assert.deepEqual([speaking.level, speaking.levels, speaking.range], [7, 8, '160–180']);
  assert.equal(swBandInfo('writing', 40).range, '40');
  assert.equal(swBandInfo('writing', 200, 8).level, 9);
  assert.equal(swBandInfo('speaking', null), null);
  assert.ok(swBandInfo('speaking', 0).description.length > 0);
});

test('the teacher score replaces the AI one', () => {
  const ai = { raw: 20.5, rawMax: 35, scaled: 120 };
  const teacher = { raw: 24, rawMax: 35, scaled: 140 };
  assert.deepEqual(shownFinal({ scoring: { final: ai }, teacherReview: { final: teacher } }), { final: teacher, reviewed: true });
  assert.deepEqual(shownFinal({ scoring: { final: ai }, teacherReview: null }), { final: ai, reviewed: false });
  assert.deepEqual(shownFinal({ scoring: null }), { final: null, reviewed: false });
  assert.equal(rawText(ai, 'speaking'), '20.5/35');
  assert.equal(rawText(null, 'writing'), '—/28');
  assert.equal(formatScore(1.5), '1.5');
  assert.equal(formatScore(3), '3');
});

test('scoring states decide polling and retry', () => {
  assert.equal(isScoring({ scoring: { status: 'SCORING' } }), true);
  assert.equal(isScoring({ scoring: null }), false);
  assert.equal(canRetry({ scoring: { status: 'FAILED' } }), true);
  assert.equal(canRetry({ scoring: { status: 'NO_KEY' } }), true);
  assert.equal(canRetry({ scoring: { status: 'DONE' } }), false);
  assert.equal(canRetry({ scoring: { status: 'NO_KEY' }, teacherReview: { final: {} } }), false);
});

test('each attempt shows its score or its status', () => {
  assert.equal(attemptBadgeText(attemptStatus({ scaled: 150, reviewed: false })), '150 · Estimated');
  assert.equal(attemptBadgeText(attemptStatus({ scaled: 160, reviewed: true })), '160 · Teacher');
  assert.equal(attemptStatus({ scaled: null, scoringStatus: 'SCORING' }).label, 'Scoring…');
  assert.equal(attemptStatus({ scaled: null, scoringStatus: 'FAILED' }).label, 'Not scored');
  assert.equal(attemptStatus({ scaled: null, scoringStatus: 'NO_KEY' }).label, 'No Gemini key');
  assert.equal(attemptStatus({ scaled: null, scoringStatus: null }).label, 'Not scored yet');
  assert.equal(attemptStatus(null), null);
});

test('a question shows the teacher, the AI score, the stage or the error', () => {
  const readAloud = { task: 'read_aloud', ai: { stage: 'done', score: 2.5, pronunciation: 3, intonation: 2 }, teacher: { task: 'read_aloud', score: 2, pronunciation: 2, intonation: 2 } };
  assert.deepEqual(itemScore(readAloud), { source: 'ai', score: 2.5, pronunciation: 3, intonation: 2 });
  assert.deepEqual(itemScore(readAloud, { reviewed: true }), { source: 'teacher', score: 2, pronunciation: 2, intonation: 2 });
  assert.deepEqual(itemScore({ task: 'express_opinion', ai: { stage: 'grading' } }), { source: 'pending', label: 'Scoring…' });
  assert.deepEqual(itemScore({ task: 'describe_picture', ai: { stage: 'listening' } }), { source: 'pending', label: 'Listening…' });
  assert.deepEqual(itemScore({ task: 'opinion_essay', ai: { stage: 'failed', error: 'Quota' } }), { source: 'failed', error: 'Quota' });
  assert.deepEqual(itemScore({ task: 'opinion_essay', ai: null }), { source: 'none' });
  assert.deepEqual(itemScore({ task: 'opinion_essay', ai: { stage: 'done', score: 4 } }), { source: 'ai', score: 4, pronunciation: null, intonation: null });
});

test('sending to a teacher needs a turn, a finished scoring and a recording', () => {
  const base = { reviewQuota: { limit: 3, used: 0, left: 3 }, review: null, teacherReview: null, scoring: { status: 'DONE' }, items: [{ recordingUrl: 'u' }] };
  assert.equal(canSendToTeacher(base, 'speaking'), true);
  assert.equal(canSendToTeacher({ ...base, scoring: { status: 'SCORING' } }, 'speaking'), false);
  assert.equal(canSendToTeacher({ ...base, review: { status: 'WAITING' } }, 'speaking'), false);
  assert.equal(canSendToTeacher({ ...base, review: { status: 'EXPIRED' } }, 'speaking'), true);
  assert.equal(canSendToTeacher({ ...base, items: [{ recordingUrl: null }] }, 'speaking'), false);
  assert.equal(canSendToTeacher({ ...base, items: [{ answer: 'x' }] }, 'writing'), true);
  assert.equal(canSendToTeacher({ ...base, reviewQuota: null }, 'writing'), false);
});

test('error codes get short reasons', () => {
  const error = (code, reason) => ({ response: { data: { code, data: { reason } } } });
  assert.equal(reviewErrorText(error(LearningResponseCode.REVIEW_NOT_ALLOWED, 'ALREADY_SENT'), 'x'), 'This part was already sent to a teacher.');
  assert.equal(reviewErrorText(error(LearningResponseCode.REVIEW_LIMIT_REACHED), 'x'), 'x');
  assert.equal(retryErrorText(error(LearningResponseCode.SW_ANSWER_LOCKED), 'x'), 'This part is already scored or being scored.');
  assert.equal(retryErrorText(error(LearningResponseCode.AI_KEY_INVALID), 'x'), 'x');
});
