import { COURSE_LEVELS } from '@appenglish/content-contracts';
import { CourseLevelState } from '@appenglish/learning-contracts';

// Where a learner stands in the Listening course (D145). Pure functions, no I/O.
//
// The first level is open; each level after it opens once the level test of
// the level before is passed. In an open level every topic can be studied,
// in any order; a topic is "done" once the learner marked it so. A level
// without a published level test keeps the next level closed.

//   course       the published course (content-service ListPublishedCourse)
//   topicDone    Set of the topic ids the learner completed
//   testPassed   Set of the level-test ids the learner passed
// Returns { levels, currentLevel }: each level with its `state`, its topics
// (with `done`) and its level test (with `passed`); currentLevel is the
// highest open level.
export function courseMap(course, { topicDone, testPassed }) {
  let open = true;
  let currentLevel = null;
  const levels = course.levels.map((level) => {
    const state = open ? CourseLevelState.OPEN : CourseLevelState.LOCKED;
    if (open) currentLevel = level.level;
    const passed = Boolean(level.levelTest && testPassed.has(level.levelTest.id));
    // The next level opens only through this level's test.
    open = open && passed;
    return {
      level: level.level,
      state,
      topics: level.topics.map((topic) => ({ ...topic, done: topicDone.has(topic.id) })),
      levelTest: level.levelTest ? { ...level.levelTest, passed } : null,
    };
  });
  return { levels, currentLevel };
}

// The level of a topic or a level test in the map and whether it is open;
// null when it is not in the published course.
export function itemPlace(map, itemId) {
  for (const level of map.levels) {
    if (level.levelTest?.id === itemId) return { level: level.level, open: level.state === CourseLevelState.OPEN, kind: 'level_test' };
    if (level.topics.some((topic) => topic.id === itemId)) return { level: level.level, open: level.state === CourseLevelState.OPEN, kind: 'topic' };
  }
  return null;
}

// The learner's progress: by level, topics done out of all and the level
// test's best score; overall, the topics done and the levels opened.
export function courseProgress(map, testResults) {
  const testOf = (id) => testResults.find((result) => result.itemId === id);
  const levels = map.levels.map((level) => {
    const test = level.levelTest && testOf(level.levelTest.id);
    return {
      level: level.level,
      state: level.state,
      topics: { done: level.topics.filter((topic) => topic.done).length, total: level.topics.length },
      levelTest: level.levelTest ? { bestScore: test?.bestScore ?? null, attemptCount: test?.attemptCount ?? 0, passed: level.levelTest.passed } : null,
    };
  });
  return {
    currentLevel: map.currentLevel,
    topics: {
      done: levels.reduce((sum, level) => sum + level.topics.done, 0),
      total: levels.reduce((sum, level) => sum + level.topics.total, 0),
    },
    openLevels: levels.filter((level) => level.state === CourseLevelState.OPEN).length,
    levels,
  };
}

// The level after `level`, or null after the last.
export const levelAfter = (level) => COURSE_LEVELS[COURSE_LEVELS.indexOf(level) + 1] ?? null;

// A fixed shuffled order of the ordering ideas for one learner and topic, so
// a reload does not reshuffle; never the right order when it can be avoided.
export function shuffledOrder(items, seedText) {
  let seed = [...String(seedText)].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
  const random = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  if (copy.length > 1 && copy.every((item, index) => item.id === items[index].id)) copy.push(copy.shift());
  return copy;
}
