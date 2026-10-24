import test from 'node:test';
import assert from 'node:assert/strict';
import { authorOptions, changedFields, countWords, filterPrompts, kindFromSlug, reviewAreaOf, reviewPromptPath, statusCounts, teacherListPath, teacherPromptPath } from './practice-prompts.js';

test('words are counted and changed fields are named for the reviewer', () => {
  assert.deepEqual([countWords(''), countWords('  one  two\nthree ')], [0, 3]);
  const before = { title: 'A', level: 'A2', topic: 'Work', keyPoints: ['a'] };
  assert.deepEqual(changedFields(before, { ...before, title: 'B', keyPoints: ['a', 'b'] }), ['Title', 'Key points']);
  assert.deepEqual(changedFields(null, before), []);
});

test('prompts are searched, filtered and counted by status', () => {
  const prompts = [
    { kind: 'writing', level: 'A2', status: 'PENDING_REVIEW', title: 'Email to a manager', topic: 'Work', publishedVersionNumber: null },
    { kind: 'read_aloud', level: 'B1', status: 'PUBLISHED', title: 'At the station', topic: 'Travel', publishedVersionNumber: 1 },
    { kind: 'writing', level: 'B1', status: 'DRAFT', title: 'My town', topic: 'Places', publishedVersionNumber: 2 },
  ];
  assert.equal(filterPrompts(prompts, { kind: 'writing' }).length, 2);
  assert.equal(filterPrompts(prompts, { level: 'B1', status: 'PUBLISHED' })[0].title, 'At the station');
  assert.equal(filterPrompts(prompts, { search: 'travel' })[0].title, 'At the station');
  assert.deepEqual(statusCounts(prompts), { DRAFT: 1, PENDING_REVIEW: 1, RETURNED: 0, PUBLISHED: 1 });
});

test('each prompt kind has its own teacher page', () => {
  assert.equal(teacherListPath('open_speaking'), '/teacher/open-speaking');
  assert.equal(teacherPromptPath('read_aloud', 'p1'), '/teacher/read-aloud/p1');
  assert.deepEqual(['writing', 'read-aloud', 'nope'].map(kindFromSlug), ['writing', 'read_aloud', null]);
});

test('the content manager reviews speaking and writing apart and can pick a teacher', () => {
  assert.deepEqual(['read_aloud', 'open_speaking', 'writing'].map(reviewAreaOf), ['speaking', 'speaking', 'writing']);
  assert.equal(reviewPromptPath('open_speaking', 'p1'), '/content-manager/speaking-prompts/p1');
  assert.equal(reviewPromptPath('writing', 'p2'), '/content-manager/writing-prompts/p2');
  const options = authorOptions([
    { authorId: 't2', author: { displayName: 'Mai' } },
    { authorId: 't1', author: { displayName: 'An' } },
    { authorId: 't2', author: { displayName: 'Mai' } },
    { authorId: 't3' },
  ]);
  assert.deepEqual(options.map((option) => option.label), ['All teachers', 'An', 'Mai', 'Unknown teacher']);
});
