import { LessonState } from '@appenglish/learning-contracts';

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

export function lessonStats(curriculum) {
  const units = curriculum?.units || [];
  const lessons = units.flatMap((unit) => unit.lessons);
  const completed = lessons.filter((lesson) => lesson.state === LessonState.COMPLETED).length;
  const currentUnit = units.find((unit) => unit.lessons.some((lesson) => lesson.state !== LessonState.COMPLETED)) || null;
  return { completed, total: lessons.length, currentUnit };
}

export function suggestedMockTest(mocks) {
  const tests = mocks?.mockTests || [];
  if (!tests.length) return null;
  const recommended = tests.filter((test) => test.recommended);
  const byAttempts = (list) => [...list].sort((a, b) => a.attemptCount - b.attemptCount);
  return byAttempts(recommended)[0] || tests.find((test) => test.attemptCount === 0) || tests[0];
}

export function bestMockPercent(mocks) {
  const scores = (mocks?.mockTests || []).map((test) => test.bestPercent).filter((value) => value !== null && value !== undefined);
  return scores.length ? Math.max(...scores) : null;
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
