import test from 'node:test';
import assert from 'node:assert/strict';
import { contentSummary, exercisesByLevel, lessonsByUnit, readinessChecks } from './dashboard.js';

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

test('the summary counts each area', () => {
  const summary = contentSummary({ units, mockTests, exercises });
  assert.deepEqual(summary.units, { total: 3, published: 2 });
  assert.deepEqual(summary.lessons, { total: 3, published: 1, drafts: 2 });
  assert.deepEqual(summary.mockTests, { total: 1, published: 1, drafts: 0 });
  assert.deepEqual(summary.exercises, { total: 2, published: 1, drafts: 1 });
  assert.equal(contentSummary().lessons.total, 0);
});

test('readiness checks say what learners are missing', () => {
  const checks = readinessChecks({ units, mockTests, exercises, placement: { publishedVersion: null } });
  assert.deepEqual(Object.fromEntries(checks.map((check) => [check.key, check.ok])), {
    placement: false,
    lessons: true,
    emptyUnits: false,
    mock: true,
    exercises: true,
  });
  assert.match(checks.find((check) => check.key === 'emptyUnits').detail, /Unit 2/);
  assert.equal(readinessChecks({ placement: { publishedVersion: 3 } })[0].detail, 'Version 3');
});

test('chart data per unit and per level', () => {
  assert.deepEqual(lessonsByUnit(units).map((row) => [row.title, row.published, row.unpublished, row.unitPublished]), [['Unit 1', 1, 1, true], ['Unit 2', 0, 1, true], ['Unit 3', 0, 0, false]]);
  const byLevel = exercisesByLevel(exercises);
  assert.equal(byLevel.length, 6);
  assert.deepEqual(byLevel[1], { level: 'A2', published: 1, unpublished: 1, total: 2 });
});
