import test from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadPending,
  emptyContent,
  issueLabel,
  issueLocation,
  lessonState,
  normalizeContent,
  setIn,
  withCorrectOption,
  withFillInPassage,
  workingContent,
} from './lesson-draft.js';

test('an empty lesson has the seven parts with 23 questions and fixed options', () => {
  const { test: parts, vocabulary, fillIn } = emptyContent();
  assert.deepEqual(vocabulary, []);
  assert.deepEqual(fillIn, { passage: '', answers: [] });
  assert.deepEqual(
    Object.entries(parts).map(([key, part]) => [key, part.questions.length, part.questions[0].options.length]),
    [['part1', 1, 4], ['part2', 2, 3], ['part3', 3, 4], ['part4', 3, 4], ['part5', 6, 4], ['part6', 3, 4], ['part7', 5, 4]],
  );
  const questions = Object.values(parts).flatMap((part) => part.questions);
  assert.equal(questions.length, 23);
  assert.equal(new Set(questions.map((question) => question.id)).size, 23);
  assert.equal(questions.some((question) => question.options.some((option) => option.isCorrect)), false);
});

test('normalizing keeps saved items and fills in what is missing', () => {
  const saved = {
    vocabulary: [{ id: 'v1', word: 'ticket' }],
    fillIn: { passage: 'A ___ and a ___.', answers: ['ticket'] },
    test: { part2: { questions: [{ id: 'q1', transcript: 'Where?', options: [{ id: 'o1', transcript: 'Here.', isCorrect: true }] }] } },
  };
  const content = normalizeContent(saved);
  assert.equal(content.vocabulary[0].id, 'v1');
  assert.equal(content.vocabulary[0].phonetic, '');
  assert.equal(content.vocabulary[0].audioUkMediaId, null);
  assert.deepEqual(content.fillIn.answers, ['ticket', '']);
  const [first, second] = content.test.part2.questions;
  assert.equal(first.id, 'q1');
  assert.equal(first.options.length, 3);
  assert.deepEqual(first.options[0], { id: 'o1', text: '', audioMediaId: null, transcript: 'Here.', isCorrect: true });
  assert.equal(second.options.length, 3);
  assert.equal(content.test.part7.questions.length, 5);
});

test('fill-in answers follow the number of blanks in the passage', () => {
  let fillIn = withFillInPassage({ passage: '', answers: [] }, 'One ___ two ___.');
  assert.deepEqual(fillIn.answers, ['', '']);
  fillIn = { ...fillIn, answers: ['ticket', 'platform'] };
  assert.deepEqual(withFillInPassage(fillIn, 'One ___ two ___ three ___.').answers, ['ticket', 'platform', '']);
  assert.deepEqual(withFillInPassage(fillIn, 'One ___ only.').answers, ['ticket']);
});

test('choosing a correct option clears the previous one', () => {
  let question = emptyContent().test.part5.questions[0];
  question = withCorrectOption(question, question.options[0].id);
  question = withCorrectOption(question, question.options[2].id);
  assert.deepEqual(question.options.map((option) => option.isCorrect), [false, false, true, false]);
});

test('setIn replaces one nested value without mutating the original', () => {
  const content = emptyContent();
  const next = setIn(content, ['test', 'part1', 'questions', 0, 'options', 1, 'transcript'], 'A man is reading.');
  assert.equal(next.test.part1.questions[0].options[1].transcript, 'A man is reading.');
  assert.equal(content.test.part1.questions[0].options[1].transcript, '');
  assert.equal(next.test.part2, content.test.part2);
  assert.equal(Array.isArray(next.test.part1.questions), true);
});

