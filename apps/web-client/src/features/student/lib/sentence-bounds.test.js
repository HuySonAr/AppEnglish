import test from 'node:test';
import assert from 'node:assert/strict';
import { sentenceBounds } from '../hooks/use-wave-peaks.js';

const rate = 1000;
const piece = (seconds, loud) => Array.from({ length: Math.round(seconds * rate) }, (_, at) => (loud ? Math.sin(at) * 0.5 : 0));

test('sentence ends come from the longest pauses in the recording', () => {
  const samples = Float32Array.from([...piece(0.3, false), ...piece(1.2, true), ...piece(0.1, false), ...piece(0.8, true), ...piece(0.5, false), ...piece(1, true), ...piece(0.4, false), ...piece(0.6, true), ...piece(0.3, false)]);
  const bounds = sentenceBounds(samples, rate, 3);
  assert.equal(bounds.length, 3);
  assert.ok(Math.abs(bounds[0] - 2.65) < 0.05, String(bounds[0]));
  assert.ok(Math.abs(bounds[1] - 4.1) < 0.05, String(bounds[1]));
  assert.equal(bounds[2], Infinity);
  assert.equal(sentenceBounds(samples, rate, 6), null);
  assert.equal(sentenceBounds(new Float32Array(500), rate, 2), null);
});
