import { AccountRole } from '@appenglish/auth-contracts';
import { ContentReviewKind, LessonVersionStatus, PLACEMENT_REVIEW_ID } from '@appenglish/content-contracts';
import { compareText, matchesSearch } from '../../../lib/list.js';

export const TEACHER_BASE = '/teacher';
export const MANAGER_BASE = '/content-manager';

export function contentAreaFor(role) {
  if (role === AccountRole.TEACHER) return { base: TEACHER_BASE, eyebrow: 'Teacher', canAuthor: true, canManage: false };
  if (role === AccountRole.CONTENT_MANAGER) return { base: MANAGER_BASE, eyebrow: 'Content Manager', canAuthor: false, canManage: true };
  return { base: MANAGER_BASE, eyebrow: 'Content', canAuthor: false, canManage: false };
}

export const reviewStatusInfo = Object.freeze({
  [LessonVersionStatus.DRAFT]: { label: 'Draft', variant: 'warning' },
  [LessonVersionStatus.PENDING_REVIEW]: { label: 'In review', variant: 'info' },
  [LessonVersionStatus.RETURNED]: { label: 'Returned', variant: 'destructive' },
});

export const reviewKindLabels = Object.freeze({
  [ContentReviewKind.LESSON]: 'Lesson',
  [ContentReviewKind.UNIT_REVIEW]: 'Unit review',
  [ContentReviewKind.PLACEMENT]: 'Placement test',
  [ContentReviewKind.MOCK_TEST]: 'Mock test',
  [ContentReviewKind.LISTENING_EXERCISE]: 'Listening exercise',
  [ContentReviewKind.SW_TEST]: 'S&W test',
});

export function contentItemPath(base, kind, id) {
  if (kind === ContentReviewKind.LESSON) return `${base}/lessons/${id}`;
  if (kind === ContentReviewKind.UNIT_REVIEW) return `${base}/units/${id}/review`;
  if (kind === ContentReviewKind.PLACEMENT) return `${base}/placement`;
  if (kind === ContentReviewKind.MOCK_TEST) return `${base}/mock-tests/${id}`;
  if (kind === ContentReviewKind.LISTENING_EXERCISE) return `${base}/listening/${id}`;
  if (kind === ContentReviewKind.SW_TEST) return `${base}/sw-tests/${id}`;
  return base;
}

export const reviewIdOf = (kind, id) => (kind === ContentReviewKind.PLACEMENT ? PLACEMENT_REVIEW_ID : id);

export const reviewTitle = (item) => item.title || reviewKindLabels[item.kind] || 'Untitled';

export function reviewReasonMessage(reason) {
  if (reason === 'PENDING_REVIEW') return 'It is waiting for review. Withdraw it first to change it.';
  if (reason === 'NOT_IN_REVIEW') return 'It is no longer waiting for review. Reload to see its state.';
  if (reason === 'PUBLISHED_BEFORE') return 'It was published before, so only a Content Manager can delete it.';
  if (reason === 'PUBLISHED') return 'Unpublish it first, then delete it.';
  return null;
}

export const ReviewTab = Object.freeze({ WAITING: 'waiting', RETURNED: 'returned', DRAFTS: 'drafts' });
export const reviewTabStatus = Object.freeze({
  [ReviewTab.WAITING]: LessonVersionStatus.PENDING_REVIEW,
  [ReviewTab.RETURNED]: LessonVersionStatus.RETURNED,
  [ReviewTab.DRAFTS]: LessonVersionStatus.DRAFT,
});
export const ReviewSort = Object.freeze({ NEWEST: 'newest', OLDEST: 'oldest' });
export const reviewSortOptions = [
  { value: ReviewSort.NEWEST, label: 'Newest first' },
  { value: ReviewSort.OLDEST, label: 'Oldest first' },
];

export function reviewDateOf(item) {
  if (item.status === LessonVersionStatus.PENDING_REVIEW) return item.submittedAt || item.updatedAt;
  if (item.status === LessonVersionStatus.RETURNED) return item.reviewedAt || item.updatedAt;
  return item.updatedAt;
}

const byDate = (a, b) => String(reviewDateOf(a) || '').localeCompare(String(reviewDateOf(b) || ''));

export function reviewTabCounts(items) {
  return Object.fromEntries(Object.entries(reviewTabStatus).map(([tab, status]) => [tab, items.filter((item) => item.status === status).length]));
}

export function filterReviews(items, { tab, search, sort }) {
  const status = reviewTabStatus[tab] || reviewTabStatus[ReviewTab.WAITING];
  const direction = sort === ReviewSort.OLDEST ? 1 : -1;
  return items
    .filter((item) => item.status === status && (matchesSearch(reviewTitle(item), search) || matchesSearch(item.context || '', search)))
    .sort((a, b) => direction * byDate(a, b) || compareText(reviewTitle(a), reviewTitle(b)));
}

const progressOrder = {
  [LessonVersionStatus.RETURNED]: 0,
  [LessonVersionStatus.DRAFT]: 1,
  [LessonVersionStatus.PENDING_REVIEW]: 2,
};

export function contentInProgress(items, limit = 5) {
  return items
    .filter((item) => item.status in progressOrder)
    .sort((a, b) => progressOrder[a.status] - progressOrder[b.status] || -byDate(a, b))
    .slice(0, limit);
}
