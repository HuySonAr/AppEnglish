import test from 'node:test';
import assert from 'node:assert/strict';
import { LessonService } from '../src/lesson/lesson.service.js';
import { lessonAccess, unitReviewAccess } from '../src/lesson/lesson.rules.js';
import { student } from './helpers.js';
import { createCurriculum, createLessonRepository, placementWith, quizAnswers, reviewAnswers, testAnswers } from './lesson-helpers.js';

const learner = { ...student, email: 'learner@appenglish.test' };

const ids = (count) => Array.from({ length: count }, (_, index) => `l${index + 1}`);
function curriculumOf(shape, reviewed = []) {
  const all = ids(shape.reduce((sum, count) => sum + count, 0));
  let next = 0;
  return {
    units: shape.map((count, index) => ({
      id: `u${index + 1}`,
      reviewVersionId: reviewed.includes(index) ? `v${index + 1}` : null,
      lessons: all.slice(next, (next += count)).map((id) => ({ id })),
    })),
  };
}
const lessonStates = (curriculum, startUnit, completed, passed = []) =>
  [...lessonAccess(curriculum, startUnit, new Set(completed), new Set(passed)).values()].map((entry) => entry.state[0]).join('');
const reviewStates = (curriculum, startUnit, completed, passed = []) =>
  [...unitReviewAccess(curriculum, startUnit, new Set(completed), new Set(passed)).values()].map((entry) => entry.state[0]).join('');

test('a unit with a review opens the next unit only once the review is passed', () => {
  const curriculum = curriculumOf([2, 2, 1], [0, 1]);
  assert.equal(lessonStates(curriculum, 1, ['l1', 'l2']), 'CCLLL');
  assert.equal(lessonStates(curriculum, 1, ['l1', 'l2'], ['u1']), 'CCOLL');
  assert.equal(lessonStates(curriculum, 1, ['l1', 'l2', 'l3', 'l4'], ['u1']), 'CCCCL');
  assert.equal(lessonStates(curriculum, 1, ['l1', 'l2', 'l3', 'l4'], ['u1', 'u2']), 'CCCCO');
  assert.equal(lessonStates(curriculumOf([2, 2, 1], [1]), 1, ['l1', 'l2']), 'CCOLL');
  assert.equal(lessonStates(curriculum, 2, []), 'OOOLL');
  assert.equal(lessonStates(curriculum, 3, []), 'OOOOO');
});

test('the state of a unit review follows the lessons of the unit', () => {
  const curriculum = curriculumOf([2, 2, 1], [0, 1]);
  assert.equal(reviewStates(curriculum, 1, []), 'LLN');
  assert.equal(reviewStates(curriculum, 1, ['l1']), 'LLN');
  assert.equal(reviewStates(curriculum, 1, ['l1', 'l2']), 'OLN');
  assert.equal(reviewStates(curriculum, 1, ['l1', 'l2'], ['u1']), 'PLN');
  assert.equal(reviewStates(curriculum, 1, ['l1', 'l2', 'l3', 'l4'], ['u1']), 'PON');
  assert.equal(reviewStates(curriculum, null, ['l1', 'l2']), 'LLN');
  assert.equal(reviewStates(curriculum, 2, []), 'OLN');
  assert.equal(unitReviewAccess(curriculum, 1, new Set(['l1']), new Set()).get('u1').lessonsLeft, 1);
});

async function harness() {
  const content = createCurriculum([2, 1], { reviews: [0] });
  const repository = createLessonRepository();
  const placement = await placementWith(learner.id, 1);
  const clock = { now: new Date('2026-10-20T08:00:00Z') };
  const recorded = [];
  const events = { record: async (type, payload) => recorded.push({ type, payload }) };
  const service = new LessonService(repository, placement, content, { now: () => new Date(clock.now), events });
  const complete = async (lesson) => {
    const paper = content.paperOf(lesson.id);
    const view = await service.getLesson(learner, lesson.id);
    if (view.review)
      await service.submitVocabularyQuiz(learner, lesson.id, { kind: 'review', answers: quizAnswers(content.paperOf(view.review.lessonId)) });
    await service.markVocabularyStudied(learner, lesson.id);
    await service.submitVocabularyQuiz(learner, lesson.id, { kind: 'vocabulary', answers: quizAnswers(paper) });
    await service.submitFillIn(learner, lesson.id, { answers: paper.content.fillIn.answers });
    await service.startLessonTest(learner, lesson.id);
    clock.now = new Date(clock.now.getTime() + 5 * 60 * 1000);
    await service.submitLessonTest(learner, lesson.id, { answers: testAnswers(paper, 23) });
  };
  return { content, repository, service, complete, units: content.units, recorded };
}

