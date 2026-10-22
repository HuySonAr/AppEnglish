import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lessonAuthoringProblems, lessonFromAuthoring, reviewAuthoringProblems } from '@appenglish/content-contracts/authoring';
import { exportLesson, exportReview, jsonFileName, mergeImportedLesson, planLessonImport, planReviewImport } from './authoring-import.js';

const sample = new URL('../../../../../../content-samples/600-words/lessons/01-contracts.json', import.meta.url);
const review = new URL('../../../../../../content-samples/600-words/reviews/01-general-business.json', import.meta.url);

test('a lesson file is checked, converted and merged with the media the draft already has', async () => {
  const text = await readFile(sample, 'utf8');
  const current = lessonFromAuthoring(JSON.parse(text));
  current.vocabulary[1].audioUsMediaId = 'us-audio';
  current.vocabulary[1].phonetic = '/əˈɡriːmənt/';
  current.test.part1.audioMediaId = 'p1-audio';
  current.test.part1.questions[0].imageMediaId = 'p1-image';
  const plan = planLessonImport(text, current);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.summary[0], '12 words');
  assert.equal(plan.content.vocabulary[1].audioUsMediaId, 'us-audio');
  assert.equal(plan.content.vocabulary[1].phonetic, '/əˈɡriːmənt/');
  assert.equal(plan.content.test.part1.audioMediaId, 'p1-audio');
  assert.equal(plan.content.test.part1.questions[0].imageMediaId, 'p1-image');
  assert.ok(plan.content.vocabulary[0].id, 'editor ids are assigned');
  assert.equal(plan.content.test.part5.questions.length, 6);
  // A word that left the lesson takes its audio with it.
  const smaller = JSON.parse(text);
  smaller.vocabulary = smaller.vocabulary.slice(0, 1);
  assert.equal(mergeImportedLesson(current, lessonFromAuthoring(smaller)).vocabulary.length, 1);
});

test('problems are named before anything is replaced', () => {
  assert.deepEqual(planLessonImport('{', null).errors, ['The file is not valid JSON']);
  const { errors } = lessonAuthoringProblems({ vocabulary: [{ word: 'x' }], fillIn: { passage: 'a ___ b', answers: [] }, test: { part1: { options: ['a', 'b', 'c', 'd'], answer: 'E' }, part2: [], part5: [{ prompt: 'q', options: ['a', 'b', 'c', 'd'], answer: 'A' }] } });
  assert.ok(errors.includes('Fill-in: 1 blanks but 0 answers'), errors.join('\n'));
  assert.ok(errors.includes('Part 1: answer must be one of A, B, C, D'));
  assert.ok(errors.includes('Part 2: 0 questions, 2 expected'));
  assert.ok(errors.includes('Part 5: 1 question, 6 expected'));
  assert.ok(errors.includes('Part 3: 0 questions, 3 expected'));
  assert.deepEqual(reviewAuthoringProblems([]).errors, ['The file is not a unit review object']);
});

test('export gives the authoring format back, and a typed transcript survives the round trip', async () => {
  const data = JSON.parse(await readFile(sample, 'utf8'));
  const content = lessonFromAuthoring(data);
  const exported = exportLesson(content, { number: 1, title: 'Contracts' });
  assert.equal(exported.number, 1);
  assert.deepEqual(exported.test.part1.options, data.test.part1.options);
  assert.equal(exported.test.part1.answer, 'A');
  assert.equal('transcript' in exported.test.part1, false, 'a generated transcript is not repeated');
  assert.deepEqual(exported.test.part2[1].options, data.test.part2[1].options);
  assert.equal(exported.test.part2[0].question, data.test.part2[0].question);
  assert.equal(exported.test.part3.transcript, data.test.part3.transcript);
  assert.deepEqual(exported.test.part6.questions[2].options, data.test.part6.questions[2].options);
  assert.deepEqual(exported.fillIn.answers, data.fillIn.answers);
  // A transcript typed in the editor is exported as such and imported back as it is.
  content.test.part1.transcript = 'Number 1.\n(A) Hand-typed.\n(B) Two.\n(C) Three.\n(D) Four.\nEnd.';
  const typed = exportLesson(content);
  assert.equal(typed.test.part1.transcript, content.test.part1.transcript);
  assert.equal(lessonFromAuthoring(typed).test.part1.transcript, content.test.part1.transcript);
  assert.equal(lessonFromAuthoring({ ...typed, test: { ...typed.test, part2Transcript: 'Own words' } }).test.part2.transcript, 'Own words');
});

test('a unit review file round-trips too', async () => {
  const text = await readFile(review, 'utf8');
  const plan = planReviewImport(text);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.content.test.part6.groups.length, 3);
  assert.equal(plan.content.test.part6.questions.filter((question) => question.groupId === plan.content.test.part6.groups[2].id).length, 3);
  const exported = exportReview(plan.content, { unit: 1, title: 'General Business' });
  const data = JSON.parse(text);
  assert.equal(exported.part5.length, 10);
  assert.deepEqual(exported.part5[3].options, data.part5[3].options);
  assert.equal(exported.part6[1].passage, data.part6[1].passage);
  assert.equal(exported.part6[2].questions[2].answer, data.part6[2].questions[2].answer);
  assert.equal(jsonFileName("Doctor's Office"), 'doctor-s-office.json');
});
