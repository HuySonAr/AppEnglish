import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, formatSeconds, queueHealth } from './system.js';

test('system figures read as short durations and queue totals', () => {
  assert.deepEqual([null, 0.0425, 2.34, 125].map(formatSeconds), ['—', '43 ms', '2.3 s', '2 min']);
  assert.deepEqual([45, 600, 7260, 90000].map(formatDuration), ['45 s', '10 min', '2 h 1 min', '1 d 1 h']);
  assert.deepEqual(queueHealth([{ kind: 'main', ready: 5 }, { kind: 'retry', ready: 2 }, { kind: 'retry', ready: 1 }, { kind: 'dead', ready: 4 }]), { retrying: 3, dead: 4 });
});