test('a learner takes the review after the lessons of the unit; passing it opens the next unit', async () => {
  const h = await harness();
  const [unit1, unit2] = h.units;
  await assert.rejects(() => h.service.getUnitReview(learner, unit2.id), { code: 63 });
  await assert.rejects(() => h.service.getUnitReview(learner, unit1.id), (error) => error.code === 64 && error.data.lessonsLeft === 2);
  const before = await h.service.getCurriculum(learner);
  assert.deepEqual(before.units[0].review, { state: 'LOCKED', questionCount: 19, passPercent: 80, lessonsLeft: 2, attemptCount: 0, bestPercent: null });
  assert.equal(before.units[1].review, null);

  await h.complete(unit1.lessons[0]);
  await h.complete(unit1.lessons[1]);
  const curriculum = await h.service.getCurriculum(learner);
  assert.equal(curriculum.units[0].review.state, 'OPEN');
  assert.equal(curriculum.units[1].lessons[0].state, 'LOCKED');
  await assert.rejects(() => h.service.getLesson(learner, unit2.lessons[0].id), { code: 54 });

  const review = await h.service.getUnitReview(learner, unit1.id);
  assert.deepEqual(review.unit, { id: unit1.id, number: 1, title: 'Unit 1' });
  assert.equal(review.state, 'OPEN');
  assert.deepEqual(review.parts.map((part) => [part.key, part.questions.length, part.groups.length]), [['part5', 10, 0], ['part6', 9, 3]]);
  assert.deepEqual(review.parts[1].questions.map((question) => question.number).slice(0, 2), [11, 12]);
  assert.equal(review.parts[0].questions.some((question) => question.options.some((option) => 'isCorrect' in option)), false);
  assert.equal(review.parts[0].questions.some((question) => question.explanation), false);

  const paper = h.content.reviewOf(unit1.id);
  const failed = await h.service.submitUnitReview(learner, unit1.id, { answers: reviewAnswers(paper, 15) });
  assert.deepEqual({ ...failed.attempt, submittedAt: undefined }, { attemptNumber: 1, correctCount: 15, totalCount: 19, scorePercent: 79, passed: false, submittedAt: undefined });
  assert.equal(failed.parts[0].questions[0].options.some((option) => option.isCorrect), true, 'the result explains every answer');
  assert.equal(failed.parts[0].questions[15 % 10]?.explanation, 'Secret explanation');
  assert.equal((await h.service.getCurriculum(learner)).units[1].lessons[0].state, 'LOCKED');

  const passed = await h.service.submitUnitReview(learner, unit1.id, { answers: reviewAnswers(paper, 16) });
  assert.equal(passed.attempt.passed, true);
  assert.equal(passed.attempt.attemptNumber, 2);
  const after = await h.service.getCurriculum(learner);
  assert.deepEqual(after.units[0].review, { state: 'PASSED', questionCount: 19, passPercent: 80, lessonsLeft: 0, attemptCount: 2, bestPercent: 84 });
  assert.equal(after.units[1].lessons[0].state, 'OPEN');
  assert.equal((await h.service.getLesson(learner, unit2.lessons[0].id)).lesson.state, 'OPEN');
  const again = await h.service.submitUnitReview(learner, unit1.id, { answers: reviewAnswers(paper, 10) });
  assert.equal(again.attempt.attemptNumber, 3);
  assert.equal((await h.service.getUnitReview(learner, unit1.id)).attempts.length, 3);
  assert.equal((await h.service.getCurriculum(learner)).units[0].review.state, 'PASSED');
  const opened = h.recorded.filter((event) => event.type === 'unit-review.passed');
  assert.deepEqual(opened.map((event) => [event.payload.unitId, event.payload.unitTitle, event.payload.nextUnitId, event.payload.nextUnitTitle]), [[unit1.id, 'Unit 1', unit2.id, 'Unit 2']]);

  h.content.unpublishReview(unit1.id);
  assert.equal((await h.service.getCurriculum(learner)).units[0].review, null);
  await assert.rejects(() => h.service.getUnitReview(learner, unit1.id), { code: 63 });
  assert.equal((await h.service.getCurriculum(learner)).units[1].lessons[0].state, 'OPEN');
});
