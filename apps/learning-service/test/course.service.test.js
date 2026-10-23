import test from 'node:test';
import assert from 'node:assert/strict';
import { courseMap, shuffledOrder } from '../src/course/course.rules.js';
import { courseHarness, testAnswers } from './course-helpers.js';

const student = { id: '22222222-2222-4222-8222-222222222222', role: 'STUDENT' };
const other = { id: '44444444-4444-4444-8444-444444444444', role: 'STUDENT' };
const manager = { id: '11111111-1111-4111-8111-111111111111', role: 'CONTENT_MANAGER' };

test('a learner starts at A1 with every topic open; higher levels open through the level tests (D145)', async () => {
  const { service } = courseHarness();
  await assert.rejects(() => service.getCourse(manager), { code: 26 });
  const course = await service.getCourse(student);
  assert.equal(course.currentLevel, 'A1');
  assert.deepEqual(course.levels.map((level) => level.state), ['OPEN', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);
  assert.deepEqual(course.levels[0].topics.map((topic) => [topic.title, topic.done]), [['Ordering', false], ['Paying', false]]);
  assert.deepEqual([course.levels[0].levelTest.title, course.levels[0].levelTest.nextLevel, course.levels[0].levelTest.passed], ['A1 test', 'A2', false]);
  assert.equal(course.passPercent.levelTest, 70);
  assert.equal('placement' in course, false);
});

test('a topic comes with everything to study it; locked levels and unknown topics are refused', async () => {
  const h = courseHarness();
  // The second topic opens straight away: nothing is locked inside a level.
  const topic = await h.service.getTopic(student, h.paying.item.id);
  assert.deepEqual([topic.topic.title, topic.done, topic.previous.title, topic.next], ['Paying', false, 'Ordering', null]);
  assert.equal(topic.audioUrl, 'https://media.test/cafe.mp3');
  assert.deepEqual(topic.vocabulary[0], { id: h.paying.content.vocabulary[0].id, word: 'large', phonetic: '/lɑːdʒ/', meaning: 'lớn', audioUrl: 'https://media.test/large.mp3' });
  assert.equal(topic.questions[0].correctOptionId, h.paying.content.questions[0].options[0].id);
  assert.equal(topic.questions[0].options.some((option) => 'isCorrect' in option), false);
  assert.deepEqual(topic.ordering.order, h.paying.content.ordering.items.map((item) => item.id));
  assert.notDeepEqual(topic.ordering.items.map((item) => item.id), topic.ordering.order);
  assert.equal(topic.sentences.length, 4);
  assert.deepEqual([topic.sentences[1].translation, topic.sentences[1].pieces], ['Câu 2', [{ text: 'Yes, a ' }, { blank: 0, answer: 'coffee' }, { text: ' ' }, { blank: 1, answer: 'please' }, { text: '.' }]]);
  assert.equal(topic.sentences[0].pieces, null);
  // The same learner always gets the same shuffle.
  assert.deepEqual((await h.service.getTopic(student, h.paying.item.id)).ordering.items, topic.ordering.items);

  await assert.rejects(() => h.service.getTopic(student, h.meetings.item.id), { code: 61, status: 409 });
  await assert.rejects(() => h.service.getTopic(student, '99999999-9999-4999-8999-999999999999'), { code: 60, status: 404 });
  await assert.rejects(() => h.service.getTopic(student, h.a1Test.item.id), { code: 60 });
});

test('a dictation sentence is checked word by word or blank by blank; nothing is kept', async () => {
  const h = courseHarness();
  const id = h.ordering.item.id;
  const [first, second] = h.ordering.content.segments;
  const full = await h.service.checkSentence(student, id, { segmentId: second.id, mode: 'full', text: 'yes a coffee', blanks: [] });
  assert.equal(full.correct, false);
  assert.ok(full.accuracy < 100);
  assert.deepEqual(full.words.filter((word) => word.status === 'missing').map((word) => word.text), ['please.']);
  const right = await h.service.checkSentence(student, id, { segmentId: second.id, mode: 'full', text: 'Yes, a coffee, please', blanks: [] });
  assert.deepEqual([right.correct, right.accuracy], [true, 100]);
  const blanks = await h.service.checkSentence(student, id, { segmentId: second.id, mode: 'blanks', text: '', blanks: ['Coffee', 'pleas'] });
  assert.deepEqual(blanks.blanks.map((blank) => [blank.expected, blank.correct]), [['coffee', true], ['please', false]]);
  assert.deepEqual([blanks.correct, blanks.accuracy], [false, 50]);
  // A sentence without blanks cannot be checked in the blanks mode.
  await assert.rejects(() => h.service.checkSentence(student, id, { segmentId: first.id, mode: 'blanks', text: '', blanks: [] }), { code: 30 });
  await assert.rejects(() => h.service.checkSentence(student, id, { segmentId: '99999999-9999-4999-8999-999999999999', mode: 'full', text: '', blanks: [] }), { code: 30 });
  assert.deepEqual([h.repository.tables.results.length, h.repository.tables.tests.length], [0, 0]);
});

test('completing a topic counts for progress only, and stays done', async () => {
  const h = courseHarness();
  const done = await h.service.completeTopic(student, h.paying.item.id);
  assert.equal(done.done, true);
  assert.deepEqual(done.progress.topics, { done: 1, total: 3 });
  await h.service.completeTopic(student, h.paying.item.id);
  assert.equal(h.repository.tables.results.length, 1);
  assert.equal(h.repository.tables.results[0].unitId, h.paying.item.id);
  const course = await h.service.getCourse(student);
  assert.deepEqual(course.levels[0].topics.map((topic) => topic.done), [false, true]);
  assert.equal((await h.service.getTopic(student, h.paying.item.id)).done, true);
  // Another learner is not affected.
  assert.deepEqual((await h.service.getCourse(other)).levels[0].topics.map((topic) => topic.done), [false, false]);
  await assert.rejects(() => h.service.completeTopic(student, h.meetings.item.id), { code: 61 });
});

test('passing a level test, at any time, opens the next level; the last level has none', async () => {
  const h = courseHarness();
  const paper = await h.service.getTest(student, h.a1Test.item.id);
  assert.deepEqual([paper.test.kind, paper.test.nextLevel, paper.passPercent, paper.sections[0].questions.length], ['level_test', 'A2', 70, 4]);
  assert.equal(JSON.stringify(paper).includes('isCorrect'), false);
  await assert.rejects(() => h.service.getTest(student, h.a2Test.item.id), { code: 61 });

  const failed = await h.service.submitTest(student, h.a1Test.item.id, { answers: testAnswers(h.a1Test, 2) });
  assert.deepEqual([failed.score, failed.passed, failed.levelUp], [50, false, null]);
  const passed = await h.service.submitTest(student, h.a1Test.item.id, { versionId: paper.versionId, answers: testAnswers(h.a1Test, 3) });
  assert.deepEqual([passed.score, passed.passed, passed.testPassed, passed.levelUp], [75, true, true, { from: 'A1', to: 'A2' }]);
  assert.deepEqual(h.recorded.filter((event) => event.type === 'course.level-up').map((event) => [event.payload.from, event.payload.to]), [['A1', 'A2']]);
  assert.equal(passed.sections[0].transcript.length, 4);
  assert.deepEqual(passed.sections[0].transcript[0], { id: '1', speaker: 'Man', text: 'Can I help you?' });
  assert.equal(passed.sections[0].questions[0].correct, true);
  // A worse attempt later keeps the level open.
  await h.service.submitTest(student, h.a1Test.item.id, { answers: testAnswers(h.a1Test, 0) });
  const course = await h.service.getCourse(student);
  assert.deepEqual(course.levels.slice(0, 3).map((level) => level.state), ['OPEN', 'OPEN', 'LOCKED']);
  assert.equal(course.currentLevel, 'A2');
  assert.equal((await h.service.getTopic(student, h.meetings.item.id)).topic.title, 'Meetings');
  // A2's test opens B1 even though B1 has no topics yet; B1 has no test, so B2 stays closed.
  await h.service.submitTest(student, h.a2Test.item.id, { answers: testAnswers(h.a2Test, 2) });
  assert.deepEqual((await h.service.getCourse(student)).levels.map((level) => level.state), ['OPEN', 'OPEN', 'OPEN', 'LOCKED', 'LOCKED', 'LOCKED']);
  await assert.rejects(() => h.service.submitTest(student, h.a1Test.item.id, { versionId: '99999999-9999-4999-8999-999999999999', answers: {} }), { code: 60 });
});

test('progress by level: topics done and the level test result', async () => {
  const h = courseHarness();
  await h.service.completeTopic(student, h.ordering.item.id);
  await h.service.submitTest(student, h.a1Test.item.id, { answers: testAnswers(h.a1Test, 4) });
  const progress = await h.service.getProgress(student);
  assert.deepEqual([progress.currentLevel, progress.topics, progress.openLevels], ['A2', { done: 1, total: 3 }, 2]);
  assert.deepEqual(progress.levels[0], { level: 'A1', state: 'OPEN', topics: { done: 1, total: 2 }, levelTest: { bestScore: 100, attemptCount: 1, passed: true } });
  assert.deepEqual(progress.levels[5], { level: 'C2', state: 'LOCKED', topics: { done: 0, total: 0 }, levelTest: null });
});

test('rules: the map and the shuffled order', () => {
  const course = { levels: [{ level: 'A1', topics: [{ id: 't1' }], levelTest: null }, { level: 'A2', topics: [], levelTest: null }] };
  const map = courseMap(course, { topicDone: new Set(['t1']), testPassed: new Set() });
  assert.deepEqual(map.levels.map((level) => level.state), ['OPEN', 'LOCKED']);
  assert.equal(map.levels[0].topics[0].done, true);
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  for (const seed of ['x', 'y', 'z', 'learner:topic']) assert.notDeepEqual(shuffledOrder(items, seed).map((item) => item.id), ['a', 'b', 'c']);
  assert.deepEqual(shuffledOrder([{ id: 'a' }], 'x'), [{ id: 'a' }]);
});
