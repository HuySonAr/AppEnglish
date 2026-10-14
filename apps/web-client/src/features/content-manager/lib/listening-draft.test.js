import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSeconds,
  listeningPastePlan,
  listeningIssueLabel,
  listeningKindOf,
  parseSeconds,
  segmentsFromText,
  withEnd,
  workingListening,
} from './listening-draft.js';

test('times are written m:ss.s and read in either form', () => {
  assert.deepEqual([0, 9.95, 62.5, 600].map(formatSeconds), ['0:00.0', '0:10.0', '1:02.5', '10:00.0']);
  assert.equal(formatSeconds(null), '');
  assert.deepEqual(['', '62.5', '1:02.5', '1:02', ' 3 '].map(parseSeconds), [null, 62.5, 62.5, 62, 3]);
  assert.ok(['abc', '1:75', '-2'].every((text) => Number.isNaN(parseSeconds(text))));
});

test('a pasted transcript becomes sentences', () => {
  const part3 = segmentsFromText('Man: Where is gate 5?\n\nW: Next to the café.\nThank you.', listeningKindOf('part3'));
  assert.deepEqual(part3.map((item) => [item.speaker, item.text]), [['Man', 'Where is gate 5?'], ['W', 'Next to the café.'], ['', 'Thank you.']]);
  const part2 = segmentsFromText('Question: Where is the meeting?\n(A) In room 3.\nB. At noon.\nC) Yes.', listeningKindOf('part2'));
  assert.deepEqual(part2.map((item) => [item.speaker, item.text]), [['', 'Where is the meeting?'], ['', 'In room 3.'], ['', 'At noon.'], ['', 'Yes.']]);
});

test('the editor starts from the draft and keeps four sentences in Parts 1 and 2', () => {
  assert.equal(workingListening({ draft: null, published: null }, 'part1').segments.length, 4);
  assert.equal(workingListening({ draft: null, published: null }, 'part3').segments.length, 0);
  const data = { draft: { content: { audioMediaId: 'a', segments: [{ id: 's1', speaker: 'Man', text: 'Hi.', start: 0, end: 1 }] } } };
  assert.deepEqual(workingListening(data, 'part4'), { audioMediaId: 'a', segments: [{ id: 's1', speaker: 'Man', text: 'Hi.', start: 0, end: 1 }] });
});

test('setting an end starts the next sentence there, and issues are named', () => {
  const segments = [{ start: 0, end: null }, { start: null, end: null }, { start: 9, end: null }];
  assert.deepEqual(withEnd(segments, 0, 2.5), [{ start: 0, end: 2.5 }, { start: 2.5, end: null }, { start: 9, end: null }]);
  assert.deepEqual(withEnd(segments, 1, 8).at(-1), { start: 9, end: null });
  assert.equal(listeningIssueLabel('segments[1].text', listeningKindOf('part2')), '(A) · text');
  assert.equal(listeningIssueLabel('segments[4].start', listeningKindOf('part3')), 'Sentence 5 · start');
  assert.equal(listeningIssueLabel('audioMediaId', listeningKindOf('part3')), 'Recording');
});

test('a pasted transcript replaces the sentences and keeps their times', () => {
  const part3 = listeningKindOf('part3');
  const before = [{ id: 'a', speaker: '', text: 'Old.', start: 1, end: 2 }];
  const plan = listeningPastePlan(before, 'Man: Hello.\nWoman: Hi there.', part3);
  assert.deepEqual(plan.segments.map((item) => [item.speaker, item.text, item.start, item.end]), [['Man', 'Hello.', 1, 2], ['Woman', 'Hi there.', null, null]]);
  assert.deepEqual(plan.lines.map((line) => line.note), [' · Man · keeps its times', ' · Woman']);
  // Part 1 has four sentences: a fifth is refused, three are padded with an empty one.
  const part1 = listeningKindOf('part1');
  const five = listeningPastePlan([], 'A\nB\nC\nD\nE', part1);
  assert.deepEqual([five.segments, five.lines[4].errors], [[], ['Part 1 has 4 sentences']]);
  const three = listeningPastePlan([], '(A) One.\n(B) Two.\n(C) Three.', part1);
  assert.deepEqual([three.segments.map((item) => item.text), three.lines[0].warnings], [['One.', 'Two.', 'Three.', ''], ['3 of 4 sentences']]);
});

test('song lines are kept whole and named as lines', () => {
  const song = listeningKindOf('song');
  const lines = segmentsFromText('Chorus: I [walked] home\nAnd [stayed]', song);
  assert.deepEqual(lines.map((item) => [item.speaker, item.text]), [['', 'Chorus: I [walked] home'], ['', 'And [stayed]']]);
  assert.equal(listeningIssueLabel('segments[1].text', song), 'Line 2 · text');
});

