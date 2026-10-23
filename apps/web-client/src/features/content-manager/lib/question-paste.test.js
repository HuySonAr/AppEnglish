import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import { pastePreview, withPastedQuestions, workingMock } from './mock-draft.js';
import { parsePastedQuestions } from './question-paste.js';

const part3 = LESSON_TEST_PARTS.find((part) => part.key === 'part3');
const part5 = LESSON_TEST_PARTS.find((part) => part.key === 'part5');
const pasted = `Questions 38 through 40 refer to the following conversation.
Question 38
What industry do the speakers most likely work in?
(A) Shipping
(B) Manufacturing
(C) Hospitality
(D) Meteorology
Correct Answer: A
Question 39
What is the reason for a delay?
(A) A schedule was written incorrectly.
(B) Some equipment is not properly set up.
(C) Weather conditions are poor.
(D) Several staff members are absent.
Correct Answer: C
Question 40
What does the man say he will do?
(A) Update a shift schedule
(B) Clear a work space
(C) Complete a checklist
(D) Place a call
Correct Answer: D
`;

test('pasted questions are read with their options and answer', () => {
  const questions = parsePastedQuestions(pasted);
  assert.deepEqual(questions.map((question) => [question.number, question.correct]), [[38, 0], [39, 2], [40, 3]]);
  assert.equal(questions[0].prompt, 'What industry do the speakers most likely work in?');
  assert.deepEqual(questions[1].options, [
    'A schedule was written incorrectly.',
    'Some equipment is not properly set up.',
    'Weather conditions are poor.',
    'Several staff members are absent.',
  ]);
});

test('other common layouts are read too', () => {
  const [question, next] = parsePastedQuestions(
    '41. Why is the woman\ncalling?\nA. To book a room\nB) To cancel\nan order\nD. To complain\nĐáp án: (B)\nQuestions 42-44 refer to the following talk.\n42) Who is speaking?',
  );
  assert.equal(question.prompt, 'Why is the woman calling?');
  assert.deepEqual(question.options, ['To book a room', 'To cancel an order', '', 'To complain']);
  assert.equal(question.correct, 1);
  assert.deepEqual([next.number, next.prompt, next.correct], [42, 'Who is speaking?', null]);
  assert.deepEqual(parsePastedQuestions('no question here'), []);
});

test('pasted questions go to the place of their number in Part 3', () => {
  const empty = workingMock(null).test.part3;
  const rows = pastePreview(empty, part3, parsePastedQuestions(pasted));
  assert.deepEqual(rows.map((row) => [row.set, row.place, row.replaces, row.errors.length, row.warnings.length]), [
    [2, 0, false, 0, 0],
    [2, 1, false, 0, 0],
    [2, 2, false, 0, 0],
  ]);

  // Conversations 1 and 2 are added empty so that 38-40 is conversation 3.
  const part = withPastedQuestions(empty, part3, rows);
  assert.equal(part.groups.length, 3);
  assert.deepEqual(part.questions.map((question) => question.groupId), Array(3).fill(part.groups[2].id));
  assert.equal(part.questions[1].prompt, 'What is the reason for a delay?');
  assert.deepEqual(part.questions[1].options.map((option) => [option.text, option.isCorrect])[2], ['Weather conditions are poor.', true]);

  // Pasting again replaces the text and keeps the question and what else it holds.
  part.questions[0].explanation = 'They talk about cargo.';
  const again = withPastedQuestions(part, part3, parsePastedQuestions('Question 38\nWho are they?\n(A) Sailors\nAnswer: A'));
  assert.equal(again.questions.length, 3);
  assert.deepEqual(
    [again.questions[0].id, again.questions[0].prompt, again.questions[0].explanation, again.questions[0].options[1].text],
    [part.questions[0].id, 'Who are they?', 'They talk about cargo.', ''],
  );
  assert.equal(pastePreview(part, part3, parsePastedQuestions('Question 38\nWho?'))[0].replaces, true);
});

