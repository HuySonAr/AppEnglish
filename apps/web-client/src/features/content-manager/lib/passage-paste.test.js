import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import { pastedPassagesPlan, workingMock } from './mock-draft.js';
import { parsePastedPassages } from './question-paste.js';

const part6 = LESSON_TEST_PARTS.find((part) => part.key === 'part6');
const first = `Passage 1 – Questions 131–134
Announcement
Come to the Maxley Heights Center for Horticulture. [131] We will teach you how to plant a rain garden, which is simply a shallow sunken garden [132] a special soil mix.
These gardens can be landscaped with native plants and flowers. [133], rain gardens are always beneficial. Among other things, [134] improve drainage.
To register, visit www.maxley-horticulture.org.
Question 131
(A) Children of all ages will enjoy the new exhibits.
(B) Learn about rainfall patterns across the region.
(C) Build a set of simple patio furniture with easy-to-acquire materials.
(D) Next Saturday at 4 P.M., we are hosting a free workshop for the public.
Correct Answer: D
Question 132
(A) to use
(B) used to
(C) by using
(D) that uses
Correct Answer: D
Question 133
(A) Best of all
(B) For example
(C) In any event
(D) As a matter of fact
Correct Answer: A
Question 134
(A) we
(B) they
(C) both
(D) yours
Correct Answer: B
`;
const second = `
Passage 2 – Questions 135–138
Letter
31 July
Akwasi Dombo
Dear Mr. Dombo,
Thank you for your [135] support. Your designs received a lot of [136] on social media. [137] The auction [138] our Young Designers Award program is coming up soon.
Sincerely,
Asahi Ishioka
Question 135
(A) amazed
(B) amazement
(C) amazing
(D) amazingly
Correct Answer: C
Question 136
(A) attention
(B) proposals
(C) innovation
(D) criticism
Correct Answer: A
Question 137
(A) Several other events have gone surprisingly well.
(B) Thank you also for your flexibility in planning the event.
(C) Please stop by our office the next time you are in the city.
(D) Tokyo is a top tourism destination for many reasons.
Correct Answer: B
Question 138
(A) will benefit
(B) to benefit
(C) has benefited
(D) benefits
Correct Answer: B
`;

test('pasted passages are read with their blanks and questions', () => {
  const [announcement, letter] = parsePastedPassages(first + second);
  assert.deepEqual([announcement.from, announcement.to, announcement.blanks], [131, 134, [131, 132, 133, 134]]);
  // The line naming the document is left out; line breaks and the lines of a letter stay.
  assert.ok(announcement.passage.startsWith('Come to the Maxley Heights Center for Horticulture. ___ We will teach'));
  assert.ok(announcement.passage.includes('flowers. ___, rain gardens'));
  assert.equal(announcement.passage.split('\n').length, 3);
  assert.ok(letter.passage.startsWith('31 July\nAkwasi Dombo\nDear Mr. Dombo,'));
  assert.ok(letter.passage.endsWith('Sincerely,\nAsahi Ishioka'));
  assert.deepEqual(letter.questions.map((question) => [question.number, question.prompt, question.correct]), [
    [135, '', 2],
    [136, '', 0],
    [137, '', 1],
    [138, '', 1],
  ]);

  // Other ways of writing the heading and the blanks.
  const [other] = parsePastedPassages('Questions 131-132 refer to the following e-mail.\nWe ---131--- you. Please (132) ------- soon.\n131. (A) thank\n132. (A) reply');
  assert.deepEqual([other.passage, other.blanks, other.questions.length], ['We ___ you. Please ___ soon.', [131, 132], 2]);
});

