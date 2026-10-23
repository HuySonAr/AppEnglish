import { compareText, matchesSearch } from '../../../lib/list.js';

export const StatusFilter = Object.freeze({
  ALL: 'all',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
  DRAFT: 'draft',
});

export const statusOptions = [
  { value: StatusFilter.ALL, label: 'All statuses' },
  { value: StatusFilter.PUBLISHED, label: 'Published' },
  { value: StatusFilter.UNPUBLISHED, label: 'Not published' },
  { value: StatusFilter.DRAFT, label: 'Has a draft' },
];

function hasStatus(item, status) {
  if (status === StatusFilter.PUBLISHED) return Boolean(item.publishedVersionNumber);
  if (status === StatusFilter.UNPUBLISHED) return !item.publishedVersionNumber;
  if (status === StatusFilter.DRAFT) return Boolean(item.hasDraft);
  return true;
}

export const LessonSort = Object.freeze({ ORDER: 'order', TITLE_ASC: 'title-asc', TITLE_DESC: 'title-desc' });
export const lessonSortOptions = [
  { value: LessonSort.ORDER, label: 'Learning order' },
  { value: LessonSort.TITLE_ASC, label: 'Title A–Z' },
  { value: LessonSort.TITLE_DESC, label: 'Title Z–A' },
];

export function isReorderable({ search, status, sort }) {
  return !search.trim() && status === StatusFilter.ALL && sort === LessonSort.ORDER;
}

export function filterUnits(units, { search, status, sort }) {
  const filtering = Boolean(search.trim()) || status !== StatusFilter.ALL;
  const order = sort === LessonSort.ORDER ? null : sort === LessonSort.TITLE_ASC ? 1 : -1;
  const result = [];
  for (const unit of units) {
    const unitMatches = matchesSearch(unit.title, search);
    const lessons = unit.lessons.filter(
      (lesson) => hasStatus(lesson, status) && (unitMatches || matchesSearch(lesson.title, search)),
    );
    if (filtering && !lessons.length && !(unitMatches && status === StatusFilter.ALL)) continue;
    result.push({
      ...unit,
      lessons: order ? [...lessons].sort((a, b) => order * compareText(a.title, b.title)) : lessons,
      lessonCount: unit.lessons.length,
      publishedCount: unit.lessons.filter((lesson) => lesson.publishedVersionNumber).length,
    });
  }
  return order ? result.sort((a, b) => order * compareText(a.title, b.title)) : result;
}

export const MockSort = Object.freeze({
  LEVEL: 'level',
  TITLE_ASC: 'title-asc',
  TITLE_DESC: 'title-desc',
  NEWEST: 'newest',
  OLDEST: 'oldest',
});
export const mockSortOptions = [
  { value: MockSort.LEVEL, label: 'Level, then title' },
  { value: MockSort.TITLE_ASC, label: 'Title A–Z' },
  { value: MockSort.TITLE_DESC, label: 'Title Z–A' },
  { value: MockSort.NEWEST, label: 'Newest first' },
  { value: MockSort.OLDEST, label: 'Oldest first' },
];

export function filterMockTests(mockTests, { search, level, status, sort, examType = 'all' }) {
  const byTitle = (a, b) => compareText(a.title, b.title);
  const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
  const compare = {
    [MockSort.LEVEL]: (a, b) => a.level - b.level || byTitle(a, b),
    [MockSort.TITLE_ASC]: byTitle,
    [MockSort.TITLE_DESC]: (a, b) => byTitle(b, a),
    [MockSort.NEWEST]: (a, b) => byDate(b, a),
    [MockSort.OLDEST]: byDate,
  }[sort];
  return mockTests
    .filter(
      (mockTest) =>
        matchesSearch(mockTest.title, search) &&
        (level === 'all' || mockTest.level === Number(level)) &&
        (examType === 'all' || mockTest.examType?.id === examType) &&
        hasStatus(mockTest, status),
    )
    .sort(compare);
}

export const ListeningSort = Object.freeze({
  TITLE_ASC: 'title-asc',
  TITLE_DESC: 'title-desc',
  LEVEL: 'level',
  NEWEST: 'newest',
  OLDEST: 'oldest',
});
export const listeningSortOptions = [
  { value: ListeningSort.NEWEST, label: 'Newest first' },
  { value: ListeningSort.OLDEST, label: 'Oldest first' },
  { value: ListeningSort.LEVEL, label: 'Level, then title' },
  { value: ListeningSort.TITLE_ASC, label: 'Title A–Z' },
  { value: ListeningSort.TITLE_DESC, label: 'Title Z–A' },
];

export function filterListeningExercises(exercises, { search, topic, level, kind, status, sort }) {
  const byTitle = (a, b) => compareText(a.title, b.title);
  const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
  const compare = {
    [ListeningSort.LEVEL]: (a, b) => compareText(a.level, b.level) || byTitle(a, b),
    [ListeningSort.TITLE_ASC]: byTitle,
    [ListeningSort.TITLE_DESC]: (a, b) => byTitle(b, a),
    [ListeningSort.NEWEST]: (a, b) => byDate(b, a),
    [ListeningSort.OLDEST]: byDate,
  }[sort];
  return exercises
    .filter(
      (exercise) =>
        matchesSearch(exercise.title, search) &&
        (topic === 'all' || exercise.topic?.id === topic) &&
        (level === 'all' || exercise.level === level) &&
        (kind === 'all' || exercise.kind === kind) &&
        hasStatus(exercise, status),
    )
    .sort(compare);
}
