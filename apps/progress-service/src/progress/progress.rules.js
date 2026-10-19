import { ProgressSkill, ProgressSource, wholePercent } from '@appenglish/progress-contracts';

const SKILLS = Object.values(ProgressSkill);

// Pure rules of progress (D33, D39).

// The best share of right answers per skill of every test the learner took:
// a lesson test or a mock test counts once, at its best attempt for that
// skill. A skill a test has no questions of is left out for that test.
export function bestBySkill(results) {
  const tests = new Map();
  for (const result of results) {
    const key = `${result.source}:${result.sourceId}`;
    const best = tests.get(key) || { source: result.source, sourceId: result.sourceId, listening: null, reading: null };
    for (const skill of SKILLS) {
      const total = result[`${skill}Total`];
      if (!total) continue;
      const ratio = result[`${skill}Correct`] / total;
      best[skill] = best[skill] === null ? ratio : Math.max(best[skill], ratio);
    }
    tests.set(key, best);
  }
  return [...tests.values()];
}

// Mastery of one skill: the average of the best shares of the tests that have
// questions of it, as a whole percent, with how many tests and of what kind
// it rests on. null percent (not 0) before any such test (D39).
export function skillMastery(results, skill) {
  const bests = bestBySkill(results).filter((best) => best[skill] !== null);
  const count = (source) => bests.filter((best) => best.source === source).length;
  if (!bests.length) {
    return { percent: null, testCount: 0, lessonTests: 0, mockTests: 0 };
  }
  const average = bests.reduce((sum, best) => sum + best[skill], 0) / bests.length;
  return {
    percent: wholePercent(average),
    testCount: bests.length,
    lessonTests: count(ProgressSource.LESSON_TEST),
    mockTests: count(ProgressSource.MOCK_TEST),
  };
}

// Lessons completed over the published lessons (D33). Only lessons still in
// the published curriculum count, so a completed lesson that was taken down
// neither counts nor blocks 100%. Each unit is listed with its own count.
export function completion(completions, curriculum) {
  const completed = new Set(completions.map((row) => row.lessonId));
  const units = curriculum.units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    completed: unit.lessons.filter((lesson) => completed.has(lesson.id)).length,
    total: unit.lessons.length,
  }));
  const completedLessons = units.reduce((sum, unit) => sum + unit.completed, 0);
  const totalLessons = units.reduce((sum, unit) => sum + unit.total, 0);
  return {
    completedLessons,
    totalLessons,
    percent: totalLessons ? wholePercent(completedLessons / totalLessons) : null,
    units,
  };
}
