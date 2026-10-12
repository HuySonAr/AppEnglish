import test from 'node:test';
import assert from 'node:assert/strict';
import { compareText, matchesSearch, normalizeText, paginate } from './list.js';

test('search ignores case, accents and word order', () => {
  assert.equal(normalizeText('  Hợp Đồng  '), 'hop dong');
  assert.equal(matchesSearch('Hợp đồng lao động', 'hop dong'), true);
  assert.equal(matchesSearch('General Business', 'business gen'), true);
  assert.equal(matchesSearch('General Business', 'contract'), false);
  assert.equal(matchesSearch('Anything', '   '), true);
  assert.equal(matchesSearch(null, 'x'), false);
});

test('titles sort in natural order', () => {
  assert.deepEqual(['Lesson 10', 'lesson 2', 'Ánh sáng', 'Bài 1'].sort(compareText), ['Ánh sáng', 'Bài 1', 'lesson 2', 'Lesson 10']);
});

test('pages are cut from the list and never fall off its end', () => {
  const items = Array.from({ length: 23 }, (_, index) => index + 1);
  assert.deepEqual(paginate(items, 1, 10), { items: items.slice(0, 10), page: 1, pageCount: 3, total: 23 });
  assert.deepEqual(paginate(items, 3, 10).items, [21, 22, 23]);
  // A page that no longer exists becomes the last one.
  assert.equal(paginate(items, 9, 10).page, 3);
  assert.equal(paginate(items, 0, 10).page, 1);
  assert.deepEqual(paginate([], 4, 10), { items: [], page: 1, pageCount: 1, total: 0 });
});
