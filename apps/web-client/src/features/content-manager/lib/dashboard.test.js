import test from 'node:test';
import assert from 'node:assert/strict';
import { contentSummary, courseCoverage, exercisesByLevel, lessonsByUnit, pendingDrafts, readinessChecks } from './dashboard.js';

const units = [
  { id: 'u1', title: 'Unit 1', status: 'PUBLISHED', lessons: [{ id: 'l1', title: 'Greetings', publishedVersionNumber: 2, hasDraft: true }, { id: 'l2', title: 'Numbers', publishedVersionNumber: null, hasDraft: true }] },
  { id: 'u2', title: 'Unit 2', status: 'PUBLISHED', lessons: [{ id: 'l3', title: 'Travel', publishedVersionNumber: null, hasDraft: false }] },
  { id: 'u3', title: 'Unit 3', status: 'DRAFT', lessons: [] },
];
const mockTests = [{ id: 'm1', title: 'Level 2 test', level: 2, publishedVersionNumber: 1, hasDraft: false }];
const exercises = [
  { id: 'e1', title: 'At the airport', level: 'A2', topic: { name: 'Travel' }, publishedVersionNumber: 1, hasDraft: false },
  { id: 'e2', title: 'Weather song', level: 'A2', topic: null, publishedVersionNumber: null, hasDraft: true },
];
const course = {
  levels: [
    { level: 'A1', topics: [{ id: 'c1', title: 'Hello', publishedVersionNumber: 1, hasDraft: false }], levelTest: { id: 't1', title: 'A1 test', publishedVersionNumber: null, hasDraft: true } },
    { level: 'A2', topics: [], levelTest: null },
    { level: 'B1', topics: [], levelTest: null },
    { level: 'B2', topics: [], levelTest: null },
    { level: 'C1', topics: [], levelTest: null },
    { level: 'C2', topics: [], levelTest: null },
  ],
};

test('the summary counts each area', () => {
  const summary = contentSummary({ units, mockTests, exercises, course });
  assert.deepEqual(summary.units, { total: 3, published: 2 });
  assert.deepEqual(summary.lessons, { total: 3, published: 1, drafts: 2 });
  assert.deepEqual(summary.mockTests, { total: 1, published: 1, drafts: 0 });
  assert.deepEqual(summary.exercises, { total: 2, published: 1, drafts: 1 });
  assert.deepEqual(summary.courseTopics, { total: 1, published: 1, drafts: 0 });
  assert.deepEqual(summary.levelTests, { total: 1, published: 0, drafts: 1 });
  assert.equal(contentSummary().lessons.total, 0);
});

test('pending drafts come unpublished first, each with its editor path', () => {
  const rows = pendingDrafts({ units, mockTests, exercises, course });
  assert.deepEqual(rows.map((row) => [row.kind, row.title, row.published]), [
    ['Lesson', 'Numbers', false],
    ['Level test', 'A1 test', false],
    ['Listening exercise', 'Weather song', false],
    ['Lesson', 'Greetings', true],
  ]);
  assert.equal(rows[0].to, '/content-manager/lessons/l2');
  assert.equal(rows[1].to, '/content-manager/listening-course/t1');
  assert.equal(rows[2].context, 'A2');
});

test('readiness checks say what learners are missing', () => {
  const checks = readinessChecks({ units, mockTests, exercises, course, placement: { publishedVersion: null } });
  assert.deepEqual(Object.fromEntries(checks.map((check) => [check.key, check.ok])), {
    placement: false,
    lessons: true,
    emptyUnits: false,
    mock: true,
    courseLevels: false,
    levelTests: false,
    exercises: true,
  });
  assert.match(checks.find((check) => check.key === 'emptyUnits').detail, /Unit 2/);
  assert.match(checks.find((check) => check.key === 'courseLevels').detail, /A2, B1, B2, C1, C2/);
  assert.equal(readinessChecks({ placement: { publishedVersion: 3 } })[0].detail, 'Version 3');
});

test('chart data per unit, per level and per course level', () => {
  assert.deepEqual(lessonsByUnit(units).map((row) => [row.title, row.published, row.unpublished, row.unitPublished]), [['Unit 1', 1, 1, true], ['Unit 2', 0, 1, true], ['Unit 3', 0, 0, false]]);
  const byLevel = exercisesByLevel(exercises);
  assert.equal(byLevel.length, 6);
  assert.deepEqual(byLevel[1], { level: 'A2', published: 1, unpublished: 1, total: 2 });
  assert.deepEqual(courseCoverage(course).slice(0, 2), [
    { level: 'A1', topics: 1, publishedTopics: 1, levelTest: 'draft' },
    { level: 'A2', topics: 0, publishedTopics: 0, levelTest: 'missing' },
  ]);
  assert.equal(courseCoverage(null).length, 6);
  // The last level has no level test (D145).
  assert.equal(courseCoverage(course)[5].levelTest, 'none');
});
