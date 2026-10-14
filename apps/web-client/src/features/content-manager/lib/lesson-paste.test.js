import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import { emptyContent } from './lesson-draft.js';
import { lessonPastePlan } from './lesson-paste.js';

const spec = (key) => LESSON_TEST_PARTS.find((part) => part.key === key);
const question = (number, prompt, answer = 'A') =>
  `Question ${number}\n${prompt}\n(A) one\n(B) two\n(C) three\n(D) four\nCorrect Answer: ${answer}\n`;
const plan = (key, text, part = emptyContent().test[key]) => lessonPastePlan(part, spec(key), null, text);

test('questions with the numbers of a book fill a lesson part in order', () => {
  // Part 3 of a lesson test holds questions 4-6.
  const { part, count, lines } = plan('part3', question(38, 'Who?') + question(39, 'What?', 'C') + question(40, 'When?', 'D'));
  assert.equal(count, 3);
  assert.deepEqual(lines.map((line) => [line.title, line.note, line.errors, line.warnings]), [
    ['Question 38', ' · fills question 4 · answer A', [], []],
    ['Question 39', ' · fills question 5 · answer C', [], []],
    ['Question 40', ' · fills question 6 · answer D', [], []],
  ]);
  assert.equal(part.questions.length, 3);
  assert.deepEqual(part.questions.map((item) => item.prompt), ['Who?', 'What?', 'When?']);
  assert.deepEqual(part.questions[1].options.map((option) => option.isCorrect), [false, false, true, false]);
});

test('questions with the numbers of the lesson go to those numbers', () => {
  const filled = plan('part5', question(10, 'First') + question(11, 'Second')).part;
  filled.questions[2].explanation = 'Kept.';
  const { part, lines } = plan('part5', question(12, 'Third', 'B'), filled);
  assert.equal(lines[0].note, ' · fills question 12 · answer B');
  assert.deepEqual(part.questions.map((item) => item.prompt), ['First', 'Second', 'Third', '', '', '']);
  assert.deepEqual([part.questions[2].id, part.questions[2].explanation], [filled.questions[2].id, 'Kept.']);
  assert.equal(plan('part5', question(10, 'Again'), filled).lines[0].note, ' · fills question 10 · replaces what is there · answer A');
});

test('Parts 1 and 2 are pasted as what the recording says', () => {
  const part1 = plan('part1', 'Question 1\n(A) A man is reading.\n(B) A woman is typing.\n(C) They are walking.\n(D) The room is empty.\nCorrect Answer: B');
  assert.deepEqual(part1.lines.map((line) => [line.note, line.errors, line.warnings]), [[' · fills question 1 · answer B', [], []]]);
  assert.equal(part1.part.transcript, '1.\n(A) A man is reading.\n(B) A woman is typing.\n(C) They are walking.\n(D) The room is empty.');
  assert.deepEqual(part1.part.questions[0].options.map((option) => [option.text, option.isCorrect]), [['', false], ['', true], ['', false], ['', false]]);
  assert.equal(part1.part.questions[0].prompt, '');

  // Part 2 holds questions 2-3; questions numbered 7 and 8 in a book fill them in order.
  const before = { ...emptyContent().test.part2, transcript: 'Old.' };
  const text = 'Question 7\nWhere is the meeting?\n(A) In room 3.\n(B) At noon.\n(C) Yes, it is.\nAnswer: A\n8. When does the train leave?\n(A) Platform 2.\n(B) At six.\n(C) By bus.\nAnswer: B';
  const part2 = plan('part2', text, before);
  assert.deepEqual(part2.lines.map((line) => line.note), [' · fills question 2 · replaces the transcript · answer A', ' · fills question 3 · answer B']);
  assert.equal(
    part2.part.transcript,
    '2. Where is the meeting?\n(A) In room 3.\n(B) At noon.\n(C) Yes, it is.\n\n3. When does the train leave?\n(A) Platform 2.\n(B) At six.\n(C) By bus.',
  );
  assert.deepEqual(part2.part.questions.map((item) => item.options.findIndex((option) => option.isCorrect)), [0, 1]);

  // Part 2 has no option D, and one question alone leaves the other out of the transcript.
  const one = plan('part2', 'Question 2\nWho called?\n(A) Tom.\n(B) Yes.\n(C) At five.\n(D) No.\nAnswer: A', before);
  assert.deepEqual(one.lines[0].errors, ['Part 2 has options A–C only']);
  assert.deepEqual(one.lines[0].warnings, ['the transcript will hold 1 of the 2 questions of the part']);
  assert.equal(one.part, before);
});

test('more questions than the part holds are refused', () => {
  const empty = emptyContent().test.part3;
  const text = [38, 39, 40, 41].map((number) => question(number, 'Who?')).join('');
  const { part, lines } = plan('part3', text, empty);
  assert.deepEqual(lines[3].errors, ['Part 3 of this test has only questions 4–6']);
  assert.equal(part, empty);
});

test('a pasted passage fills Part 6 and Part 7 of a lesson', () => {
  const options = '(A) one\n(B) two\n(C) three\n(D) four\n';
  const part6 = plan(
    'part6',
    `Passage 1 – Questions 131–133\nLetter\nThank you for your [131] support. We received a lot of [132]. [133] See you soon.\nQuestion 131\n${options}Correct Answer: C\nQuestion 132\n${options}Correct Answer: A\nQuestion 133\n${options}Correct Answer: B\n`,
  );
  assert.deepEqual(part6.lines.map((line) => [line.title, line.note, line.errors, line.warnings]), [
    ['Passage', ' · fills questions 16–18 · answers C A B', [], []],
  ]);
  assert.equal(part6.part.passage, 'Thank you for your ___ support. We received a lot of ___. ___ See you soon.');
  assert.deepEqual(part6.part.questions.map((item) => item.options.findIndex((option) => option.isCorrect)), [2, 0, 1]);

  // A passage of four blanks does not fit the three questions of a lesson.
  const four = plan('part6', `Passage 1 – Questions 131–134\nA [131] b [132] c [133] d [134].\n${[131, 132, 133, 134].map((number) => `Question ${number}\n${options}`).join('')}`);
  assert.equal(four.lines[0].errors[0], 'Part 6 of this test has only questions 16–18');
  assert.equal(four.part.passage, '');

  const part7 = plan('part7', `Passage 1 – Questions 147–148\nNotice\nRoom\tTime\nA101\t9:00\n${question(147, 'Where?')}${question(148, 'When?', 'B')}`);
  assert.equal(part7.part.passage, 'Notice\n| Room | Time |\n| A101 | 9:00 |');
  assert.deepEqual(part7.part.questions.map((item) => item.prompt), ['Where?', 'When?', '', '', '']);
  assert.deepEqual(part7.lines[0].warnings, ['2 of 5 questions']);
  assert.equal(plan('part7', `Passage 1 – Questions 147–147\nA\n${question(147, 'Q')}\nPassage 2 – Questions 148–148\nB\n${question(148, 'Q')}`).lines[1].errors[0], 'Part 7 of this test has one passage');
});