test('the editor works on the draft, else on a copy of the published version', () => {
  const published = { versionNumber: 1, content: { vocabulary: [{ id: 'a', word: 'ticket' }] } };
  const draft = { versionNumber: 2, content: { vocabulary: [] } };
  assert.equal(workingContent({ draft, published }).vocabulary.length, 0);
  const copy = workingContent({ draft: null, published });
  assert.equal(copy.vocabulary[0].word, 'ticket');
  copy.vocabulary[0].word = 'changed';
  assert.equal(published.content.vocabulary[0].word, 'ticket');
  assert.equal(workingContent(null).test.part5.questions.length, 6);
  assert.deepEqual(lessonState({ draft, published }), { hasDraft: true, draftVersion: 2, publishedVersion: 1 });
  assert.deepEqual(lessonState({ draft: null, published: null }), { hasDraft: false, draftVersion: null, publishedVersion: null });
});

test('publish issue paths become readable labels and locations', () => {
  assert.equal(issueLabel('vocabulary'), 'Vocabulary');
  assert.equal(issueLabel('vocabulary[0].audioUkMediaId'), 'Word 1 · UK audio');
  assert.equal(issueLabel('vocabulary[2].exampleMeaning'), 'Word 3 · example meaning');
  assert.equal(issueLabel('fillIn.passage'), 'Fill-in · passage');
  assert.equal(issueLabel('fillIn.answers[1]'), 'Fill-in · blank 2');
  assert.equal(issueLabel('test.part3.transcript'), 'Part 3 · transcript');
  assert.equal(issueLabel('test.part7.questions'), 'Part 7 · questions');
  assert.equal(issueLabel('test.part1.questions[0].options[1].audioMediaId'), 'Part 1 · question 1 · option B · audio');
  assert.equal(issueLabel('test.part5.questions[5].options'), 'Part 5 · question 15 · options');
  assert.equal(issueLabel('test.part7.questions[4].prompt'), 'Part 7 · question 23 · prompt');
  assert.deepEqual(issueLocation('fillIn.answers[0]'), { tab: 'fillIn' });
  assert.deepEqual(issueLocation('test.part4.questions[0].prompt'), { tab: 'test', part: 'part4' });
  assert.deepEqual(issueLocation('vocabulary[0].word'), { tab: 'vocabulary' });
  assert.deepEqual(issueLocation('content'), { tab: 'vocabulary' });
});

test('pending files are uploaded on save and only when still used', async () => {
  const content = { vocabulary: [{ audioUkMediaId: 'temp-1', audioUsMediaId: 'saved-9' }], test: { part1: { audioMediaId: 'temp-2' } } };
  const pending = {
    'temp-1': { kind: 'audio', file: { name: 'uk.mp3' } },
    'temp-removed': { kind: 'image', file: { name: 'old.png' } },
    'temp-2': { kind: 'audio', file: { name: 'part1.mp4' } },
  };
  const calls = [];
  const upload = async ({ kind, file }) => {
    calls.push(`${kind}:${file.name}`);
    return { id: `real-${calls.length}`, fileName: file.name };
  };
  const result = await uploadPending(content, pending, upload);
  assert.deepEqual(calls, ['audio:uk.mp3', 'audio:part1.mp4']);
  assert.equal(result.error, null);
  assert.deepEqual(result.content, { vocabulary: [{ audioUkMediaId: 'real-1', audioUsMediaId: 'saved-9' }], test: { part1: { audioMediaId: 'real-2' } } });
  assert.deepEqual(Object.keys(result.uploaded), ['temp-1', 'temp-2']);
  assert.equal(content.vocabulary[0].audioUkMediaId, 'temp-1');

  // A failure keeps what was already uploaded so a retry skips it.
  const failing = await uploadPending(content, pending, async ({ kind, file }) => {
    if (file.name === 'part1.mp4') throw new Error('too large');
    return { id: 'real-uk', fileName: file.name };
  });
  assert.equal(failing.error.message, 'too large');
  assert.equal(failing.content.vocabulary[0].audioUkMediaId, 'real-uk');
  assert.equal(failing.content.test.part1.audioMediaId, 'temp-2');
  assert.deepEqual(Object.keys(failing.uploaded), ['temp-1']);
});
