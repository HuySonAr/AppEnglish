import { COURSE_LEVELS } from '@appenglish/content-contracts';
import { CourseLevelState } from '@appenglish/learning-contracts';

export function courseMap(course, { topicDone, testPassed }) {
  let open = true;
  let currentLevel = null;
  const levels = course.levels.map((level) => {
    const state = open ? CourseLevelState.OPEN : CourseLevelState.LOCKED;
    if (open) currentLevel = level.level;
    const passed = Boolean(level.levelTest && testPassed.has(level.levelTest.id));
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

export function itemPlace(map, itemId) {
  for (const level of map.levels) {
    if (level.levelTest?.id === itemId) return { level: level.level, open: level.state === CourseLevelState.OPEN, kind: 'level_test' };
    if (level.topics.some((topic) => topic.id === itemId)) return { level: level.level, open: level.state === CourseLevelState.OPEN, kind: 'topic' };
  }
  return null;
}

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

export const levelAfter = (level) => COURSE_LEVELS[COURSE_LEVELS.indexOf(level) + 1] ?? null;

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
