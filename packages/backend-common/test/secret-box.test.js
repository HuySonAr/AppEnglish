import test from 'node:test';
import assert from 'node:assert/strict';
import { open, seal } from '../src/secret-box.js';

const secret = 'x'.repeat(40);

test('a sealed value opens only with the same secret and is not readable', () => {
  const box = seal('AIzaSyExampleKey123456', secret);
  assert.equal(JSON.stringify(box).includes('AIzaSy'), false);
  assert.equal(open(box, secret), 'AIzaSyExampleKey123456');
  assert.notEqual(seal('same', secret).iv, seal('same', secret).iv);
  assert.throws(() => open(box, 'y'.repeat(40)));
  assert.throws(() => open({ ...box, data: Buffer.from('tampered').toString('base64') }, secret));
  assert.throws(() => seal('a', 'short'));
});
