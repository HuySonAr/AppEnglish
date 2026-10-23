import test from 'node:test';
import assert from 'node:assert/strict';
import { cefrLabel, productiveDetail, receptiveDetail } from './cefr.js';

test('CEFR levels and their reasons read in one short line', () => {
  assert.deepEqual(['B1', 'BELOW_A1', null].map(cefrLabel), ['B1', 'Below A1', '—']);
  assert.deepEqual(receptiveDetail({ level: 'B2', score: 405 }), { text: 'From your full mock test: 405/495', to: null });
  assert.equal(receptiveDetail({ level: null }).to, '/student/mock-tests');
  const options = { noun: 'answers', to: '/student/practice/speaking' };
  assert.equal(productiveDetail({ level: 'B1', needed: 3, levels: [{ level: 'B1', considered: 5, passed: 4 }] }, options).text, '4 of your last 5 B1 answers passed');
  assert.deepEqual(productiveDetail({ level: null, needed: 3, levels: [{ level: 'A2', considered: 2, passed: 1 }, { level: 'B1', considered: 3, passed: 2 }] }, options), { text: '2/3 B1 answers passed so far', to: '/student/practice/speaking' });
  assert.equal(productiveDetail({ level: null, needed: 3, levels: [] }, options).text, 'Pass 3 answers at one level');
});
