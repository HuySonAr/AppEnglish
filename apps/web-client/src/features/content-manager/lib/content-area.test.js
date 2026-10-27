import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReviewSort,
  ReviewTab,
  contentAreaFor,
  contentInProgress,
  contentItemPath,
  filterReviews,
  reviewIdOf,
  reviewReasonMessage,
  reviewTabCounts,
  reviewTitle,
} from './content-area.js';

test('the signed-in role picks the content area and what it may do', () => {
  assert.deepEqual(contentAreaFor('TEACHER'), { base: '/teacher', eyebrow: 'Teacher', canAuthor: true, canManage: false });
  assert.deepEqual(contentAreaFor('CONTENT_MANAGER'), { base: '/content-manager', eyebrow: 'Content Manager', canAuthor: false, canManage: true });
  assert.equal(contentAreaFor('STUDENT').canAuthor, false);
  assert.equal(contentAreaFor('STUDENT').canManage, false);
});

test('each review kind links to its page inside the area', () => {
  assert.equal(contentItemPath('/teacher', 'lesson', 'l1'), '/teacher/lessons/l1');
  assert.equal(contentItemPath('/content-manager', 'unitReview', 'u1'), '/content-manager/units/u1/review');
  assert.equal(contentItemPath('/teacher', 'placement', 'main'), '/teacher/placement');
  assert.equal(contentItemPath('/teacher', 'mockTest', 'm1'), '/teacher/mock-tests/m1');
  assert.equal(contentItemPath('/content-manager', 'listeningExercise', 'e1'), '/content-manager/listening/e1');
  assert.equal(contentItemPath('/teacher', 'swTest', 's1'), '/teacher/sw-tests/s1');
  assert.equal(reviewIdOf('placement', undefined), 'main');
  assert.equal(reviewIdOf('lesson', 'l1'), 'l1');
  assert.equal(reviewTitle({ kind: 'placement', title: '' }), 'Placement test');
});

test('refusal reasons read as plain sentences', () => {
  assert.match(reviewReasonMessage('PENDING_REVIEW'), /Withdraw/);
  assert.match(reviewReasonMessage('PUBLISHED_BEFORE'), /Content Manager/);
  assert.equal(reviewReasonMessage('OTHER'), null);
});

const items = [
  { kind: 'lesson', id: 'l1', title: 'Airport', context: 'Travel', status: 'PENDING_REVIEW', submittedAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z' },
  { kind: 'mockTest', id: 'm1', title: 'Mock 1', context: '', status: 'PENDING_REVIEW', submittedAt: '2026-10-22T10:00:00Z', updatedAt: '2026-10-22T10:00:00Z' },
  { kind: 'lesson', id: 'l2', title: 'Hotel', context: 'Travel', status: 'RETURNED', reviewedAt: '2026-10-21T10:00:00Z', updatedAt: '2026-10-19T10:00:00Z' },
  { kind: 'placement', id: 'main', title: '', context: '', status: 'DRAFT', updatedAt: '2026-10-23T10:00:00Z' },
  { kind: 'listeningExercise', id: 'e1', title: 'Song', context: '', status: 'DRAFT', updatedAt: '2026-10-18T10:00:00Z' },
];

test('the review queue splits by status, searches and sorts by date', () => {
  assert.deepEqual(reviewTabCounts(items), { waiting: 2, returned: 1, drafts: 2 });
  const waiting = filterReviews(items, { tab: ReviewTab.WAITING, search: '', sort: ReviewSort.NEWEST });
  assert.deepEqual(waiting.map((item) => item.id), ['m1', 'l1']);
  assert.deepEqual(filterReviews(items, { tab: ReviewTab.WAITING, search: '', sort: ReviewSort.OLDEST }).map((item) => item.id), ['l1', 'm1']);
  assert.deepEqual(filterReviews(items, { tab: ReviewTab.WAITING, search: 'travel', sort: ReviewSort.NEWEST }).map((item) => item.id), ['l1']);
  assert.deepEqual(filterReviews(items, { tab: ReviewTab.DRAFTS, search: 'placement', sort: ReviewSort.NEWEST }).map((item) => item.id), ['main']);
});

test('content in progress shows returned work first, then drafts, then what is in review', () => {
  assert.deepEqual(contentInProgress(items).map((item) => item.id), ['l2', 'main', 'e1', 'm1', 'l1']);
  assert.deepEqual(contentInProgress(items, 2).map((item) => item.id), ['l2', 'main']);
});
