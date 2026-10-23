import { ProgressSkill, ProgressSource, wholePercent } from '@appenglish/progress-contracts';

const SKILLS = Object.values(ProgressSkill);

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
