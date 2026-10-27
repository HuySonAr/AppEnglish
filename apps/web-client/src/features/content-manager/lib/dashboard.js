import { LISTENING_LEVELS, UnitStatus } from '@appenglish/content-contracts';

const published = (item) => Boolean(item?.publishedVersionNumber);
const drafting = (item) => Boolean(item?.hasDraft);
const count = (items, test) => items.filter(test).length;

function tally(items) {
  return { total: items.length, published: count(items, published), drafts: count(items, drafting) };
}

export function contentSummary({ units = [], mockTests = [], exercises = [] } = {}) {
  const lessons = units.flatMap((unit) => unit.lessons || []);
  return {
    units: { total: units.length, published: count(units, (unit) => unit.status === UnitStatus.PUBLISHED) },
    lessons: tally(lessons),
    mockTests: tally(mockTests),
    exercises: tally(exercises),
  };
}

export function readinessChecks({ units = [], mockTests = [], exercises = [], placement = null } = {}) {
  const lessons = units.flatMap((unit) => unit.lessons || []);
  const emptyUnits = units.filter((unit) => unit.status === UnitStatus.PUBLISHED && !(unit.lessons || []).some(published));
  return [
    { key: 'placement', ok: Boolean(placement?.publishedVersion), label: 'Placement test published', detail: placement?.publishedVersion ? `Version ${placement.publishedVersion}` : 'New learners cannot be placed yet', to: '/content-manager/placement' },
    { key: 'lessons', ok: lessons.some(published), label: 'At least one lesson published', detail: `${count(lessons, published)} of ${lessons.length} lessons`, to: '/content-manager/units' },
    { key: 'emptyUnits', ok: emptyUnits.length === 0, label: 'Every published unit has a published lesson', detail: emptyUnits.length ? `${emptyUnits.length} unit${emptyUnits.length === 1 ? '' : 's'} with none: ${emptyUnits.map((unit) => unit.title).join(', ')}` : 'No empty unit', to: '/content-manager/units' },
    { key: 'mock', ok: mockTests.some(published), label: 'At least one mock test published', detail: `${count(mockTests, published)} of ${mockTests.length} tests`, to: '/content-manager/mock-tests' },
    { key: 'exercises', ok: exercises.some(published), label: 'Listening practice has published exercises', detail: `${count(exercises, published)} of ${exercises.length} exercises`, to: '/content-manager/listening' },
  ];
}

export function lessonsByUnit(units = []) {
  return units.map((unit) => {
    const lessons = unit.lessons || [];
    const done = count(lessons, published);
    return { id: unit.id, title: unit.title, unitPublished: unit.status === UnitStatus.PUBLISHED, total: lessons.length, published: done, unpublished: lessons.length - done };
  });
}

export function exercisesByLevel(exercises = []) {
  return LISTENING_LEVELS.map((level) => {
    const own = exercises.filter((exercise) => exercise.level === level);
    const done = count(own, published);
    return { level, published: done, unpublished: own.length - done, total: own.length };
  });
}
