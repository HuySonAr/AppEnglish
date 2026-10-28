import test from 'node:test';
import assert from 'node:assert/strict';
import { manager, otherStudent, student } from './helpers.js';
import { listeningHarness } from './listening-helpers.js';

test('every learner sees the published exercises by topic, with their results', async () => {
  const { service, papers } = listeningHarness();
  await assert.rejects(() => service.listPractice(manager), { code: 26, status: 403 });
  const list = await service.listPractice(student);
  assert.deepEqual(list.topics.map((topic) => [topic.name, topic.format, topic.level]), [['TOEIC', 'toeic', 'basic']]);
  assert.deepEqual(list.tests.map((test) => test.name), ['Test 1']);
  assert.equal(list.exercises[0].test.name, 'Test 1');
  assert.deepEqual(list.exercises.map((item) => [item.title, item.segmentCount, item.bestAccuracy, item.checkCount, item.hide30.checkCount]), [
    ['Photo', 4, null, 0, 0],
    ['At the gate', 2, null, 0, 0],
  ]);

  const exercise = await service.getExercise(student, papers[1].exercise.id);
  assert.equal(exercise.audioUrl, 'https://media.test/a.mp3');
  assert.deepEqual(exercise.segments.map((item) => [item.speaker, item.start, item.end]), [['Man', 0, 2], ['Woman', 2, 4]]);
  assert.equal(JSON.stringify(exercise).includes('café'), false);
  await assert.rejects(() => service.getExercise(student, '99999999-9999-4999-8999-999999999999'), { code: 59, status: 404 });
});

test('a check scores every sentence and keeps the best accuracy', async () => {
  const { service, papers, repository } = listeningHarness();
  const [first, second] = papers[1].content.segments;
  const id = papers[1].exercise.id;
  const result = await service.check(student, id, { answers: { [first.id]: 'excuse me where is gate five', [second.id]: 'it is next to a cafe' } });
  assert.deepEqual(result.segments.map((item) => item.accuracy), [100, 83]);
  assert.deepEqual(result.segments[1].words.slice(-2), [{ text: 'the', status: 'wrong', typed: 'a' }, { text: 'café.', status: 'correct' }]);
  assert.equal(result.segments[0].text, "Excuse me, where's gate 5?");
  assert.deepEqual([result.accuracy, result.bestAccuracy, result.lastAccuracy, result.checkCount], [92, 92, 92, 1]);

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
  const full = await service.getExercise(student, id);
  assert.deepEqual([full.mode, full.blankCount, full.segments[0].pieces], ['full', 3, undefined]);
  const blanks = await service.getExercise(student, id, { mode: 'blanks' });
  assert.deepEqual(blanks.segments.map((segment) => segment.pieces), [
    [{ text: 'I ' }, { blank: 0 }, { text: ' across an ' }, { blank: 1 }, { text: ' land' }],
    [{ text: 'I knew the pathway like the back of my ' }, { blank: 2 }],
  ]);
  assert.equal(JSON.stringify(blanks).includes('walked'), false);
  await assert.rejects(() => service.getExercise(student, papers[0].exercise.id, { mode: 'blanks' }), { code: 30, status: 400 });

  const filled = await service.check(student, id, { mode: 'blanks', answers: { 0: 'Walked', 1: 'empty.', 2: 'head' } });
  assert.deepEqual([filled.mode, filled.accuracy, filled.segments.map((segment) => segment.accuracy)], ['blanks', 67, [100, 0]]);
  assert.deepEqual(filled.segments[1].pieces[1], { blank: 2, answer: 'hand', typed: 'head', correct: false });
  assert.equal(filled.segments[0].text, 'I walked across an empty land');

  const lines = await service.check(student, id, { answers: { [song.content.segments[0].id]: 'I walked across an empty land' } });
  assert.deepEqual([lines.mode, lines.segments.map((segment) => segment.accuracy)], ['full', [100, 0]]);
  const listed = await service.getExercise(student, id);
  assert.deepEqual([listed.bestAccuracy, listed.checkCount, listed.blanks.bestAccuracy, listed.blanks.checkCount], [lines.accuracy, 1, 67, 1]);
});

test('a song is checked line by line as the learner goes, without keeping a score (D93)', async () => {
  const { service, papers, repository } = listeningHarness();
  const song = papers[2];
  const [first, second] = song.content.segments;
  const line = await service.checkLine(student, song.exercise.id, { segmentId: first.id, answers: { [first.id]: 'I walked across an empty land' } });
  assert.deepEqual([line.mode, line.segment.id, line.segment.accuracy, line.segment.text], ['full', first.id, 100, 'I walked across an empty land']);
  const blank = await service.checkLine(student, song.exercise.id, { mode: 'blanks', segmentId: second.id, answers: { 2: 'Hand' } });
  assert.deepEqual(blank.segment.pieces.at(-1), { blank: 2, answer: 'hand', typed: 'Hand', correct: true });
  assert.equal(repository.tables.results.length, 0);
  await assert.rejects(() => service.checkLine(student, song.exercise.id, { segmentId: '99999999-9999-4999-8999-999999999999', answers: {} }), { code: 30 });
  await assert.rejects(() => service.checkLine(manager, song.exercise.id, { segmentId: first.id, answers: {} }), { code: 26 });
});

