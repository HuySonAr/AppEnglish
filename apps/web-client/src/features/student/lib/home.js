import { LessonState } from '@appenglish/learning-contracts';

// Pure rules of the student's home page: what to do next and where the
// learner stands, from the data the other student pages already load.

// The next step of the main course (units and lessons, F04): the placement
// when it is still required, else the first open lesson in order; 'done' when
// every published lesson is completed; 'none' when nothing is published.
export function nextLessonStep(curriculum) {
  if (!curriculum) return null;
  if (curriculum.placementRequired) return { kind: 'placement' };
  const units = curriculum.units || [];
  for (const unit of units) {
    const lesson = unit.lessons.find((item) => item.state === LessonState.OPEN);
    if (lesson) return { kind: 'lesson', lesson, unit };
  }
  const total = units.reduce((sum, unit) => sum + unit.lessons.length, 0);
  return { kind: total ? 'done' : 'none' };
}

// Lessons completed over the published lessons, and the unit the learner is
// in (the first unit with a lesson not completed).
export function lessonStats(curriculum) {
  const units = curriculum?.units || [];
  const lessons = units.flatMap((unit) => unit.lessons);
  const completed = lessons.filter((lesson) => lesson.state === LessonState.COMPLETED).length;
  const currentUnit = units.find((unit) => unit.lessons.some((lesson) => lesson.state !== LessonState.COMPLETED)) || null;
  return { completed, total: lessons.length, currentUnit };
}

// The mock test to suggest (D64): a test of the recommended level the
// learner has not taken yet, else the one of that level taken the fewest
// times, else any test not taken, else the first. null without tests.
export function suggestedMockTest(mocks) {
  const tests = mocks?.mockTests || [];
  if (!tests.length) return null;
  const recommended = tests.filter((test) => test.recommended);
  const byAttempts = (list) => [...list].sort((a, b) => a.attemptCount - b.attemptCount);
  return byAttempts(recommended)[0] || tests.find((test) => test.attemptCount === 0) || tests[0];
}

// The learner's best full-mock score so far, as a percent, or null.
export function bestMockPercent(mocks) {
  const scores = (mocks?.mockTests || []).map((test) => test.bestPercent).filter((value) => value !== null && value !== undefined);
  return scores.length ? Math.max(...scores) : null;
}

// A greeting for the hour of the day.
export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
