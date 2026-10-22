import test from 'node:test';
import assert from 'node:assert/strict';
import { compareText, listStateFromParams, matchesSearch, normalizeText, pageRange, paginate, paramsFromListState } from './list.js';

test('a list keeps its filters and page in the URL, leaving defaults out', () => {
  const defaults = { search: '', status: 'all', stale: false };
  assert.deepEqual(listStateFromParams(new URLSearchParams(''), defaults), { filters: { search: '', status: 'all', stale: false }, page: 1 });
  assert.deepEqual(listStateFromParams(new URLSearchParams('search=hop&status=DRAFT&stale=true&page=3'), defaults), { filters: { search: 'hop', status: 'DRAFT', stale: true }, page: 3 });
  assert.equal(listStateFromParams(new URLSearchParams('page=zero'), defaults).page, 1);
  assert.equal(paramsFromListState({ filters: { search: '', status: 'all', stale: false }, page: 1 }, defaults).toString(), '');
  assert.equal(paramsFromListState({ filters: { search: 'hop', status: 'DRAFT', stale: true }, page: 2 }, defaults).toString(), 'search=hop&status=DRAFT&stale=true&page=2');
  // Params that are not the list's stay as they are.
  assert.equal(paramsFromListState({ filters: { search: '', status: 'all', stale: false }, page: 2 }, defaults, new URLSearchParams('tab=x&page=5')).toString(), 'tab=x&page=2');
});

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

test('the page bar keeps first, last and the neighbours of the current page', () => {
  assert.deepEqual(pageRange(1, 1), [1]);
  assert.deepEqual(pageRange(3, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(pageRange(1, 10), [1, 2, 3, 4, '…', 10]);
  assert.deepEqual(pageRange(3, 10), [1, 2, 3, 4, '…', 10]);
  assert.deepEqual(pageRange(5, 10), [1, '…', 4, 5, 6, '…', 10]);
  assert.deepEqual(pageRange(8, 10), [1, '…', 7, 8, 9, 10]);
  assert.deepEqual(pageRange(10, 10), [1, '…', 7, 8, 9, 10]);
  // A gap of exactly one page shows that page rather than an ellipsis.
  assert.deepEqual(pageRange(4, 20), [1, 2, 3, 4, 5, '…', 20]);
  assert.deepEqual(pageRange(99, 10), [1, '…', 7, 8, 9, 10]);
});
