import test from 'node:test';
import assert from 'node:assert/strict';
import { ETS_TASK_TIMING } from '@appenglish/content-contracts';
import {
  SpeakingStep,
  answersFor,
  filterStudentSwTests,
  groupIndexAfter,
  lastTakenAt,
  micLevel,
  nextOpenIndex,
  playTimes,
  recommendedWords,
  respondSeconds,
  showsQuestionText,
  speakingPlan,
  writingGroups,
  writingMinutes,
} from './sw-exam.js';

const timing = (task) => ETS_TASK_TIMING[task];
const speaking = [
  { number: 1, task: 'read_aloud', text: 'A', timing: timing('read_aloud') },
  { number: 2, task: 'read_aloud', text: 'B', timing: timing('read_aloud') },
  { number: 3, task: 'describe_picture', imageUrl: 'p', timing: timing('describe_picture') },
  { number: 4, task: 'describe_picture', imageUrl: 'q', timing: timing('describe_picture') },
  ...[0, 1, 2].map((setIndex) => ({ number: 5 + setIndex, task: 'respond_questions', context: 'C', text: 'Q', audioUrl: 'a', setIndex, timing: timing('respond_questions') })),
  ...[0, 1, 2].map((setIndex) => ({ number: 8 + setIndex, task: 'respond_info', info: 'I', text: 'Q', audioUrl: 'a', setIndex, timing: timing('respond_info') })),
  { number: 11, task: 'express_opinion', text: 'O', audioUrl: null, timing: timing('express_opinion') },
];
const kinds = (item) => speakingPlan(item).map((step) => (step.seconds ? `${step.kind}:${step.seconds}` : `${step.kind}x${step.times}`));

test('each Speaking question runs the ETS steps in order', () => {
  assert.deepEqual(kinds(speaking[0]), ['prepare:45', 'record:45']);
  assert.deepEqual(kinds(speaking[2]), ['prepare:45', 'record:30']);
  assert.deepEqual(kinds(speaking[4]), ['listenx1', 'prepare:3', 'record:15']);
  assert.deepEqual(kinds(speaking[6]), ['listenx1', 'prepare:3', 'record:30']);
  assert.deepEqual(kinds(speaking[7]), ['read:45', 'listenx1', 'prepare:3', 'record:15']);
  assert.deepEqual(kinds(speaking[8]), ['listenx1', 'prepare:3', 'record:15']);
  assert.deepEqual(kinds(speaking[9]), ['listenx2', 'prepare:3', 'record:30']);
  assert.deepEqual(kinds(speaking[10]), ['prepare:45', 'record:60']);
  assert.deepEqual(kinds({ ...speaking[10], audioUrl: 'o' }), ['listenx1', 'prepare:45', 'record:60']);
  assert.equal(speakingPlan(speaking[0]).at(-1).kind, SpeakingStep.RECORD);
});

test('answer time and replays follow the position in a set', () => {
  assert.deepEqual(speaking.map(respondSeconds), [45, 45, 30, 30, 15, 15, 30, 15, 15, 30, 60]);
  assert.deepEqual(speaking.map(playTimes), [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1]);
  assert.equal(showsQuestionText(speaking[4]), true);
  assert.equal(showsQuestionText(speaking[8]), false);
  assert.equal(showsQuestionText(speaking[2]), false);
});

test('the test goes on after the last closed question', () => {
  assert.equal(nextOpenIndex(speaking, 0), 0);
  assert.equal(nextOpenIndex(speaking, 4), 4);
  assert.equal(nextOpenIndex(speaking, 11), 11);
});

const writing = [
  ...[1, 2, 3, 4, 5].map((number) => ({ number, task: 'picture_sentence', keywords: ['a', 'b'] })),
  { number: 6, task: 'respond_email' },
  { number: 7, task: 'respond_email' },
  { number: 8, task: 'opinion_essay', text: 'Why?' },
];

test('Writing runs in four timed groups like the real test', () => {
  assert.deepEqual(writingGroups(writing), [
    { numbers: [1, 2, 3, 4, 5], lockThrough: 5, seconds: 480 },
    { numbers: [6], lockThrough: 6, seconds: 600 },
    { numbers: [7], lockThrough: 7, seconds: 600 },
    { numbers: [8], lockThrough: 8, seconds: 1800 },
  ]);
  const groups = writingGroups(writing);
  assert.equal(groupIndexAfter(groups, 0), 0);
  assert.equal(groupIndexAfter(groups, 5), 1);
  assert.equal(groupIndexAfter(groups, 7), 3);
  assert.equal(groupIndexAfter(groups, 8), 4);
  assert.equal(writingMinutes(), 58);
  assert.equal(recommendedWords(writing[7]), 300);
  assert.equal(recommendedWords(writing[0]), 0);
});

test('only the answers of the open group are sent', () => {
  assert.deepEqual(answersFor({ 1: 'One', 6: 'Six', 2: '' }, [1, 2, 3]), { 1: 'One', 2: '', 3: '' });
});

test('the microphone level is read from the waveform', () => {
  assert.equal(micLevel(new Uint8Array([128, 128, 128])), 0);
  assert.equal(micLevel([]), 0);
  assert.ok(micLevel(new Uint8Array([128, 200, 56, 128])) > 0.5);
  assert.equal(micLevel(new Uint8Array([0, 255, 0, 255])), 1);
});

test('learners search, filter and sort the tests', () => {
  const tests = [
    { id: 'a', title: 'Set B', speaking: { attempts: [{ submittedAt: '2026-10-02T00:00:00Z' }] }, writing: { attempts: [] } },
    { id: 'b', title: 'Set A', speaking: { attempts: [] }, writing: { attempts: [{ submittedAt: '2026-10-05T00:00:00Z' }] } },
    { id: 'c', title: 'Other', speaking: { attempts: [] }, writing: { attempts: [] } },
  ];
  const ids = (list) => list.map((test) => test.id);
  assert.equal(lastTakenAt(tests[0]), '2026-10-02T00:00:00Z');
  assert.deepEqual(ids(filterStudentSwTests(tests, {})), ['c', 'b', 'a']);
  assert.deepEqual(ids(filterStudentSwTests(tests, { sort: 'recent' })), ['b', 'a', 'c']);
  assert.deepEqual(ids(filterStudentSwTests(tests, { taken: 'not-taken' })), ['c']);
  assert.deepEqual(ids(filterStudentSwTests(tests, { search: 'set', sort: 'title-desc' })), ['a', 'b']);
});
