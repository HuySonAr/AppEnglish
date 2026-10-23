import test from 'node:test';
import assert from 'node:assert/strict';
import { answeredCount, formatRemaining, numberBlanks, partSections, remainingTime } from './placement.js';

test('remaining time is shown as minutes and seconds', () => {
  assert.equal(formatRemaining(25 * 60 * 1000), '25:00');
  assert.equal(formatRemaining(61 * 1000), '01:01');
  assert.equal(formatRemaining(900), '00:01');
  assert.equal(formatRemaining(0), '00:00');
  assert.equal(formatRemaining(-5000), '00:00');
});

test('remaining time follows the server clock', () => {
  const expiresAt = '2026-10-10T08:25:00.000Z';
  const serverNow = Date.parse('2026-10-10T08:10:00.000Z');
  const browserNow = serverNow + 60 * 60 * 1000;
  const offset = serverNow - browserNow;
  assert.equal(remainingTime(expiresAt, offset, browserNow), 15 * 60 * 1000);
  assert.equal(remainingTime(expiresAt, offset, browserNow + 60 * 1000), 14 * 60 * 1000);
});

test('blanks in a passage carry their question numbers', () => {
  assert.equal(numberBlanks('Dear ___, your ___ is at the ___.', 16), 'Dear (16) ___, your (17) ___ is at the (18) ___.');
  assert.equal(numberBlanks('No blank.', 16), 'No blank.');
});

test('answered questions are counted', () => {
  const parts = [{ questions: [{ id: 'a' }, { id: 'b' }] }, { questions: [{ id: 'c' }] }];
  assert.equal(answeredCount(parts, { a: 'x', c: 'y', other: 'z' }), 2);
  assert.equal(answeredCount(parts, {}), 0);
});

test('a part is shown as one section, or one per passage group', () => {
  const lessonPart = { key: 'part6', passage: 'Dear ___.', imageUrl: null, groups: [], questions: [{ id: 'a', prompt: '' }] };
  assert.deepEqual(partSections(lessonPart), [{ id: 'part6', audioUrl: null, transcript: '', passage: 'Dear ___.', imageUrl: null, questions: lessonPart.questions, blanks: true }]);
  const mockPart = {
    key: 'part7', passage: '', imageUrl: null,
    groups: [{ id: 'g1', passage: 'NOTICE', imageUrl: 'https://x/p.png' }, { id: 'g2', passage: 'A ___ memo.', imageUrl: null }],
    questions: [{ id: 'a', groupId: 'g1', prompt: 'Why?' }, { id: 'b', groupId: 'g2', prompt: '' }, { id: 'c', groupId: 'g1', prompt: 'When?' }],
  };
  const sections = partSections(mockPart);
  assert.deepEqual(sections.map((section) => [section.id, section.questions.map((question) => question.id), section.blanks]), [['g1', ['a', 'c'], false], ['g2', ['b'], true]]);
  assert.equal(sections[0].imageUrl, 'https://x/p.png');
  const spoken = partSections({ key: 'part3', passage: '', groups: [{ id: 'g', audioUrl: 'https://x/a.mp3', transcript: 'T', passage: '' }], questions: [{ id: 'a', groupId: 'g', prompt: 'Why?' }] });
  assert.deepEqual([spoken[0].audioUrl, spoken[0].transcript, spoken[0].blanks], ['https://x/a.mp3', 'T', false]);
  assert.equal(partSections({ key: 'part5', passage: '', imageUrl: null, questions: [{ id: 'a', prompt: 'x' }] })[0].blanks, false);
});

