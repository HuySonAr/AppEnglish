import test from 'node:test';
import assert from 'node:assert/strict';
import { changedFields, countWords, filterPrompts, statusCounts } from './practice-prompts.js';

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
