import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_REVIEW_FIRST_NUMBERS, unitReviewComplete, unitReviewIssueLabel, unitReviewQuestionCount, workingUnitReview } from './unit-review-draft.js';
import { withGroup, withQuestion } from './mock-draft.js';
import { UNIT_REVIEW_SPECS } from './unit-review-draft.js';

test('a review starts empty with both parts and fills up to 10 + 3 × 3 questions', () => {
  let content = workingUnitReview(null);
  assert.deepEqual(Object.keys(content.test), ['part5', 'part6']);
  assert.equal(unitReviewQuestionCount(content), 0);
  assert.equal(unitReviewComplete(content), false);
  const [spec5, spec6] = UNIT_REVIEW_SPECS;
  let part5 = content.test.part5;
  for (let index = 0; index < 10; index++) part5 = withQuestion(part5, spec5);
  let part6 = withGroup(withGroup(withGroup(content.test.part6)));
  for (const group of part6.groups) for (let index = 0; index < 3; index++) part6 = withQuestion(part6, spec6, group.id);
  content = { test: { part5, part6 } };
  assert.equal(unitReviewQuestionCount(content), 19);
  assert.equal(unitReviewComplete(content), true);
  assert.equal(part5.questions[0].options.length, 4);
  const reloaded = workingUnitReview({ draft: { content: { test: { part5: { questions: [{ id: 'q', prompt: 'x', options: [{ id: 'o', text: 'a', isCorrect: true }] }] } } } } });
  assert.equal(reloaded.test.part5.questions[0].options.length, 4);
  assert.equal(reloaded.test.part5.questions[0].options[0].text, 'a');
});

test('issue labels number the questions 1-19 across the two parts', () => {
  assert.equal(UNIT_REVIEW_FIRST_NUMBERS.part6, 11);
  assert.equal(unitReviewIssueLabel('test.part5.questions[2].prompt'), 'Part 5 · question 3 · question text');
  assert.equal(unitReviewIssueLabel('test.part6.groups[1].passage'), 'Part 6 · passage 2 · passage');
  assert.equal(unitReviewIssueLabel('test.part6.questions[6].options'), 'Part 6 · question 17 · options');
  assert.equal(unitReviewIssueLabel('test.part6.groups'), 'Part 6 · passages');
});
