import test from 'node:test';
import assert from 'node:assert/strict';
import { listeningKindOf } from './listening-draft.js';
import { exportBaseName, formatOfFileName, parseLrc, parseSubtitles, shiftTimes, timedFormat, timedImportPlan, toLrc, toSrt } from './timed-import.js';

const srt = `1
00:00:12,500 --> 00:00:16,900
<i>First line</i> of the song

2
00:00:17,000 --> 00:00:18,000
[Music]

3
00:00:18,250 --> 00:00:22,849
Second line
continues here [laughs]
`;

const vtt = `WEBVTT

00:01.000 --> 00:03.500 align:start
Man: Where is gate 5?

intro
00:03.600 --> 00:05.000
♪ It's next to the café ♪
`;

const lrc = `[ti:Proud of You]
[ar:Someone]
[offset:+500]
[00:12.50]I [walked] along the road
[00:17.30]And thought of you
[00:23.10]
[00:31.80][01:45.20]A chorus line <00:32.40>sung <00:33.00>twice
`;

test('subtitle files give their cues with start and end', () => {
  assert.equal(timedFormat(srt), 'srt');
  assert.equal(timedFormat(vtt), 'srt');
  assert.equal(timedFormat(lrc), 'lrc');
  assert.equal(timedFormat('just text'), null);
  // Tags, sound notes and music-only cues are left out; lines are joined.
  assert.deepEqual(parseSubtitles(srt), [
    { start: 12.5, end: 16.9, text: 'First line of the song' },
    { start: 18.25, end: 22.849, text: 'Second line continues here' },
  ]);
  assert.deepEqual(parseSubtitles(vtt), [
    { start: 1, end: 3.5, text: 'Man: Where is gate 5?' },
    { start: 3.6, end: 5, text: "It's next to the café" },
  ]);
});

test('lrc lines end where the next one starts, keep their [blanks] and follow the offset', () => {
  assert.deepEqual(parseLrc(lrc, { duration: 200 }), [
    { start: 12, end: 16.8, text: 'I [walked] along the road' },
    { start: 16.8, end: 22.6, text: 'And thought of you' },
    { start: 31.3, end: 104.7, text: 'A chorus line sung twice' },
    { start: 104.7, end: 200, text: 'A chorus line sung twice' },
  ]);
  assert.equal(parseLrc('[00:05.00]Only line').at(-1).end, null);
});

test('an import replaces the sentences with timed ones and is checked first', () => {
  const song = listeningKindOf('song');
  const plan = timedImportPlan([], lrc, song, { duration: 200 });
  assert.equal(plan.count, 4);
  assert.deepEqual(plan.segments.map((item) => [item.text, item.start, item.end]).slice(0, 2), [
    ['I [walked] along the road', 12, 16.8],
    ['And thought of you', 16.8, 22.6],
  ]);
  assert.equal(plan.lines[0].note, ' · 0:12.0–0:16.8');
  // Without the recording's length the last line has no end yet.
  assert.deepEqual(timedImportPlan([], lrc, song).lines.at(-1).warnings, ['no end time: set it in the editor']);

  // A conversation keeps its speakers; times are rounded to tenths.
  const part3 = timedImportPlan([], vtt, listeningKindOf('part3'));
  assert.deepEqual(part3.segments.map((item) => [item.speaker, item.text, item.start, item.end]), [
    ['Man', 'Where is gate 5?', 1, 3.5],
    ['', "It's next to the café", 3.6, 5],
  ]);
  // Part 1 has four sentences: more cues are refused and nothing changes.
  const before = [{ id: 'kept' }];
  const tooMany = timedImportPlan(before, `${srt}\n4\n00:00:30,000 --> 00:00:31,000\nThree\n\n5\n00:00:32,000 --> 00:00:33,000\nFour\n\n6\n00:00:34,000 --> 00:00:35,000\nFive\n`, listeningKindOf('part1'));
  assert.deepEqual([tooMany.segments, tooMany.lines[4].errors], [before, ['Part 1 has 4 sentences']]);
});

test('all times move together and never below 0', () => {
  const segments = [{ start: 0.5, end: 2 }, { start: 2, end: null }];
  assert.deepEqual(shiftTimes(segments, 1.2), [{ start: 1.7, end: 3.2 }, { start: 3.2, end: null }]);
  assert.deepEqual(shiftTimes(segments, -1), [{ start: 0, end: 1 }, { start: 1, end: null }]);
});

test('the sentences are written as .srt and come back the same', () => {
  const song = listeningKindOf('song');
  const segments = [
    { text: 'And thought of [you]', speaker: '', start: 16.8, end: 22.6 },
    { text: 'I [walked] along the road', speaker: '', start: 12, end: 16.8 },
    { text: 'Not timed yet', speaker: '', start: 30, end: null },
  ];
  const file = toSrt(segments, song);
  assert.equal(file.text, '1\n00:00:12,000 --> 00:00:16,800\nI walked along the road\n\n2\n00:00:16,800 --> 00:00:22,600\nAnd thought of you\n');
  assert.deepEqual([file.count, file.skipped], [2, 1]);
  assert.deepEqual(parseSubtitles(file.text).map((cue) => [cue.start, cue.end, cue.text]), [[12, 16.8, 'I walked along the road'], [16.8, 22.6, 'And thought of you']]);

  // Labels and speakers are written and read back.
  const part2 = toSrt([{ text: 'Where is it?', speaker: '', start: 1, end: 2 }, { text: 'In room 3.', speaker: '', start: 2, end: 3 }], listeningKindOf('part2'));
  assert.match(part2.text, /Question: Where is it\?\n\n2\n.*\n\(A\) In room 3\./);
  assert.deepEqual(timedImportPlan([], part2.text, listeningKindOf('part2')).segments.slice(0, 2).map((item) => item.text), ['Where is it?', 'In room 3.']);
  const part3 = toSrt([{ text: 'Hello.', speaker: 'Man', start: 3725.25, end: 3727 }], listeningKindOf('part3'));
  assert.equal(part3.text, '1\n01:02:05,250 --> 01:02:07,000\nMan: Hello.\n');
  assert.deepEqual(timedImportPlan([], part3.text, listeningKindOf('part3')).segments.map((item) => [item.speaker, item.text]), [['Man', 'Hello.']]);
});

test('the sentences are written as .lrc with their blanks and come back the same', () => {
  const song = listeningKindOf('song');
  const segments = [
    { text: 'I [walked] along the road', speaker: '', start: 12, end: 16.8 },
    { text: 'And thought of [you]', speaker: '', start: 16.8, end: 22.6 },
    { text: 'A chorus line', speaker: '', start: 31.3, end: 104.7 },
    { text: 'Not timed', speaker: '', start: null, end: null },
  ];
  const file = toLrc(segments, song, { title: 'Proud of You' });
  // An end is written alone only where the next line does not start then.
  assert.equal(file.text, '[ti:Proud of You]\n[00:12.00]I [walked] along the road\n[00:16.80]And thought of [you]\n[00:22.60]\n[00:31.30]A chorus line\n[01:44.70]\n');
  assert.deepEqual([file.count, file.skipped], [3, 1]);
  assert.deepEqual(
    timedImportPlan([], file.text, song).segments.map((item) => [item.text, item.start, item.end]),
    [['I [walked] along the road', 12, 16.8], ['And thought of [you]', 16.8, 22.6], ['A chorus line', 31.3, 104.7]],
  );
  assert.equal(exportBaseName('Proud of You!'), 'proud-of-you');
  assert.deepEqual(['a.LRC', 'b.srt', 'c'].map(formatOfFileName), ['lrc', 'srt', 'srt']);
});