test('the full transcript comes with the translations; song brackets are removed (D157)', async () => {
  const { service, papers } = listeningHarness();
  papers[1].content.segments[0].translation = 'Xin lỗi, cổng 5 ở đâu?';
  const conversation = await service.getTranscript(student, papers[1].exercise.id);
  assert.deepEqual(conversation.segments.map((item) => [item.speaker, item.text, item.translation, item.start]), [
    ['Man', "Excuse me, where's gate 5?", 'Xin lỗi, cổng 5 ở đâu?', 0],
    ['Woman', "It's next to the café.", '', 2],
  ]);
  const song = await service.getTranscript(student, papers[2].exercise.id);
  assert.equal(song.segments[0].text, 'I walked across an empty land');
  await assert.rejects(() => service.getTranscript(manager, papers[1].exercise.id), { code: 26 });
});


test('TOEIC parts hide 30% or 50% of the words at random, content words first, and keep a best score per mode', async () => {
  const { service, papers } = listeningHarness({ random: () => 0 });
  const gate = papers[1];
  const [first, second] = gate.content.segments;
  const hide50 = await service.getExercise(student, gate.exercise.id, { mode: 'hide50' });
  assert.equal(hide50.mode, 'hide50');
  const blanks = hide50.segments.map((segment) => segment.pieces.filter((piece) => 'blank' in piece).map((piece) => piece.blank));
  assert.deepEqual(blanks.map((list) => list.length), [3, 3]);
  assert.equal(hide50.blankCount, 6);
  const words = (segment, keys) => keys.map((key) => segment.text.split(/\s+/)[Number(key.split(':')[1]) / 2].replace(/[^\p{L}\p{N}']/gu, ''));
  assert.ok(words(first, blanks[0]).every((word) => !['me'].includes(word.toLowerCase())));
  assert.equal(hide50.segments[0].pieces.map((piece) => piece.text ?? '_').join('').replace(/_/g, '').length < first.text.length, true);
  assert.equal(JSON.stringify(hide50.segments).includes('gate'), false);

  const answers = {};
  blanks.flat().forEach((key) => (answers[key] = ''));
  const answerFor = (segment, key) => segment.text.split(/\s+/)[Number(key.split(':')[1]) / 2].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  blanks[0].forEach((key) => (answers[key] = answerFor(first, key)));
  const line = await service.checkLine(student, gate.exercise.id, { mode: 'hide50', segmentId: first.id, answers });
  assert.equal(line.segment.accuracy, 100);
  assert.ok(line.segment.pieces.every((piece) => piece.correct && piece.answer));
  const scored = await service.check(student, gate.exercise.id, { mode: 'hide50', answers });
  assert.deepEqual([scored.mode, scored.accuracy, scored.segments.map((segment) => segment.accuracy)], ['hide50', 50, [100, 0]]);
  assert.equal((await service.listPractice(student)).exercises[1].hide50.bestAccuracy, 50);
  assert.equal((await service.listPractice(student)).exercises[1].hide30.checkCount, 0);

  const missing = { ...answers };
  delete missing[blanks[1][0]];
  await assert.rejects(() => service.check(student, gate.exercise.id, { mode: 'hide50', answers: missing }), { code: 30 });
  await assert.rejects(() => service.check(student, gate.exercise.id, { mode: 'hide50', answers: { ...answers, [`${second.id}:1`]: 'x', [`${second.id}:3`]: 'x' } }), { code: 30 });
  await assert.rejects(() => service.getExercise(student, papers[2].exercise.id, { mode: 'hide30' }), { code: 30 });
  const hide30 = await service.getExercise(student, papers[0].exercise.id, { mode: 'hide30' });
  assert.deepEqual(hide30.segments.map((segment) => segment.pieces.filter((piece) => 'blank' in piece).length), [1, 1, 1, 1]);
});

test('each checked sentence keeps its latest status for the part progress and the redo list', async () => {
  const { service, papers } = listeningHarness();
  const gate = papers[1];
  const [first, second] = gate.content.segments;
  const right = await service.checkLine(student, gate.exercise.id, { segmentId: first.id, answers: { [first.id]: 'excuse me where is gate five' } });
  assert.equal(right.status, 'done');
  const wrong = await service.checkLine(student, gate.exercise.id, { segmentId: second.id, answers: { [second.id]: 'it is next' } });
  assert.equal(wrong.status, 'wrong');
  assert.deepEqual((await service.getExercise(student, gate.exercise.id)).lines, { [first.id]: 'done', [second.id]: 'wrong' });
  assert.deepEqual((await service.listPractice(student)).exercises[1].lines, { done: 1, wrong: 1 });
  await service.checkLine(student, gate.exercise.id, { segmentId: second.id, answers: { [second.id]: "it's next to the cafe" } });
  assert.deepEqual((await service.listPractice(student)).exercises[1].lines, { done: 2, wrong: 0 });
  assert.deepEqual((await service.listPractice(otherStudent)).exercises[1].lines, { done: 0, wrong: 0 });
});

test('Hide 100% gives one box per word with the word length, and keeps its own best', async () => {
  const { service, papers } = listeningHarness();
  const gate = papers[1];
  const opened = await service.getExercise(student, gate.exercise.id, { mode: 'hide100' });
  const firstLine = opened.segments[0].pieces;
  assert.deepEqual(firstLine.filter((piece) => 'blank' in piece).map((piece) => piece.size), [6, 2, 7, 4, 1]);
  assert.equal(firstLine.filter((piece) => 'text' in piece).map((piece) => piece.text).join(''), ' ,   ?');
  const answers = Object.fromEntries(opened.segments.flatMap((segment) => segment.pieces.filter((piece) => 'blank' in piece).map((piece) => [piece.blank, ''])));
  const scored = await service.check(student, gate.exercise.id, { mode: 'hide100', answers });
  assert.equal(scored.mode, 'hide100');
  assert.equal((await service.listPractice(student)).exercises[1].hide100.checkCount, 1);
});
