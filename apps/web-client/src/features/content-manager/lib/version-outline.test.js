import test from 'node:test';
import assert from 'node:assert/strict';
import { OTHER_DETAILS_CHANGED, outlineChanges, versionOutline } from './version-outline.js';

test('a lesson version is outlined by words, fill-in and test parts', () => {
  const outline = versionOutline('lesson', {
    vocabulary: [{ word: 'ticket', partOfSpeech: 'noun', meaning: 'vé' }],
    fillIn: { passage: 'Show your ___.', answers: ['ticket'] },
    test: { part5: { questions: [{ prompt: 'A _____ sentence.' }] }, part6: { passage: 'Dear ___', questions: [] } },
  });
  assert.equal(outline[0].title, 'Vocabulary: 1 word');
  assert.deepEqual(outline[0].lines, ['ticket (noun) — vé']);
  assert.deepEqual(outline[1], { title: 'Fill-in: 1 blank', lines: ['Show your ___.', 'Answers: ticket'] });
  assert.equal(outline.length, 2 + 7);
  assert.deepEqual(outline[2 + 4], { title: 'Part 5: 1 question', lines: ['A _____ sentence.'] });
  assert.deepEqual(outline[2 + 5], { title: 'Part 6: 0 questions', lines: ['Dear ___'] });
});

test('the other kinds are outlined from what they hold', () => {
  assert.deepEqual(versionOutline('listeningExercise', { audioMediaId: 'x', segments: [{ text: 'Hello.' }] }), [
    { title: 'Recording: yes', lines: [] },
    { title: 'Sentences: 1', lines: ['Hello.'] },
  ]);
  const review = versionOutline('unitReview', { test: { part5: { questions: [] }, part6: { groups: [{ passage: 'P' }], questions: [{}, {}] } } });
  assert.deepEqual(review.map((section) => section.title), ['Part 5: 0 questions', 'Part 6: 2 questions, 1 set']);
  assert.equal(versionOutline('mockTest', { test: {} }).length, 7);
  assert.deepEqual(versionOutline('lesson', null), []);
});

test('a placement version is outlined by its seven parts', () => {
  const outline = versionOutline('placement', { test: { part5: { questions: [{ prompt: 'Pick one.' }] } } });
  assert.equal(outline.length, 7);
  assert.deepEqual(outline[4], { title: 'Part 5: 1 question', lines: ['Pick one.'] });
});

test('changes from the published version list the sections that differ', () => {
  const published = {
    vocabulary: [{ word: 'ticket', partOfSpeech: 'noun', meaning: 'vé' }],
    fillIn: { passage: 'Show your ___.', answers: ['ticket'] },
    test: { part5: { questions: [{ prompt: 'A _____ sentence.', options: [{ isCorrect: true }, { isCorrect: false }] }] } },
  };
  const draft = structuredClone(published);
  assert.deepEqual(outlineChanges('lesson', draft, published), []);
  draft.vocabulary.push({ word: 'gate', partOfSpeech: 'noun', meaning: 'cổng' });
  draft.test.part5.questions[0].options = [{ isCorrect: false }, { isCorrect: true }];
  const changes = outlineChanges('lesson', draft, published);
  assert.deepEqual(changes, [
    { title: 'Vocabulary: 2 words', before: 'Vocabulary: 1 word', added: ['gate (noun) — cổng'], removed: [], other: null },
    { title: 'Part 5: 1 question', before: null, added: [], removed: [], other: OTHER_DETAILS_CHANGED },
  ]);
  assert.deepEqual(outlineChanges('lesson', draft, null), []);
});

test('changed sentences of a listening exercise show what was added and removed', () => {
  const published = { audioMediaId: 'a', segments: [{ text: 'Hello.' }, { text: 'Bye.' }] };
  const draft = { audioMediaId: 'a', segments: [{ text: 'Hello.' }, { text: 'See you.' }] };
  assert.deepEqual(outlineChanges('listeningExercise', draft, published), [
    { title: 'Sentences: 2', before: null, added: ['See you.'], removed: ['Bye.'], other: null },
  ]);
});

test('a Speaking and Writing test is outlined by its eight blocks with the real numbers', () => {
  const outline = versionOutline('swTest', {
    speaking: { readAloud: [{ text: 'Welcome aboard.' }], respondInfo: { info: 'Agenda', questions: [{ text: 'When?', audioMediaId: 'a' }] } },
    writing: { pictureSentences: [{ imageMediaId: 'i', keywords: ['dog', 'park'] }], essay: { question: 'Why?' } },
  });
  assert.equal(outline.length, 8);
  assert.deepEqual(outline[0], { title: 'Speaking 1–2: Read a text aloud', lines: ['Welcome aboard.'] });
  assert.deepEqual(outline[3], { title: 'Speaking 8–10: Respond using information', lines: ['Agenda', 'When?'] });
  assert.equal(outline[4].title, 'Speaking 11: Express an opinion');
  assert.deepEqual(outline[5], { title: 'Writing 1–5: Sentence from a picture', lines: ['dog / park'] });
  assert.deepEqual(outline[7], { title: 'Writing 8: Opinion essay', lines: ['Why?'] });
});

test('changes in a Speaking and Writing test show changed text and changed pictures', () => {
  const published = { speaking: { pictures: [{ imageMediaId: 'p1' }], opinion: { text: 'Agree?' } }, writing: {} };
  const draft = { speaking: { pictures: [{ imageMediaId: 'p2' }], opinion: { text: 'Do you agree?' } }, writing: {} };
  assert.deepEqual(outlineChanges('swTest', published, structuredClone(published)), []);
  assert.deepEqual(outlineChanges('swTest', draft, published), [
    { title: 'Speaking 3–4: Describe a picture', before: null, added: [], removed: [], other: OTHER_DETAILS_CHANGED },
    { title: 'Speaking 11: Express an opinion', before: null, added: ['Do you agree?'], removed: ['Agree?'], other: null },
  ]);
});
