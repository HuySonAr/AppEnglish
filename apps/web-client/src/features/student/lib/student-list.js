import { LessonState, UnitReviewState } from '@appenglish/learning-contracts';
import { compareText, matchesSearch } from '../../../lib/list.js';

export const MockListSort = Object.freeze({
  RECOMMENDED: 'recommended',
  LEVEL: 'level',
  TITLE_ASC: 'title-asc',
  TITLE_DESC: 'title-desc',
  BEST: 'best',
});
export const mockListSortOptions = [
  { value: MockListSort.RECOMMENDED, label: 'Recommended first' },
  { value: MockListSort.LEVEL, label: 'Level, then title' },
  { value: MockListSort.TITLE_ASC, label: 'Title A–Z' },
  { value: MockListSort.TITLE_DESC, label: 'Title Z–A' },
  { value: MockListSort.BEST, label: 'My best score' },
];

// The learner's mock-test list. level and examType are 'all' or a value as
// text; taken is 'all', 'taken' or 'not-taken' (in full).
export function filterStudentMocks(mockTests, { search, level, examType, taken, sort }) {
  const byTitle = (a, b) => compareText(a.title, b.title);
  const byLevel = (a, b) => a.level - b.level || byTitle(a, b);
  const compare = {
    [MockListSort.RECOMMENDED]: (a, b) => Number(b.recommended) - Number(a.recommended) || byLevel(a, b),
    [MockListSort.LEVEL]: byLevel,
    [MockListSort.TITLE_ASC]: byTitle,
    [MockListSort.TITLE_DESC]: (a, b) => byTitle(b, a),
    // Tests not taken yet come last.
    [MockListSort.BEST]: (a, b) => (b.bestPercent ?? -1) - (a.bestPercent ?? -1) || byTitle(a, b),
  }[sort];
  return mockTests
    .filter(
      (mockTest) =>
        matchesSearch(mockTest.title, search) &&
        (level === 'all' || mockTest.level === Number(level)) &&
        (examType === 'all' || mockTest.examType?.id === examType) &&
        (taken === 'all' || (taken === 'taken') === mockTest.attemptCount > 0),
    )
    .sort(compare);
}

export const lessonStateOptions = [
  { value: 'all', label: 'All lessons' },
  { value: LessonState.OPEN, label: 'Open' },
  { value: LessonState.COMPLETED, label: 'Completed' },
  { value: LessonState.LOCKED, label: 'Locked' },
];

// The learner's units with the lessons that pass the search and the state
// filter, in learning order. A search matches a unit by its title (all its
// lessons stay) or single lessons by theirs; units left without a lesson are
// dropped while something is filtered.
export function filterCurriculum(units, { search, state }) {
  const filtering = Boolean(search.trim()) || state !== 'all';
  const result = [];
  for (const unit of units) {
    const unitMatches = matchesSearch(unit.title, search);
    const lessons = unit.lessons.filter(
      (lesson) => (state === 'all' || lesson.state === state) && (unitMatches || matchesSearch(lesson.title, search)),
    );
    if (filtering && !lessons.length) continue;
    result.push({ ...unit, lessons });
  }
  return result;
}

export function unitProgress(unit) {
  const done = unit.lessons.filter((lesson) => lesson.state === LessonState.COMPLETED).length;
  const reviewPassed = !unit.review || unit.review.state === UnitReviewState.PASSED;
  return { done, total: unit.lessons.length, complete: unit.lessons.length > 0 && done === unit.lessons.length && reviewPassed };
}

export function nextLesson(units) {
  for (const unit of units) {
    const lesson = unit.lessons.find((item) => item.state === LessonState.OPEN);
    if (lesson) return { type: 'lesson', unit, lesson };
    if (unit.review?.state === UnitReviewState.OPEN) return { type: 'review', unit };
  }
  return null;
}

