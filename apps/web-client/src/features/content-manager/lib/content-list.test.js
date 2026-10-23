import test from 'node:test';
import assert from 'node:assert/strict';
import { filterListeningExercises, filterMockTests, filterUnits, isReorderable } from './content-list.js';

const lesson = (title, publishedVersionNumber = null, hasDraft = false) => ({ id: title, title, publishedVersionNumber, hasDraft });
const units = [
  { id: 'u1', title: 'General Business', lessons: [lesson('Contracts', 1), lesson('Marketing', null, true), lesson('Warranties', 2, true)] },
  { id: 'u2', title: 'Office Issues', lessons: [lesson('Computers'), lesson('Business letters', 1)] },
  { id: 'u3', title: 'Empty unit', lessons: [] },
];
const all = { search: '', status: 'all', sort: 'order' };
const shape = (result) => result.map((unit) => [unit.id, unit.lessons.map((item) => item.title)]);

test('without filters every unit and lesson is listed in its order', () => {
  const result = filterUnits(units, all);
  assert.deepEqual(shape(result), [['u1', ['Contracts', 'Marketing', 'Warranties']], ['u2', ['Computers', 'Business letters']], ['u3', []]]);
  assert.deepEqual(result.map((unit) => [unit.lessonCount, unit.publishedCount]), [[3, 2], [2, 1], [0, 0]]);
  assert.equal(isReorderable(all), true);
});

test('search finds units by title and lessons by title', () => {
  assert.deepEqual(shape(filterUnits(units, { ...all, search: 'business' })), [['u1', ['Contracts', 'Marketing', 'Warranties']], ['u2', ['Business letters']]]);
  assert.deepEqual(shape(filterUnits(units, { ...all, search: 'contr' })), [['u1', ['Contracts']]]);
  assert.deepEqual(shape(filterUnits(units, { ...all, search: 'empty' })), [['u3', []]]);
  assert.deepEqual(filterUnits(units, { ...all, search: 'nothing like this' }), []);
  assert.equal(isReorderable({ ...all, search: 'x' }), false);
});

test('the status filter keeps matching lessons and drops units without any', () => {
  assert.deepEqual(shape(filterUnits(units, { ...all, status: 'published' })), [['u1', ['Contracts', 'Warranties']], ['u2', ['Business letters']]]);
  assert.deepEqual(shape(filterUnits(units, { ...all, status: 'unpublished' })), [['u1', ['Marketing']], ['u2', ['Computers']]]);
  assert.deepEqual(shape(filterUnits(units, { ...all, status: 'draft' })), [['u1', ['Marketing', 'Warranties']]]);
  assert.deepEqual(filterUnits(units, { ...all, status: 'draft' }).map((unit) => [unit.lessonCount, unit.publishedCount]), [[3, 2]]);
  assert.equal(isReorderable({ ...all, status: 'draft' }), false);
});

test('sorting by title sorts units and their lessons', () => {
  assert.deepEqual(shape(filterUnits(units, { ...all, sort: 'title-desc' })), [['u2', ['Computers', 'Business letters']], ['u1', ['Warranties', 'Marketing', 'Contracts']], ['u3', []]]);
  assert.deepEqual(shape(filterUnits(units, { ...all, sort: 'title-asc' }))[0], ['u3', []]);
  assert.equal(isReorderable({ ...all, sort: 'title-asc' }), false);
  assert.deepEqual(units[0].lessons.map((item) => item.title), ['Contracts', 'Marketing', 'Warranties']);
});

test('mock tests are searched, filtered and sorted', () => {
  const mock = (title, level, createdAt, publishedVersionNumber = null, hasDraft = false) => ({ id: title, title, level, createdAt, publishedVersionNumber, hasDraft });
  const mockTests = [
    mock('Test 10', 2, '2026-10-03', 1),
    mock('Test 2', 2, '2026-10-01', null, true),
    mock('Đề số 1', 1, '2026-10-02', 3, true),
    mock('Advanced', 3, '2026-10-04'),
  ];
  const base = { search: '', level: 'all', status: 'all', sort: 'level' };
  const titles = (options) => filterMockTests(mockTests, { ...base, ...options }).map((item) => item.title);
  assert.deepEqual(titles({}), ['Đề số 1', 'Test 2', 'Test 10', 'Advanced']);
  assert.deepEqual(titles({ sort: 'title-desc' }), ['Test 10', 'Test 2', 'Đề số 1', 'Advanced']);
  assert.deepEqual(titles({ sort: 'newest' }), ['Advanced', 'Test 10', 'Đề số 1', 'Test 2']);
  assert.deepEqual(titles({ sort: 'oldest' })[0], 'Test 2');
  assert.deepEqual(titles({ search: 'de so' }), ['Đề số 1']);
  assert.deepEqual(titles({ level: '2' }), ['Test 2', 'Test 10']);
  assert.deepEqual(titles({ status: 'published' }), ['Đề số 1', 'Test 10']);
  assert.deepEqual(titles({ status: 'draft', level: '2' }), ['Test 2']);
  assert.deepEqual(titles({ search: 'test', status: 'unpublished' }), ['Test 2']);
  mockTests[0].examType = { id: 'toeic' };
  mockTests[3].examType = { id: 'ielts' };
  assert.deepEqual(titles({ examType: 'ielts' }), ['Advanced']);
  assert.deepEqual(titles({ examType: 'toeic', level: '2' }), ['Test 10']);
  assert.equal(titles({ examType: 'all' }).length, 4);
  assert.equal(mockTests[0].title, 'Test 10');
});

test('listening exercises are searched, filtered by topic, level, part and status, and sorted', () => {
  const exercises = [
    { title: 'Airport', topic: { id: 't1' }, level: 'B1', kind: 'part3', publishedVersionNumber: 1, hasDraft: false, createdAt: '2026-10-01' },
    { title: 'Office talk', topic: { id: 't1' }, level: 'A2', kind: 'part4', publishedVersionNumber: null, hasDraft: true, createdAt: '2026-10-03' },
    { title: 'Photo', topic: { id: 't2' }, level: 'A2', kind: 'part1', publishedVersionNumber: 2, hasDraft: true, createdAt: '2026-10-02' },
  ];
  const base = { search: '', topic: 'all', level: 'all', kind: 'all', status: 'all', sort: 'newest' };
  const titles = (options) => filterListeningExercises(exercises, { ...base, ...options }).map((item) => item.title);
  assert.deepEqual(titles({}), ['Office talk', 'Photo', 'Airport']);
  assert.deepEqual(titles({ sort: 'level' }), ['Office talk', 'Photo', 'Airport']);
  assert.deepEqual(titles({ search: 'office', topic: 't1' }), ['Office talk']);
  assert.deepEqual(titles({ level: 'A2', status: 'published' }), ['Photo']);
  assert.deepEqual(titles({ kind: 'part3' }), ['Airport']);
  assert.deepEqual(titles({ status: 'draft', sort: 'title-desc' }), ['Photo', 'Office talk']);
});
