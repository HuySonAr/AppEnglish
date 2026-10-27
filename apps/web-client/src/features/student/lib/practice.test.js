import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPracticeLevel, filterPracticePrompts, formatClock, levelCounts, isScoring, recordingType, scoreTone, practiceTopicOptions, wordCounts } from './practice.js';

const prompts = [
  { id: '1', title: 'Train times', level: 'A2', topic: 'Travel', attempts: 2, bestTotal: 7.5, lastSubmittedAt: '2026-10-22T08:00:00Z' },
  { id: '2', title: 'At the bank', level: 'B1', topic: 'Money', attempts: 0, bestTotal: null, lastSubmittedAt: null },
  { id: '3', title: 'Airport', level: 'A1', topic: 'Travel', attempts: 1, bestTotal: 4, lastSubmittedAt: '2026-10-23T08:00:00Z' },
];

test('speaking prompts are filtered by level, topic and tried, and sorted', () => {
  const ids = (options) => filterPracticePrompts(prompts, options).map((prompt) => prompt.id);
  assert.deepEqual(ids({}), ['3', '1', '2']);
  assert.deepEqual(ids({ level: 'basic' }), ['3', '1']);
  assert.deepEqual(ids({ level: 'intermediate' }), ['2']);
  assert.deepEqual(ids({ topic: 'Travel', sort: 'title' }), ['3', '1']);
  assert.deepEqual(ids({ tried: 'new' }), ['2']);
  assert.deepEqual(ids({ tried: 'tried', sort: 'best' }), ['3', '1']);
  assert.deepEqual(ids({ sort: 'recent' }), ['3', '1', '2']);
  assert.deepEqual(ids({ search: 'bank' }), ['2']);
  assert.deepEqual(ids({ search: 'money' }), ['2']);
  assert.deepEqual(filterPracticePrompts([{ id: 'r', kind: 'read_aloud', title: 'a', topic: '' }, { id: 'o', kind: 'open_speaking', title: 'b', topic: '' }], { kind: 'open_speaking' }).map((prompt) => prompt.id), ['o']);
  assert.deepEqual(practiceTopicOptions(prompts).map((option) => option.value), ['all', 'Money', 'Travel']);
});

test('scores, words and recording helpers', () => {
  assert.deepEqual([9, 8, 6.4, 4.9, null].map((value) => scoreTone(value)), ['success', 'success', 'warning', 'destructive', 'muted']);
  assert.deepEqual([4, 3.6, 2.4].map((value) => scoreTone(value, 5)), ['success', 'warning', 'destructive']);
  assert.deepEqual(wordCounts([{ status: 'correct' }, { status: 'missing' }, { status: 'correct' }, { status: null }]), { correct: 2, mispronounced: 0, missing: 1 });
  assert.equal(recordingType((type) => type === 'audio/mp4'), 'audio/mp4');
  assert.equal(recordingType(() => false), '');
  assert.deepEqual([0, 7.9, 30, 75].map(formatClock), ['0:00', '0:07', '0:30', '1:15']);
  assert.equal(isScoring({ status: 'SCORING' }), true);
  assert.equal(isScoring({ status: 'DONE' }), false);
});

test('the list opens on a level that has prompts', () => {
  const at = (...levels) => levels.map((level) => ({ level }));
  assert.deepEqual(levelCounts(at('advanced', 'basic', 'advanced', 'B1')), [{ level: 'basic', count: 1 }, { level: 'intermediate', count: 1 }, { level: 'advanced', count: 2 }]);
  assert.equal(defaultPracticeLevel(at('basic', 'intermediate')), 'intermediate');
  assert.equal(defaultPracticeLevel(at('basic', 'advanced')), 'basic');
  assert.equal(defaultPracticeLevel(at('C1')), 'advanced');
  assert.equal(defaultPracticeLevel([]), 'all');
});

test('practice prompts are filtered by task type', () => {
  const typed = [
    { id: 'a', title: 'A', level: 'A2', topic: 'Work', etsTask: 'describe_picture', attempts: 0 },
    { id: 'b', title: 'B', level: 'A2', topic: 'Work', etsTask: null, attempts: 0 },
  ];
  assert.deepEqual(filterPracticePrompts(typed, { etsTask: 'describe_picture' }).map((prompt) => prompt.id), ['a']);
  assert.deepEqual(filterPracticePrompts(typed, { etsTask: 'none' }).map((prompt) => prompt.id), ['b']);
});
