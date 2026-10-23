import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import {
  graphicQuestion,
  MOCK_FIRST_QUESTION_NUMBERS,
  mockIssueLabel,
  mockQuestionCount,
  mockQuestionNumber,
  withGraphicOn,
  withGroup,
  withQuestion,
  withoutGroup,
  withoutQuestion,
  workingMock,
} from './mock-draft.js';

const spec = (key) => LESSON_TEST_PARTS.find((part) => part.key === key);

test('an empty mock test has seven empty parts', () => {
  const content = workingMock(null);
  assert.deepEqual(Object.keys(content.test), ['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7']);
  assert.equal(mockQuestionCount(content), 0);
  assert.deepEqual(content.test.part6.groups, []);
});

test('the editor works on the draft and repairs missing options', () => {
  const content = workingMock({
    published: { content: { test: { part5: { questions: [{ id: 'old' }] } } } },
    draft: { content: { test: { part2: { questions: [{ id: 'q1', options: [{ id: 'o1', isCorrect: true }] }] } } } },
  });
  assert.equal(content.test.part5.questions.length, 0);
  const [question] = content.test.part2.questions;
  assert.equal(question.id, 'q1');
  assert.equal(question.options.length, 3);
  assert.deepEqual([question.options[0].id, question.options[0].isCorrect, question.options[1].isCorrect], ['o1', true, false]);
});

test('questions and passages are added and removed', () => {
  let part = workingMock(null).test.part5;
  part = withQuestion(withQuestion(part, spec('part5')), spec('part5'));
  assert.equal(part.questions.length, 2);
  assert.equal(part.questions[0].options.length, 4);
  assert.equal(withoutQuestion(part, part.questions[0].id).questions.length, 1);

  let grouped = withGroup(withGroup(workingMock(null).test.part7));
  const [first, second] = grouped.groups.map((group) => group.id);
  grouped = withQuestion(grouped, spec('part7'), second);
  grouped = withQuestion(grouped, spec('part7'), first);
  grouped = withQuestion(grouped, spec('part7'), first);
  grouped = withQuestion(grouped, spec('part7'), second);
  assert.deepEqual(grouped.questions.map((question) => question.groupId), [first, first, second, second]);
  const removed = withoutGroup(grouped, first);
  assert.deepEqual(removed.groups.map((group) => group.id), [second]);
  assert.deepEqual(removed.questions.map((question) => question.groupId), [second, second]);
});

test('the graphic of a conversation is on one question, the middle one by default', () => {
  let part = withGroup(workingMock(null).test.part3);
  const [groupId] = part.groups.map((group) => group.id);
  assert.equal(graphicQuestion(part, groupId), null);
  for (let index = 0; index < 3; index++) part = withQuestion(part, spec('part3'), groupId);
  const [first, middle, last] = part.questions;
  assert.equal(graphicQuestion(part, groupId).id, middle.id);

  middle.imageMediaId = 'image-1';
  part = withGraphicOn(part, groupId, last.id);
  assert.deepEqual(part.questions.map((question) => question.imageMediaId), [null, null, 'image-1']);
  assert.equal(graphicQuestion(part, groupId).id, last.id);

  const legacy = workingMock({
    draft: { content: { test: { part4: {
      groups: [{ id: groupId, imageMediaId: 'image-2' }],
      questions: [first, middle, last].map((question) => ({ id: question.id, groupId })),
    } } } },
  }).test.part4;
  assert.equal(legacy.groups[0].imageMediaId, null);
  assert.deepEqual(legacy.questions.map((question) => question.imageMediaId), [null, 'image-2', null]);
});

test('publish issue paths of a mock test become readable labels', () => {
  assert.equal(mockIssueLabel('test.part1.audioMediaId'), 'Part 1 · audio');
  assert.equal(mockIssueLabel('test.part5.questions'), 'Part 5 · questions');
  assert.equal(mockIssueLabel('test.part5.questions[2].options', workingMock(null)), 'Part 5 · question 103 · options');
  assert.equal(mockIssueLabel('test.part6.groups[1].passage'), 'Part 6 · set 2 · passage');
  assert.equal(mockIssueLabel('test.part3.groups[0].audioMediaId'), 'Part 3 · set 1 · audio');
  assert.equal(mockIssueLabel('test.part7.groups'), 'Part 7 · sets');
});

test('questions keep the number they have in a full test', () => {
  assert.deepEqual(MOCK_FIRST_QUESTION_NUMBERS, { part1: 1, part2: 7, part3: 32, part4: 71, part5: 101, part6: 131, part7: 147 });

  let part = workingMock(null).test.part3;
  for (let index = 0; index < 5; index++) part = withGroup(part);
  const sets = part.groups.map((group) => group.id);
  part = withQuestion(part, spec('part3'), sets[0]);
  part = withQuestion(part, spec('part3'), sets[4]);
  part = withQuestion(part, spec('part3'), sets[4]);
  part = withQuestion(part, spec('part3'), sets[1]);
  assert.deepEqual(part.questions.map((_, index) => mockQuestionNumber(spec('part3'), part, index)), [32, 35, 44, 45]);

  let reading = withGroup(withGroup(workingMock(null).test.part7));
  reading = withQuestion(reading, spec('part7'), reading.groups[1].id);
  assert.equal(mockQuestionNumber(spec('part7'), reading, 0), 147);
});
