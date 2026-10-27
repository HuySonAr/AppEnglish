import { AccountRole } from '@appenglish/auth-contracts';
import { NotificationKind } from '@appenglish/progress-contracts';
import { MANAGER_BASE, TEACHER_BASE, contentItemPath, reviewKindLabels } from '../features/content-manager/lib/content-area.js';
import { swResultPath } from '../features/student/lib/sw-score.js';

const ownerPaths = {
  exercise: (id) => `/teacher/listening/${id}`,
  mockTest: (id) => `/teacher/mock-tests/${id}`,
};

const sourcesByRole = {
  [AccountRole.STUDENT]: ['progress'],
  [AccountRole.CONTENT_MANAGER]: ['content'],
  [AccountRole.TEACHER]: ['content'],
  [AccountRole.ADMIN]: ['auth-admin', 'content-admin'],
};
const promptSlugs = { read_aloud: 'read-aloud', open_speaking: 'open-speaking', writing: 'writing' };
const promptNames = { read_aloud: 'Read-aloud prompt', open_speaking: 'Speaking prompt', writing: 'Writing prompt' };

function reviewTarget(data, base) {
  if (data.kind === 'prompt') {
    if (base === MANAGER_BASE) return `${MANAGER_BASE}/${data.promptKind === 'writing' ? 'writing' : 'speaking'}-prompts/${data.id}`;
    return `${TEACHER_BASE}/${promptSlugs[data.promptKind] || 'writing'}/${data.id}`;
  }
  return contentItemPath(base, data.kind, data.id);
}

function reviewName(data) {
  const label = data.kind === 'prompt' ? promptNames[data.promptKind] || 'Prompt' : reviewKindLabels[data.kind] || 'Content';
  return data.title ? `${label}: ${data.title}` : label;
}

const swSections = { sw_speaking: 'speaking', sw_writing: 'writing' };
const swSectionLabels = { speaking: 'Speaking', writing: 'Writing' };
const swPath = (data, section) => swResultPath(data.swTestId, section, data.attemptNumber);

const unpublishedNames = { unit: 'Unit', unitReview: 'Unit review', lesson: 'Lesson', mockTest: 'Mock test', exercise: 'Listening exercise', swTest: 'S&W test' };

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
  if (kind === NotificationKind.SPEAKING_RESULT)
    return {
      tone: data.status === 'DONE' ? 'success' : 'destructive',
      title: data.status !== 'DONE' ? 'Your speaking could not be scored' : data.total === null ? 'Your speaking answer is ready' : `Your speaking scored ${Number(data.total).toFixed(1)} / 10`,
      detail: data.title || 'Speaking',
      to: `/student/practice/speaking/${data.promptId}?submission=${data.submissionId}`,
    };
  if (kind === NotificationKind.WRITING_RESULT)
    return {
      tone: data.status === 'DONE' ? 'success' : 'destructive',
      title: data.status === 'DONE' ? `Your writing scored ${Number(data.total).toFixed(1)} / 5` : 'Your writing could not be scored',
      detail: data.title || 'Writing',
      to: `/student/practice/writing/${data.promptId}?submission=${data.submissionId}`,
    };
  if (kind === NotificationKind.SW_TEST_RESULT) {
    const label = swSectionLabels[data.section] || 'S&W';
    const scored = data.scaled !== null && data.scaled !== undefined;
    return {
      tone: scored ? 'success' : 'info',
      title: `${scored ? `${label} score: ${data.scaled}` : `${label} result is ready`}${data.title ? ` · ${data.title}` : ''}`,
      detail: data.attemptNumber ? `Attempt ${data.attemptNumber}` : 'S&W test',
      to: swPath(data, data.section),
    };
  }
  if ((kind === NotificationKind.TEACHER_REVIEWED || kind === NotificationKind.REVIEW_RETURNED) && swSections[data.kind]) {
    const section = swSections[data.kind];
    const to = swPath(data, section);
    const detail = data.title || `S&W ${swSectionLabels[section]}`;
    if (kind === NotificationKind.REVIEW_RETURNED) return { tone: 'warning', title: 'No teacher was free; your review turn is back', detail, to };
    return { tone: 'success', title: `A teacher reviewed your ${swSectionLabels[section]}: ${data.total} / 200`, detail, to };
  }
  if (kind === NotificationKind.TEACHER_REVIEWED || kind === NotificationKind.REVIEW_RETURNED) {
    const area = data.kind === 'writing' ? 'writing' : 'speaking';
    const to = `/student/practice/${area}/${data.promptId}?submission=${data.submissionId}`;
    if (kind === NotificationKind.REVIEW_RETURNED) return { tone: 'warning', title: 'No teacher was free; your review turn is back', detail: data.title || 'Practice', to };
    return { tone: 'success', title: `A teacher reviewed your answer: ${Number(data.total).toFixed(1)} / ${area === 'writing' ? 5 : 10}`, detail: data.title || 'Practice', to };
  }
  if (kind === NotificationKind.STREAK_REMINDER)
    return { tone: 'warning', title: `Study today to keep your ${data.streak}-day streak`, detail: 'One short lesson is enough.', to: '/student' };
  if (kind === 'SPEECH_JOB') {
    const task = data.task === 'transcribe' ? 'Transcribe' : 'Auto-time';
    const failed = data.status === 'FAILED';
    return {
      tone: failed ? 'destructive' : 'success',
      title: `${task} ${failed ? 'failed' : 'finished'}${data.owner.title ? ` · ${data.owner.title}` : ''}`,
      detail: failed ? data.error || 'Try again later.' : 'Open the editor to check and apply it.',
      to: ownerPaths[data.owner.type]?.(data.owner.id) || '/teacher',
    };
  }
  if (kind === 'REVIEW_PENDING')
    return { tone: 'info', title: `Waiting for review · ${reviewName(data)}`, detail: data.by?.displayName ? `Sent by ${data.by.displayName}.` : 'Open it to approve or return.', to: reviewTarget(data, MANAGER_BASE) };
  if (kind === 'REVIEW_DONE') {
    const approved = data.outcome === 'approved';
    return {
      tone: approved ? 'success' : 'warning',
      title: `${approved ? 'Approved' : 'Returned'} · ${reviewName(data)}`,
      detail: approved ? 'Learners can see it now.' : data.note || 'Open it to see what to change.',
      to: reviewTarget(data, TEACHER_BASE),
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