test('questions that cannot be placed or are incomplete are reported', () => {
  const empty = workingMock(null).test.part3;
  const [outside, incomplete, twice] = pastePreview(
    empty,
    part3,
    parsePastedQuestions('Question 71\nWho?\n(A) x\n(B) y\n(C) z\n(D) w\nAnswer: A\nQuestion 32\n(A) x\nQuestion 32\nWho?'),
  );
  assert.deepEqual(outside.errors, ['Part 3 holds questions 32–70']);
  assert.deepEqual([incomplete.errors, incomplete.warnings], [[], ['no question text', '1 of 4 options', 'no correct answer']]);
  assert.deepEqual(twice.errors, ['this number appears twice']);
});

test('pasted questions of Part 5 are placed in order by their number', () => {
  const text = `Question 101
Former Sendai Company CEO Ken Nakata spoke about ------- career experiences.
(A) he
(B) his
(C) him
(D) himself
Correct Answer: B
Question 103
Passengers who will be taking a ------- domestic flight should go to Terminal A.
(A) connectivity
(B) connects
(C) connect
(D) connecting
Correct Answer: D
`;
  const empty = workingMock(null).test.part5;
  const rows = pastePreview(empty, part5, parsePastedQuestions(text));
  assert.deepEqual(rows.map((row) => [row.set, row.place, row.errors.length, row.warnings.length]), [[null, 0, 0, 0], [null, 2, 0, 0]]);

  // 102 was not pasted: its place is kept by a blank question.
  const part = withPastedQuestions(empty, part5, rows);
  assert.deepEqual(part.groups, []);
  assert.deepEqual(part.questions.map((question) => question.prompt.slice(0, 10)), ['Former Sen', '', 'Passengers']);
  assert.equal(part.questions[0].prompt, 'Former Sendai Company CEO Ken Nakata spoke about ------- career experiences.');
  assert.deepEqual(part.questions[2].options.map((option) => option.isCorrect), [false, false, false, true]);

  // Pasting 102 later fills the blank place without adding a question.
  const filled = withPastedQuestions(part, part5, parsePastedQuestions('Question 102\nThe ------- is open.\n(A) store\nAnswer: A'));
  assert.deepEqual([filled.questions.length, filled.questions[1].id, filled.questions[1].prompt], [3, part.questions[1].id, 'The ------- is open.']);
  assert.deepEqual(pastePreview(empty, part5, parsePastedQuestions('Question 131\nWho?'))[0].errors, ['Part 5 holds questions 101–130']);
});

test('mock Parts 1 and 2: what the recording says becomes the transcript and sets the answer', () => {
  const part2 = LESSON_TEST_PARTS.find((part) => part.key === 'part2');
  const part1 = LESSON_TEST_PARTS.find((part) => part.key === 'part1');
  const empty = workingMock(null).test.part2;
  const text = 'Question 8\nWhere is the meeting?\n(A) In room 3.\n(B) At noon.\n(C) Yes, it is.\nAnswer: A';
  const rows = pastePreview(empty, part2, parsePastedQuestions(text));
  assert.deepEqual(rows.map((row) => [row.place, row.errors, row.warnings]), [[1, [], []]]);
  const part = withPastedQuestions(empty, part2, rows);
  assert.equal(part.questions.length, 2);
  assert.equal(part.questions[1].transcript, 'Where is the meeting?\n(A) In room 3.\n(B) At noon.\n(C) Yes, it is.');
  assert.deepEqual(part.questions[1].options.map((option) => [option.text, option.isCorrect]), [['', true], ['', false], ['', false]]);
  assert.equal(pastePreview(part, part2, parsePastedQuestions('Question 8\nWho?\n(A) Me.'))[0].replaces, true);
  assert.deepEqual(pastePreview(empty, part2, parsePastedQuestions('Question 7\nWho?\n(A) a\n(B) b\n(C) c\n(D) d'))[0].errors, ['Part 2 has options A–C only']);
  assert.deepEqual(pastePreview(empty, part2, parsePastedQuestions('Question 7\n(A) a\n(B) b\n(C) c\nAnswer: B'))[0].warnings, ['no question line']);

  const photo = withPastedQuestions(workingMock(null).test.part1, part1, parsePastedQuestions('Question 1\n(A) A man is reading.\n(B) A woman is typing.\n(C) They walk.\n(D) It is empty.\nAnswer: B'));
  assert.equal(photo.questions[0].transcript, '(A) A man is reading.\n(B) A woman is typing.\n(C) They walk.\n(D) It is empty.');
  assert.deepEqual(photo.questions[0].options.map((option) => option.isCorrect), [false, true, false, false]);
});
