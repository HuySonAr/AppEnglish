import { COURSE_LEVELS } from '@appenglish/content-contracts';
import { CourseItemState, CourseLevelState } from '@appenglish/learning-contracts';

// Where a learner stands in the Listening course (F05C, D100, D102). Pure
// functions, no I/O.
//
// The current level is the first level, from the starting level on, whose
// level test is not passed; levels before it are done (open for review) and
// levels after it are locked. In the current level, lessons and unit checks
// open one after the other: a lesson once the lesson or unit check before it
// is passed, a unit check once every lesson of its unit is passed. The level
// test of the current level is open at any time, so a learner can move up
// early.

const stateOf = (passed, open) => (passed ? CourseItemState.PASSED : open ? CourseItemState.OPEN : CourseItemState.LOCKED);

//   course         the published course (content-service ListPublishedCourse)
//   lessonPassed   Set of the passed lesson ids
//   testPassed     Set of the unit and level-test ids whose test is passed
//   startLevel     where the learner starts (A1 until the listening placement)
// Returns { currentLevel (null once every level test is passed), levels, next }:
// each level with its `state`, its units with `state` on every lesson and on
// `check`, and its level test with `state`; `next` the first open item of the
// current level: { type: 'lesson', unitId, lessonId } or { type: 'unit_check'
// | 'level_test', itemId }, with its title, or null.
export function courseMap(course, { lessonPassed, testPassed, startLevel = COURSE_LEVELS[0] }) {
  const startAt = Math.max(0, COURSE_LEVELS.indexOf(startLevel));
  let currentLevel = null;
  const levels = course.levels.map((level) => {
    const index = COURSE_LEVELS.indexOf(level.level);
    const testDone = Boolean(level.levelTest && testPassed.has(level.levelTest.id));
    let state;
    if (currentLevel) state = CourseLevelState.LOCKED;
    else if (index < startAt || testDone) state = CourseLevelState.DONE;
    else {
      state = CourseLevelState.CURRENT;
      currentLevel = level.level;
    }
    const free = state === CourseLevelState.DONE;
    const locked = state === CourseLevelState.LOCKED;
    // In the current level: whether the item before was passed.
    let previousPassed = true;
    const units = level.units.map((unit) => {
      const lessons = unit.lessons.map((lesson) => {
        const passed = lessonPassed.has(lesson.id);
        const lessonState = locked ? CourseItemState.LOCKED : stateOf(passed, free || previousPassed);
        previousPassed = passed;
        return { ...lesson, state: lessonState };
      });
      const checkPassed = testPassed.has(unit.id);
      const allLessons = unit.lessons.every((lesson) => lessonPassed.has(lesson.id));
      const check = { state: locked ? CourseItemState.LOCKED : stateOf(checkPassed, free || allLessons) };
      previousPassed = checkPassed;
      return { ...unit, lessons, check };
    });
    const levelTest = level.levelTest ? { ...level.levelTest, state: locked ? CourseItemState.LOCKED : stateOf(testDone, true) } : null;
    return { level: level.level, state, units, levelTest };
  });

  let next = null;
  const current = levels.find((level) => level.state === CourseLevelState.CURRENT);
  if (current) {
    for (const unit of current.units) {
      const lesson = unit.lessons.find((item) => item.state === CourseItemState.OPEN);
      if (lesson) {
        next = { type: 'lesson', level: current.level, unitId: unit.id, lessonId: lesson.id, title: lesson.title, unitTitle: unit.title };
        break;
      }
      if (unit.check.state === CourseItemState.OPEN) {
        next = { type: 'unit_check', level: current.level, itemId: unit.id, title: unit.title, unitTitle: unit.title };
        break;
      }
    }
    if (!next && current.levelTest?.state === CourseItemState.OPEN)
      next = { type: 'level_test', level: current.level, itemId: current.levelTest.id, title: current.levelTest.title, unitTitle: null };
  }
  return { currentLevel, levels, next };
}

// The state of a lesson, of a unit's check or of a level test in the map;
// null when it is not in the published course.
export function lessonStateIn(map, unitId, lessonId) {
  for (const level of map.levels)
    for (const unit of level.units) if (unit.id === unitId) return unit.lessons.find((lesson) => lesson.id === lessonId)?.state ?? null;
  return null;
}

export function testStateIn(map, itemId) {
  for (const level of map.levels) {
    if (level.levelTest?.id === itemId) return level.levelTest.state;
    const unit = level.units.find((item) => item.id === itemId);
    if (unit) return unit.check.state;
  }
  return null;
}

// The level a learner starts at after the listening placement (D103):
// levels are taken from A1 up; a level is known when at least
// COURSE_PASS_PERCENT.placementLevel of its questions are right; the start
// is the first level not known, or the last level when all are known.
//   levelScores  [{ level, right, total }]
export function placementStartLevel(levelScores, passPercent) {
  for (const level of COURSE_LEVELS) {
    const score = levelScores.find((entry) => entry.level === level);
    if (!score?.total || score.right * 100 < passPercent * score.total) return level;
  }
  return COURSE_LEVELS[COURSE_LEVELS.length - 1];
}

// The learner's progress in the course (D104), from the course map and their
// results: by level, lessons and unit checks passed out of all and the level
// test's best score; overall, the lessons passed, the average best score of
// the lessons tried and the number of attempts.
export function courseProgress(map, lessonResults, testResults) {
  const lessonOf = (id) => lessonResults.find((result) => result.lessonId === id);
  const testOf = (id) => testResults.find((result) => result.itemId === id);
  const levels = map.levels.map((level) => {
    const lessons = level.units.flatMap((unit) => unit.lessons);
    const test = level.levelTest && testOf(level.levelTest.id);
    return {
      level: level.level,
      state: level.state,
      lessons: { passed: lessons.filter((lesson) => lessonOf(lesson.id)?.passedAt).length, total: lessons.length },
      unitChecks: { passed: level.units.filter((unit) => testOf(unit.id)?.passedAt).length, total: level.units.length },
      levelTest: level.levelTest ? { bestScore: test?.bestScore ?? null, passed: Boolean(test?.passedAt) } : null,
    };
  });
  const inCourse = new Set(map.levels.flatMap((level) => level.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id))));
  const tried = lessonResults.filter((result) => inCourse.has(result.lessonId));
  return {
    currentLevel: map.currentLevel,
    lessons: { passed: levels.reduce((sum, level) => sum + level.lessons.passed, 0), total: inCourse.size },
    averageBestScore: tried.length ? Math.round(tried.reduce((sum, result) => sum + result.bestScore, 0) / tried.length) : null,
    attemptCount: tried.reduce((sum, result) => sum + result.attemptCount, 0),
    levels,
  };
}

// The words missed most often across the mistakes: [{ word, count }], in
// lower case without punctuation, most missed first, at most `limit`.
export function mostMissedWords(mistakes, limit = 10) {
  const counts = new Map();
  for (const mistake of mistakes)
    for (const missed of mistake.missedWords) {
      const word = missed.text.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (word) counts.set(word, (counts.get(word) || 0) + mistake.timesMissed);
    }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

// The level after `level`, or null after the last.
export const levelAfter = (level) => COURSE_LEVELS[COURSE_LEVELS.indexOf(level) + 1] ?? null;