test('pasted passages become the sets of Part 6', () => {
  const empty = workingMock(null).test.part6;
  const { part, rows } = pastedPassagesPlan(empty, part6, parsePastedPassages(first + second));
  assert.deepEqual(rows.map((row) => [row.set, row.replaces, row.errors, row.warnings]), [
    [0, false, [], []],
    [1, false, [], []],
  ]);
  assert.equal(part.groups.length, 2);
  assert.deepEqual(part.questions.map((question) => question.groupId), [...Array(4).fill(part.groups[0].id), ...Array(4).fill(part.groups[1].id)]);
  assert.equal(part.groups[1].passage.split('___').length - 1, 4);
  assert.deepEqual(part.questions[5].options.map((option) => [option.text, option.isCorrect])[0], ['attention', true]);

  // Pasting a passage again replaces it and keeps its questions.
  part.questions[0].explanation = 'The workshop is announced first.';
  const again = pastedPassagesPlan(part, part6, parsePastedPassages(first.replace('(A) we', '(A) us')));
  assert.deepEqual([again.rows[0].set, again.rows[0].replaces], [0, true]);
  assert.equal(again.part.questions.length, 8);
  assert.deepEqual(
    [again.part.questions[0].id, again.part.questions[0].explanation, again.part.questions[3].options[0].text],
    [part.questions[0].id, 'The workshop is announced first.', 'us'],
  );
});

test('passages that cannot be used are reported and left out', () => {
  const empty = workingMock(null).test.part6;
  // Passage 2 alone does not follow an empty part.
  const alone = pastedPassagesPlan(empty, part6, parsePastedPassages(second));
  assert.deepEqual(alone.rows[0].errors, ['questions 135–138 do not follow what Part 6 holds: the next passage starts at question 131']);
  assert.equal(alone.part, empty);

  const broken = pastedPassagesPlan(
    empty,
    part6,
    parsePastedPassages('Passage 1 – Questions 131–132\nWe [131] you.\nQuestion 131\n(A) thank\nAnswer: A\n\nPassage 9 – Questions 147–150\nText [147].\nQuestion 147\n(A) x'),
  );
  assert.deepEqual(broken.rows[0].errors, ['the blanks in the passage are 131, not 131–132', 'the questions found are 131, not 131–132']);
  assert.deepEqual(broken.rows[0].warnings, ['question 131: 1 of 4 options']);
  assert.equal(broken.rows[1].errors[0], 'Part 6 holds questions 131–146');
  assert.equal(broken.part.questions.length, 0);
});

test('pasted sets of Part 7 keep their documents whole and their tables', () => {
  const part7 = LESSON_TEST_PARTS.find((part) => part.key === 'part7');
  const text = [
    'Passage 1 – Questions 147–148',
    'Notice',
    'The pool is closed. [1] It reopens on Monday. [2]',
    'Question 147',
    'What is being announced?',
    '(A) A closure',
    '(B) A sale',
    '(C) A hiring',
    '(D) A move',
    'Correct Answer: A',
    'Question 148',
    'In which of the positions marked [1] and [2] does the sentence belong?',
    '(A) [1]',
    '(B) [2]',
    '(C) [3]',
    '(D) [4]',
    'Correct Answer: B',
    '',
    'Passage 2 – Questions 149–150',
    'Document 1 – E-mail',
    'To:\tAll staff',
    'Please see the schedule.',
    'Document 2 – Schedule',
    'Room\tTime\tEvent',
    'A101\t9:00 A.M.\tSales meeting',
    'Question 149',
    'Who is the e-mail for?',
    '(A) Staff',
    'Correct Answer: A',
    'Question 150',
    'When is the sales meeting?',
    '(A) At 9:00 A.M.',
    'Correct Answer: A',
  ].join('\n');
  const passages = parsePastedPassages(text, { blanks: false });
  assert.equal(passages[0].passage, 'Notice\nThe pool is closed. [1] It reopens on Monday. [2]');
  assert.equal(
    passages[1].passage,
    'Document 1 – E-mail\nTo: All staff\nPlease see the schedule.\nDocument 2 – Schedule\n| Room | Time | Event |\n| A101 | 9:00 A.M. | Sales meeting |',
  );

  const { part, rows } = pastedPassagesPlan(workingMock(null).test.part7, part7, passages);
  assert.deepEqual(rows.map((row) => [row.set, row.errors]), [[0, []], [1, []]]);
  assert.deepEqual(rows[1].warnings, ['question 149: 1 of 4 options', 'question 150: 1 of 4 options']);
  assert.deepEqual(part.questions.map((question) => question.prompt.slice(0, 8)), ['What is ', 'In which', 'Who is t', 'When is ']);
  assert.equal(part.groups[1].passage, passages[1].passage);
});
