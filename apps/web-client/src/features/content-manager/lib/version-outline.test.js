import test from 'node:test';
import assert from 'node:assert/strict';
import { versionOutline } from './version-outline.js';

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
  const topic = versionOutline('courseItem', {
    audioMediaId: 'a',
    segments: [{ text: 'Hi.', translation: 'x' }, { text: 'Bye.', translation: '' }],
    vocabulary: [{ word: 'coffee' }],
    questions: [{ prompt: 'What does she want?' }],
    ordering: { enabled: true, items: [{}, {}, {}] },
  });
  assert.deepEqual(topic, [
    { title: 'Recording: yes', lines: [] },
    { title: 'Sentences: 2', lines: ['Hi.', 'Bye.'] },
    { title: 'Words: 1', lines: ['coffee'] },
    { title: 'Questions: 1', lines: ['What does she want?'] },
    { title: 'Ordering: 3 ideas', lines: [] },
    { title: 'Translated sentences: 1', lines: [] },
  ]);
  assert.deepEqual(versionOutline('courseItem', { sections: [{ questions: [1, 2] }] }), [{ title: 'Recordings: 1', lines: ['Recording 1: 2 questions'] }]);
  assert.deepEqual(versionOutline('courseItem', { sections: [] }), [{ title: 'Recordings: 0', lines: [] }]);
  const review = versionOutline('unitReview', { test: { part5: { questions: [] }, part6: { groups: [{ passage: 'P' }], questions: [{}, {}] } } });
  assert.deepEqual(review.map((section) => section.title), ['Part 5: 0 questions', 'Part 6: 2 questions, 1 set']);
  assert.equal(versionOutline('mockTest', { test: {} }).length, 7);
  assert.deepEqual(versionOutline('lesson', null), []);
});
