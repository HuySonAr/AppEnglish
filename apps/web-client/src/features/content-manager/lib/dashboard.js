import { COURSE_LEVELS, COURSE_TEST_LEVELS, LISTENING_LEVELS, UnitStatus } from '@appenglish/content-contracts';

// Pure rules of the Content Manager dashboard (D116): what exists, what is
// published, what still waits in a draft and what blocks learners.

const published = (item) => Boolean(item?.publishedVersionNumber);
const drafting = (item) => Boolean(item?.hasDraft);
const count = (items, test) => items.filter(test).length;

// Everything the course has, as counts: { total, published, drafts }.
function tally(items) {
  return { total: items.length, published: count(items, published), drafts: count(items, drafting) };
}

// The items of the listening course (units and level tests) across levels.
export function courseItems(course) {
  return (course?.levels || []).flatMap((entry) => [
    ...(entry.topics || []).map((topic) => ({ ...topic, level: entry.level, kind: 'topic' })),
    ...(entry.levelTest ? [{ ...entry.levelTest, level: entry.level, kind: 'level_test' }] : []),
  ]);
}

// The headline numbers of each content area.
export function contentSummary({ units = [], mockTests = [], exercises = [], course = null } = {}) {
  const lessons = units.flatMap((unit) => unit.lessons || []);
  const items = courseItems(course);
  return {
    units: { total: units.length, published: count(units, (unit) => unit.status === UnitStatus.PUBLISHED) },
    lessons: tally(lessons),
    mockTests: tally(mockTests),
    exercises: tally(exercises),
    courseTopics: tally(items.filter((item) => item.kind === 'topic')),
    levelTests: tally(items.filter((item) => item.kind === 'level_test')),
  };
}

// Every draft that waits to be published, with where to open it. Sorted so
// that unpublished items (learners cannot see them at all) come first.
export function pendingDrafts({ units = [], mockTests = [], exercises = [], course = null } = {}) {
  const rows = [];
  for (const unit of units)
    for (const lesson of unit.lessons || [])
      if (drafting(lesson)) rows.push({ id: lesson.id, kind: 'Lesson', title: lesson.title, context: unit.title, published: published(lesson), to: `/content-manager/lessons/${lesson.id}` });
  for (const mockTest of mockTests)
    if (drafting(mockTest)) rows.push({ id: mockTest.id, kind: 'Mock test', title: mockTest.title, context: `Level ${mockTest.level}`, published: published(mockTest), to: `/content-manager/mock-tests/${mockTest.id}` });
  for (const exercise of exercises)
    if (drafting(exercise)) rows.push({ id: exercise.id, kind: 'Listening exercise', title: exercise.title, context: [exercise.level, exercise.topic?.name].filter(Boolean).join(' · '), published: published(exercise), to: `/content-manager/listening/${exercise.id}` });
  for (const item of courseItems(course))
    if (drafting(item)) rows.push({ id: item.id, kind: item.kind === 'topic' ? 'Course topic' : 'Level test', title: item.title, context: item.level, published: published(item), to: `/content-manager/listening-course/${item.id}` });
  return rows.sort((a, b) => Number(a.published) - Number(b.published) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}

// What learners are missing right now. Each check: { key, ok, label, detail, to }.
export function readinessChecks({ units = [], mockTests = [], exercises = [], course = null, placement = null } = {}) {
  const lessons = units.flatMap((unit) => unit.lessons || []);
  const items = courseItems(course);
  const emptyUnits = units.filter((unit) => unit.status === UnitStatus.PUBLISHED && !(unit.lessons || []).some(published));
  const levelsWithoutTopics = COURSE_LEVELS.filter((level) => !items.some((item) => item.kind === 'topic' && item.level === level && published(item)));
  const levelsWithoutTest = COURSE_TEST_LEVELS.filter((level) => !items.some((item) => item.kind === 'level_test' && item.level === level && published(item)));
  return [
    { key: 'placement', ok: Boolean(placement?.publishedVersion), label: 'Placement test published', detail: placement?.publishedVersion ? `Version ${placement.publishedVersion}` : 'New learners cannot be placed yet', to: '/content-manager/placement' },
    { key: 'lessons', ok: lessons.some(published), label: 'At least one lesson published', detail: `${count(lessons, published)} of ${lessons.length} lessons`, to: '/content-manager/units' },
    { key: 'emptyUnits', ok: emptyUnits.length === 0, label: 'Every published unit has a published lesson', detail: emptyUnits.length ? `${emptyUnits.length} unit${emptyUnits.length === 1 ? '' : 's'} with none: ${emptyUnits.map((unit) => unit.title).join(', ')}` : 'No empty unit', to: '/content-manager/units' },
    { key: 'mock', ok: mockTests.some(published), label: 'At least one mock test published', detail: `${count(mockTests, published)} of ${mockTests.length} tests`, to: '/content-manager/mock-tests' },
    { key: 'courseLevels', ok: levelsWithoutTopics.length === 0, label: 'Every listening level has a published topic', detail: levelsWithoutTopics.length ? `Missing: ${levelsWithoutTopics.join(', ')}` : 'All levels covered', to: '/content-manager/listening-course' },
    { key: 'levelTests', ok: levelsWithoutTest.length === 0, label: 'Every listening level but the last has a published level test', detail: levelsWithoutTest.length ? `Missing: ${levelsWithoutTest.join(', ')}` : 'All levels covered', to: '/content-manager/listening-course' },
    { key: 'exercises', ok: exercises.some(published), label: 'Listening practice has published exercises', detail: `${count(exercises, published)} of ${exercises.length} exercises`, to: '/content-manager/listening' },
  ];
}

// Lessons per unit for the bars: published, draft-only and empty slots.
export function lessonsByUnit(units = []) {
  return units.map((unit) => {
    const lessons = unit.lessons || [];
    const done = count(lessons, published);
    return { id: unit.id, title: unit.title, unitPublished: unit.status === UnitStatus.PUBLISHED, total: lessons.length, published: done, unpublished: lessons.length - done };
  });
}

// Published and unpublished listening exercises per level, in level order.
export function exercisesByLevel(exercises = []) {
  return LISTENING_LEVELS.map((level) => {
    const own = exercises.filter((exercise) => exercise.level === level);
    const done = count(own, published);
    return { level, published: done, unpublished: own.length - done, total: own.length };
  });
}

// The listening course per level: topics and level test, with what is live.
// The last level has no level test ('none').
export function courseCoverage(course) {
  return COURSE_LEVELS.map((level) => {
    const entry = (course?.levels || []).find((item) => item.level === level);
    const topics = entry?.topics || [];
    return {
      level,
      topics: topics.length,
      publishedTopics: count(topics, published),
      levelTest: !COURSE_TEST_LEVELS.includes(level) ? 'none' : entry?.levelTest ? (published(entry.levelTest) ? 'published' : 'draft') : 'missing',
    };
  });
}
