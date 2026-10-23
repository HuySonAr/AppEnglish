import { AccountRole } from '@appenglish/auth-contracts';
import { NotificationKind } from '@appenglish/progress-contracts';

const ownerPaths = {
  exercise: (id) => `/content-manager/listening/${id}`,
  courseItem: (id) => `/content-manager/listening-course/${id}`,
  mockTest: (id) => `/content-manager/mock-tests/${id}`,
};

const sourcesByRole = {
  [AccountRole.STUDENT]: ['progress'],
  [AccountRole.CONTENT_MANAGER]: ['content'],
  [AccountRole.ADMIN]: ['auth-admin', 'content-admin'],
};
const unpublishedNames = { unit: 'Unit', unitReview: 'Unit review', lesson: 'Lesson', mockTest: 'Mock test', exercise: 'Listening exercise', courseItem: 'Listening course item' };

export const notificationSources = (role) => sourcesByRole[role] || [];

export function mergeNotifications(results) {
  return {
    notifications: results
      .flatMap(({ source, data }) => data.notifications.map((item) => ({ ...item, source })))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    unread: results.reduce((sum, { data }) => sum + data.unread, 0),
  };
}

export function describeNotification({ kind, data }) {
  if (kind === NotificationKind.MOCK_RESULT) {
    const change = data.change ? ` (${data.change > 0 ? '+' : ''}${data.change})` : '';
    return {
      tone: data.change < 0 ? 'warning' : 'success',
      title: data.total === null ? `${data.mockTestTitle || 'Mock test'} submitted` : `Full test scored ${data.total} / 990${change}`,
      detail: `${data.mockTestTitle || 'Mock test'} · attempt ${data.attemptNumber}`,
      to: `/student/mock-tests/${data.mockTestId}/history?attempt=${data.attemptNumber}`,
    };
  }
  if (kind === NotificationKind.UNIT_OPENED)
    return {
      tone: 'success',
      title: data.nextUnitTitle ? `${data.nextUnitTitle} is open` : `${data.unitTitle} review passed`,
      detail: `You passed the review of ${data.unitTitle}.`,
      to: '/student/lessons',
    };
  if (kind === NotificationKind.COURSE_LEVEL_UP)
    return { tone: 'success', title: `You reached ${data.to} in the Listening course`, detail: `${data.from} level test passed.`, to: '/student/listening-course' };
  if (kind === NotificationKind.STREAK_REMINDER)
    return { tone: 'warning', title: `Study today to keep your ${data.streak}-day streak`, detail: 'One short lesson is enough.', to: '/student' };
  if (kind === 'SPEECH_JOB') {
    const task = data.task === 'transcribe' ? 'Transcribe' : 'Auto-time';
    const failed = data.status === 'FAILED';
    return {
      tone: failed ? 'destructive' : 'success',
      title: `${task} ${failed ? 'failed' : 'finished'}${data.owner.title ? ` · ${data.owner.title}` : ''}`,
      detail: failed ? data.error || 'Try again later.' : 'Open the editor to check and apply it.',
      to: ownerPaths[data.owner.type]?.(data.owner.id) || '/content-manager',
    };
  }
  if (kind === 'NEW_LEARNERS') {
    const change = data.change ? ` (${data.change > 0 ? '+' : ''}${data.change} on the week before)` : '';
    return { tone: 'info', title: `${data.newLearners} new learner${data.newLearners === 1 ? '' : 's'} last week${change}`, detail: `${data.weekStart} to ${data.weekEnd}`, to: '/admin/accounts' };
  }
  if (kind === 'CONTENT_UNPUBLISHED')
    return {
      tone: 'warning',
      title: `${unpublishedNames[data.type] || 'Content'} unpublished${data.title ? `: ${data.title}` : ''}`,
      detail: 'Learners no longer see it.',
      to: null,
    };
  if (kind === 'SPEECH_FAILURES')
    return { tone: 'destructive', title: `${data.count} speech job${data.count === 1 ? '' : 's'} failed on ${data.day}`, detail: data.lastError || 'Check the speech service and RabbitMQ.', to: null };
  return { tone: 'info', title: 'Notification', detail: '', to: null };
}

export function timeAgo(iso, now = new Date()) {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
