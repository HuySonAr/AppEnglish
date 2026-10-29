import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskQueue } from './task-queue.js';

const later = () => {
  let finish;
  const promise = new Promise((resolve) => (finish = resolve));
  return { promise, finish };
};

test('at most the limit runs at once and the rest wait their turn', async () => {
  const states = [];
  const queue = createTaskQueue({ limit: 2, onChange: (state) => states.push(state) });
  const jobs = { a: later(), b: later(), c: later() };
  for (const key of ['a', 'b', 'c']) queue.start(key, () => jobs[key].promise);
  assert.deepEqual(queue.snapshot(), { running: ['a', 'b'], waiting: ['c'] });
  assert.equal(queue.start('a', () => {}), false);
  jobs.a.finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(queue.snapshot(), { running: ['b', 'c'], waiting: [] });
  jobs.b.finish();
  jobs.c.finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(queue.snapshot(), { running: [], waiting: [] });
  assert.deepEqual(states.at(-1), { running: [], waiting: [] });
});

test('a failed task frees its place', async () => {
  const queue = createTaskQueue({ limit: 1 });
  queue.start('bad', () => Promise.reject(new Error('no')));
  let ran = false;
  queue.start('next', () => {
    ran = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(ran, true);
  assert.deepEqual(queue.snapshot(), { running: [], waiting: [] });
});
