import test from 'node:test';
import assert from 'node:assert/strict';
import { manager, otherStudent, student } from './helpers.js';
import { listeningHarness } from './listening-helpers.js';

test('every learner sees the published exercises by topic, with their results', async () => {
  const { service, papers } = listeningHarness();
  await assert.rejects(() => service.listPractice(manager), { code: 26, status: 403 });
  const list = await service.listPractice(student);
  // A topic without a published exercise is left out.
  assert.deepEqual(list.topics.map((topic) => [topic.name, topic.format]), [['TOEIC', 'toeic'], ['Songs', 'song']]);
  assert.deepEqual(list.exercises.map((item) => [item.title, item.segmentCount, item.bestAccuracy, item.checkCount, item.blanks.checkCount]), [
    ['Photo', 4, null, 0, 0],
    ['At the gate', 2, null, 0, 0],
    ['Home', 2, null, 0, 0],
  ]);

  const exercise = await service.getExercise(student, papers[1].exercise.id);
  assert.equal(exercise.audioUrl, 'https://media.test/a.mp3');
  assert.deepEqual(exercise.segments.map((item) => [item.speaker, item.start, item.end]), [['Man', 0, 2], ['Woman', 2, 4]]);
  // The transcript stays hidden until the learner checks.
  assert.equal(JSON.stringify(exercise).includes('café'), false);
  await assert.rejects(() => service.getExercise(student, '99999999-9999-4999-8999-999999999999'), { code: 59, status: 404 });
});

test('a check scores every sentence and keeps the best accuracy', async () => {
  const { service, papers, repository } = listeningHarness();
  const [first, second] = papers[1].content.segments;
  const id = papers[1].exercise.id;
  // 6 tokens each; "a" for "the" is the one mistake, "cafe" for "café" is right.
  const result = await service.check(student, id, { answers: { [first.id]: 'excuse me where is gate five', [second.id]: 'it is next to a cafe' } });
  assert.deepEqual(result.segments.map((item) => item.accuracy), [100, 83]);
  assert.deepEqual(result.segments[1].words.slice(-2), [{ text: 'the', status: 'wrong', typed: 'a' }, { text: 'café.', status: 'correct' }]);
  assert.equal(result.segments[0].text, "Excuse me, where's gate 5?");
  assert.deepEqual([result.accuracy, result.bestAccuracy, result.lastAccuracy, result.checkCount], [92, 92, 92, 1]);

  // A worse check keeps the best; nothing written scores 0.
  const worse = await service.check(student, id, { answers: {} });
  assert.deepEqual([worse.accuracy, worse.bestAccuracy, worse.lastAccuracy, worse.checkCount], [0, 92, 0, 2]);
  assert.equal((await service.listPractice(student)).exercises[1].bestAccuracy, 92);
  assert.equal((await service.listPractice(otherStudent)).exercises[1].checkCount, 0);
  assert.equal(repository.tables.results.length, 1);
});

test('a song is practised line by line or by filling in its blanks, each with its own best (D88)', async () => {
  const { service, papers } = listeningHarness();
  const song = papers[2];
  const id = song.exercise.id;
  // Full mode: no text; blanks mode: the lines with the words in brackets hidden.
  const full = await service.getExercise(student, id);
  assert.deepEqual([full.mode, full.blankCount, full.segments[0].pieces], ['full', 3, undefined]);
  const blanks = await service.getExercise(student, id, { mode: 'blanks' });
  assert.deepEqual(blanks.segments.map((segment) => segment.pieces), [
    [{ text: 'I ' }, { blank: 0 }, { text: ' across an ' }, { blank: 1 }, { text: ' land' }],
    [{ text: 'I knew the pathway like the back of my ' }, { blank: 2 }],
  ]);
  assert.equal(JSON.stringify(blanks).includes('walked'), false);
  // A TOEIC exercise has no blanks.
  await assert.rejects(() => service.getExercise(student, papers[0].exercise.id, { mode: 'blanks' }), { code: 30, status: 400 });

  // Blanks follow the dictation rules: case and punctuation do not count.
  const filled = await service.check(student, id, { mode: 'blanks', answers: { 0: 'Walked', 1: 'empty.', 2: 'head' } });
  assert.deepEqual([filled.mode, filled.accuracy, filled.segments.map((segment) => segment.accuracy)], ['blanks', 67, [100, 0]]);
  assert.deepEqual(filled.segments[1].pieces[1], { blank: 2, answer: 'hand', typed: 'head', correct: false });
  assert.equal(filled.segments[0].text, 'I walked across an empty land');

  // Writing the lines is scored on the lyrics without brackets.
  const lines = await service.check(student, id, { answers: { [song.content.segments[0].id]: 'I walked across an empty land' } });
  assert.deepEqual([lines.mode, lines.segments.map((segment) => segment.accuracy)], ['full', [100, 0]]);
  const listed = (await service.listPractice(student)).exercises[2];
  assert.deepEqual([listed.bestAccuracy, listed.checkCount, listed.blanks.bestAccuracy, listed.blanks.checkCount], [lines.accuracy, 1, 67, 1]);
});

test('a song is checked line by line as the learner goes, without keeping a score (D93)', async () => {
  const { service, papers, repository } = listeningHarness();
  const song = papers[2];
  const [first, second] = song.content.segments;
  const line = await service.checkLine(student, song.exercise.id, { segmentId: first.id, answers: { [first.id]: 'I walked across an empty land' } });
  assert.deepEqual([line.mode, line.segment.id, line.segment.accuracy, line.segment.text], ['full', first.id, 100, 'I walked across an empty land']);
  // Blanks are numbered across the song: the second line holds blank 2.
  const blank = await service.checkLine(student, song.exercise.id, { mode: 'blanks', segmentId: second.id, answers: { 2: 'Hand' } });
  assert.deepEqual(blank.segment.pieces.at(-1), { blank: 2, answer: 'hand', typed: 'Hand', correct: true });
  assert.equal(repository.tables.results.length, 0);
  await assert.rejects(() => service.checkLine(student, song.exercise.id, { segmentId: '99999999-9999-4999-8999-999999999999', answers: {} }), { code: 30 });
  await assert.rejects(() => service.checkLine(manager, song.exercise.id, { segmentId: first.id, answers: {} }), { code: 26 });
});

