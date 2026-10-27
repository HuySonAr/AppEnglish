import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_CRITERIA } from '@appenglish/learning-contracts';
import { actionFor, hoursLeft, initialScores, isWrittenKind, previewTotal, reviewKindLabels, scoresChanged } from './review.js';

const criteria = REVIEW_CRITERIA.writing;
const ai = { vocabulary: 3, grammar: 2.5, coherence: 3.5, task: 4, total: 3.3 };

test('the form starts from the AI score and picks the action from what changed', () => {
  assert.deepEqual(initialScores(criteria, ai), { vocabulary: 3, grammar: 2.5, coherence: 3.5, task: 4 });
  assert.deepEqual(initialScores(criteria, null), { vocabulary: 1, grammar: 1, coherence: 1, task: 1 });
  assert.equal(scoresChanged(criteria, ai, { vocabulary: 3, grammar: 2.5, coherence: 3.5, task: 4 }), false);
  assert.equal(scoresChanged(criteria, ai, { vocabulary: 4, grammar: 2.5, coherence: 3.5, task: 4 }), true);
  assert.deepEqual([actionFor(ai, false), actionFor(ai, true), actionFor(null, false)], ['CONFIRM', 'EDIT', 'FROM_SCRATCH']);
});

test('the total preview follows the same formula as the server', () => {
  assert.equal(previewTotal('writing', criteria, { vocabulary: 4, grammar: 3, coherence: 3.5, task: 4 }), 3.6);
  assert.equal(previewTotal('read_aloud', REVIEW_CRITERIA.read_aloud, { accuracy: 9, completeness: 9, fluency: 8 }), 8.8);
  assert.equal(previewTotal('writing', criteria, { vocabulary: 7, grammar: 3, coherence: 3.5, task: 4 }), null);
  assert.equal(hoursLeft('2026-10-23T12:00:00Z', new Date('2026-10-23T10:00:00Z')), 2);
});

test('S&W kinds have queue labels and icons', () => {
  assert.deepEqual([reviewKindLabels.sw_speaking, reviewKindLabels.sw_writing], ['S&W Speaking', 'S&W Writing']);
  assert.deepEqual([isWrittenKind('sw_writing'), isWrittenKind('writing'), isWrittenKind('sw_speaking')], [true, true, false]);
});
