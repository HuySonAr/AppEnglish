import { CourseItemState, courseBlankKey } from '@appenglish/learning-contracts';
import { compareText, matchesSearch } from '../../../lib/list.js';

// The Listening course for learners (F05C, D100–D104).

// The steps of a lesson, in order; Focus on only when the lesson has one (D109).
export const CourseStep = Object.freeze({ KEYWORDS: 'keywords', GIST: 'gist', DETAIL: 'detail', FOCUS: 'focus', CLOSE: 'close', REVIEW: 'review' });
const allSteps = [
  { key: CourseStep.KEYWORDS, label: 'Keywords' },
  { key: CourseStep.GIST, label: 'Main idea' },
  { key: CourseStep.DETAIL, label: 'Details' },
  { key: CourseStep.FOCUS, label: 'Focus on' },
  { key: CourseStep.CLOSE, label: 'Write down' },
  { key: CourseStep.REVIEW, label: 'Review' },
];
export const courseStepsOf = (hasFocus) => allSteps.filter((step) => hasFocus || step.key !== CourseStep.FOCUS);
// The step after `step` in a lesson.
export const stepAfter = (step, hasFocus) => {
  const steps = courseStepsOf(hasFocus);
  return steps[steps.findIndex((item) => item.key === step) + 1]?.key ?? null;
};

export const CourseLessonFilter = Object.freeze({ ALL: 'all', OPEN: 'open', PASSED: 'passed', LOCKED: 'locked' });
export const courseLessonFilterOptions = [
  { value: CourseLessonFilter.ALL, label: 'All lessons' },
  { value: CourseLessonFilter.OPEN, label: 'Open, not passed' },
  { value: CourseLessonFilter.PASSED, label: 'Passed' },
  { value: CourseLessonFilter.LOCKED, label: 'Locked' },
];
const filterState = {
  [CourseLessonFilter.OPEN]: CourseItemState.OPEN,
  [CourseLessonFilter.PASSED]: CourseItemState.PASSED,
  [CourseLessonFilter.LOCKED]: CourseItemState.LOCKED,
};

// The units of a level with the lessons that pass the search and the filter,
// in course order. A search matches a unit by its title (all its lessons
// stay) or single lessons by theirs; units left without a lesson are dropped
// while something is filtered.
export function filterCourseUnits(units, { search, status }) {
  const filtering = Boolean(search.trim()) || status !== CourseLessonFilter.ALL;
  const result = [];
  for (const unit of units) {
    const unitMatches = matchesSearch(unit.title, search);
    const lessons = unit.lessons.filter(
      (lesson) => (status === CourseLessonFilter.ALL || lesson.state === filterState[status]) && (unitMatches || matchesSearch(lesson.title, search)),
    );
    if (filtering && !lessons.length) continue;
    result.push({ ...unit, lessons });
  }
  return result;
}

// The level shown first: the learner's level, else (every level passed) the
// last level with units, else the first level.
export function startingLevel(course) {
  return course.currentLevel || [...course.levels].reverse().find((level) => level.units.length)?.level || course.levels[0]?.level || null;
}

// Lessons passed out of all lessons of a level.
export function levelProgress(level) {
  const lessons = level.units.flatMap((unit) => unit.lessons);
  return { passed: lessons.filter((lesson) => lesson.state === CourseItemState.PASSED).length, total: lessons.length };
}

// Where a lesson, a unit check or a level test is opened.
export const courseLessonPath = (unitId, lessonId) => `/student/listening-course/units/${unitId}/lessons/${lessonId}`;
export const courseTestPath = (itemId) => `/student/listening-course/tests/${itemId}`;

// Where the course's next item (GET /learning/listening-course `next`) is
// opened, and what it is called.
export const nextPath = (next) => (next.type === 'lesson' ? courseLessonPath(next.unitId, next.lessonId) : courseTestPath(next.itemId));
export const nextKind = { lesson: 'Next lesson', unit_check: 'Unit check', level_test: 'Level test' };

// The questions not answered yet: no option chosen, or a blank of a
// completed sentence left empty.
export const unanswered = (questions, answers) =>
  questions.filter((question) =>
    question.kind === 'complete'
      ? Array.from({ length: question.blankCount }, (_, index) => answers[courseBlankKey(question.id, index)]).some((typed) => !(typed || '').trim())
      : !answers[question.id],
  );
// The blanks of a passage with `blankCount` blanks not filled yet.
export const unfilledBlanks = (id, blankCount, answers) =>
  Array.from({ length: blankCount }, (_, index) => index).filter((index) => !answers[courseBlankKey(id, index)]);

// The mistakes notebook (D104): searched by lesson, unit or missed word,
// filtered by level and sorted.
export const MistakeSort = Object.freeze({ LATEST: 'latest', MOST: 'most', LESSON: 'lesson' });
export const mistakeSortOptions = [
  { value: MistakeSort.LATEST, label: 'Latest first' },
  { value: MistakeSort.MOST, label: 'Missed most first' },
  { value: MistakeSort.LESSON, label: 'Lesson A–Z' },
];
export function filterMistakes(mistakes, { search, level, sort }) {
  const shown = mistakes.filter(
    (mistake) =>
      (level === 'all' || mistake.level === level) &&
      matchesSearch([mistake.lessonTitle, mistake.unitTitle, ...mistake.missedWords.map((word) => word.text)].join(' '), search),
  );
  const order = {
    [MistakeSort.LATEST]: (a, b) => b.lastMissedAt.localeCompare(a.lastMissedAt),
    [MistakeSort.MOST]: (a, b) => b.timesMissed - a.timesMissed || b.lastMissedAt.localeCompare(a.lastMissedAt),
    [MistakeSort.LESSON]: (a, b) => compareText(a.lessonTitle, b.lessonTitle),
  };
  return [...shown].sort(order[sort] || order[MistakeSort.LATEST]);
}

// "coffee (you wrote “tea”)" or "please (left out)".
export const missedWordLabel = (word) => `${word.text.replace(/[^\p{L}\p{N}']+$/u, '')} (${word.typed ? `you wrote “${word.typed}”` : 'left out'})`;
