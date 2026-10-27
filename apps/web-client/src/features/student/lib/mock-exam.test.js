import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SectionTrend,
  answerSeconds,
  isPracticeSet,
  listeningClosed,
  listeningItems,
  overallSectionTrend,
  readingParts,
  resumeIndex,
  sectionTrendLabel,
  withMargin,
} from './mock-exam.js';

const question = (id, groupId = null, audioUrl = null) => ({ id, groupId, audioUrl, options: [] });
const parts = [
  { key: 'part1', number: 1, title: 'Photographs', skill: 'LISTENING', groups: [], questions: [question('a', null, '/a.mp3'), question('b', null, '/b.mp3')] },
  { key: 'part2', number: 2, title: 'Question-Response', skill: 'LISTENING', groups: [], questions: [question('c', null, '/c.mp3')] },
  {
    key: 'part3',
    number: 3,
    title: 'Conversations',
    skill: 'LISTENING',
    groups: [
      { id: 'g1', audioUrl: '/g1.mp3', imageUrl: null },
      { id: 'g2', audioUrl: '/g2.mp3', imageUrl: '/chart.png' },
    ],
    questions: [question('d', 'g1'), question('e', 'g1'), question('f', 'g1'), question('g', 'g2'), question('h', 'g2'), question('i', 'g2')],
  },
  { key: 'part4', number: 4, title: 'Talks', skill: 'LISTENING', groups: [{ id: 'g3', audioUrl: '/g3.mp3', imageUrl: null }], questions: [question('j', 'g3'), question('k', 'g3'), question('l', 'g3')] },
  { key: 'part5', number: 5, title: 'Incomplete Sentences', skill: 'READING', groups: [], questions: [question('m')] },
];

test('listening items follow Part 1 and 2 questions, then Part 3 and 4 groups', () => {
  const items = listeningItems(parts);
  assert.deepEqual(items.map((item) => item.id), ['a', 'b', 'c', 'g1', 'g2', 'g3']);
  assert.deepEqual(items.map((item) => item.index), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(items[3].questions.map((item) => item.id), ['d', 'e', 'f']);
  assert.equal(items[4].imageUrl, '/chart.png');
  assert.equal(items[0].audioUrl, '/a.mp3');
  assert.equal(items[5].audioUrl, '/g3.mp3');
});

test('groups without questions are skipped and a part without groups lists its questions', () => {
  const items = listeningItems([{ ...parts[2], groups: [...parts[2].groups, { id: 'empty', audioUrl: '/x.mp3' }] }, { ...parts[3], groups: [] }]);
  assert.deepEqual(items.map((item) => item.id), ['g1', 'g2', 'j', 'k', 'l']);
});

test('answer time is 5 seconds per question in Part 1 and 2 and 8 in Part 3 and 4', () => {
  const items = listeningItems(parts);
  assert.equal(answerSeconds(items[0]), 5);
  assert.equal(answerSeconds(items[2]), 5);
  assert.equal(answerSeconds(items[3]), 24);
  assert.equal(answerSeconds(items[5]), 24);
});

test('the resume index stays inside the listening items', () => {
  assert.equal(resumeIndex(0, 6), 0);
  assert.equal(resumeIndex(4, 6), 4);
  assert.equal(resumeIndex(9, 6), 6);
  assert.equal(resumeIndex(-2, 6), 0);
  assert.equal(resumeIndex(null, 6), 0);
});

test('reading parts keep only Part 5 to 7', () => {
  assert.deepEqual(readingParts(parts).map((part) => part.key), ['part5']);
});

test('listening closes at the server time', () => {
  const closesAt = '2026-10-26T10:00:00.000Z';
  const at = new Date(closesAt).getTime();
  assert.equal(listeningClosed(closesAt, 0, at - 1000), false);
  assert.equal(listeningClosed(closesAt, 0, at), true);
  assert.equal(listeningClosed(closesAt, 2000, at - 1000), true);
  assert.equal(listeningClosed(null, 0, at), false);
});

test('practice sets, margins and section trends', () => {
  assert.equal(isPracticeSet({ format: 'practice' }), true);
  assert.equal(isPracticeSet({ format: 'full' }), false);
  assert.equal(isPracticeSet(null), false);
  assert.equal(withMargin(400), '400 ±25');
  assert.equal(withMargin(400, 30), '400 ±30');
  assert.equal(sectionTrendLabel('up'), 'Up');
  assert.equal(sectionTrendLabel('down'), 'Down');
  assert.equal(sectionTrendLabel('same'), 'About the same');
  assert.equal(sectionTrendLabel(undefined), null);
  assert.equal(overallSectionTrend(null), null);
  assert.equal(overallSectionTrend({ listeningTrend: 'up', readingTrend: 'same' }), SectionTrend.UP);
  assert.equal(overallSectionTrend({ listeningTrend: 'same', readingTrend: 'down' }), SectionTrend.DOWN);
  assert.equal(overallSectionTrend({ listeningTrend: 'up', readingTrend: 'down' }), SectionTrend.SAME);
  assert.equal(overallSectionTrend({ trend: 'IMPROVED' }), null);
});
