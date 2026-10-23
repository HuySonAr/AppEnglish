import test from 'node:test';
import assert from 'node:assert/strict';
import { playKeyOf, playsLeft, readPlays, writePlays } from './test-plays.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)) };
}

test('plays of a test recording are counted per version and recording (D141)', () => {
  const storage = memoryStorage();
  const key = playKeyOf('v1', 's1');
  assert.equal(key, 'v1:s1');
  assert.equal(playKeyOf(null, 's1'), null);
  assert.equal(readPlays(key, storage), 0);
  writePlays(key, 1, storage);
  writePlays(playKeyOf('v1', 's2'), 2, storage);
  assert.equal(readPlays(key, storage), 1);
  assert.equal(readPlays('v1:s2', storage), 2);
  assert.equal(playsLeft(1, 2), 1);
  assert.equal(playsLeft(3, 2), 0);
  assert.equal(playsLeft(undefined, 2), 2);
  assert.equal(readPlays(key, { getItem: () => '{not json' }), 0);
  assert.doesNotThrow(() => writePlays(key, 1, { getItem: () => null, setItem: () => { throw new Error('full'); } }));
  assert.equal(readPlays(key, undefined), 0);
});
