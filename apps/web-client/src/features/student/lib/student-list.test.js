import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCurriculum, filterStudentMocks, nextLesson, unitProgress } from './student-list.js';

test('the learner searches, filters and sorts mock tests', () => {
  const mock = (title, level, extra = {}) => ({ id: title, title, level, recommended: false, attemptCount: 0, bestPercent: null, examType: { id: 'toeic' }, ...extra });
  const mockTests = [
    mock('Test 10', 2, { recommended: true }),
    mock('Test 2', 2, { recommended: true, attemptCount: 2, bestPercent: 71 }),
    mock('Đề số 1', 1, { attemptCount: 1, bestPercent: 88 }),
    mock('Advanced', 3, { examType: { id: 'ielts' } }),
  ];
  const base = { search: '', level: 'all', examType: 'all', taken: 'all', sort: 'recommended' };
  const titles = (options) => filterStudentMocks(mockTests, { ...base, ...options }).map((item) => item.title);
  // Recommended tests first, then by level and title.
  assert.deepEqual(titles({}), ['Test 2', 'Test 10', 'Đề số 1', 'Advanced']);
  assert.deepEqual(titles({ sort: 'level' }), ['Đề số 1', 'Test 2', 'Test 10', 'Advanced']);
  assert.deepEqual(titles({ sort: 'title-desc' }), ['Test 10', 'Test 2', 'Đề số 1', 'Advanced']);
  // Best score first; tests not taken come last.
  assert.deepEqual(titles({ sort: 'best' }), ['Đề số 1', 'Test 2', 'Advanced', 'Test 10']);
  assert.deepEqual(titles({ search: 'de so' }), ['Đề số 1']);
  assert.deepEqual(titles({ level: '2' }), ['Test 2', 'Test 10']);
  assert.deepEqual(titles({ examType: 'ielts' }), ['Advanced']);
  assert.deepEqual(titles({ taken: 'taken' }), ['Test 2', 'Đề số 1']);
  assert.deepEqual(titles({ taken: 'not-taken', level: '2' }), ['Test 10']);
  assert.equal(mockTests[0].title, 'Test 10');
});

test('the learner searches and filters lessons, keeping the learning order', () => {
  const lesson = (title, state) => ({ id: title, title, state });
  const units = [
    { id: 'u1', title: 'General Business', lessons: [lesson('Contracts', 'COMPLETED'), lesson('Marketing', 'OPEN'), lesson('Warranties', 'LOCKED')] },
    { id: 'u2', title: 'Office Issues', lessons: [lesson('Computers', 'LOCKED'), lesson('Business letters', 'LOCKED')] },
    { id: 'u3', title: 'Empty unit', lessons: [] },
  ];
  const shape = (options) => filterCurriculum(units, { search: '', state: 'all', ...options }).map((unit) => [unit.id, unit.lessons.map((item) => item.title)]);
  assert.deepEqual(shape({}), [['u1', ['Contracts', 'Marketing', 'Warranties']], ['u2', ['Computers', 'Business letters']], ['u3', []]]);
  assert.deepEqual(shape({ state: 'LOCKED' }), [['u1', ['Warranties']], ['u2', ['Computers', 'Business letters']]]);
  assert.deepEqual(shape({ state: 'OPEN' }), [['u1', ['Marketing']]]);
  // A unit title keeps all its lessons; a lesson title keeps that lesson.
  assert.deepEqual(shape({ search: 'business' }), [['u1', ['Contracts', 'Marketing', 'Warranties']], ['u2', ['Business letters']]]);
  assert.deepEqual(shape({ search: 'business', state: 'LOCKED' }), [['u1', ['Warranties']], ['u2', ['Business letters']]]);
  assert.deepEqual(shape({ search: 'nothing like this' }), []);
});

test('the next lesson to continue and the progress of a unit', () => {
  const unit = (id, states, review) => ({ id, lessons: states.map((state, index) => ({ id: `${id}-${index}`, state })), review });
  const first = unit('u1', ['COMPLETED', 'COMPLETED'], { state: 'OPEN' });
  const second = unit('u2', ['OPEN', 'LOCKED'], null);
  assert.deepEqual(unitProgress(first), { done: 2, total: 2, complete: false });
  assert.deepEqual(unitProgress({ ...first, review: { state: 'PASSED' } }), { done: 2, total: 2, complete: true });
  assert.deepEqual(unitProgress(second), { done: 0, total: 2, complete: false });
  assert.equal(nextLesson([first, second]).type, 'review');
  const after = nextLesson([{ ...first, review: { state: 'PASSED' } }, second]);
  assert.deepEqual([after.type, after.lesson.id], ['lesson', 'u2-0']);
  assert.equal(nextLesson([unit('u3', ['COMPLETED'], null)]), null);
});

