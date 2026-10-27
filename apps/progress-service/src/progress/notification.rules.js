import { NotificationKind, STREAK_REMINDER_HOUR, STREAK_TIME_ZONE } from '@appenglish/progress-contracts';

const hourFormatters = new Map();

export function hourOf(date, timeZone = STREAK_TIME_ZONE) {
  if (!hourFormatters.has(timeZone)) hourFormatters.set(timeZone, new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }));
  return Number(hourFormatters.get(timeZone).format(new Date(date)));
}

export function needsStreakReminder(streak, now) {
  return streak.current > 0 && !streak.studiedToday && hourOf(now) >= STREAK_REMINDER_HOUR;
}

export const streakReminderKey = (day) => `streak:${day}`;

export function mockResultNotification(data, previous) {
  const scored = Number.isInteger(data.listeningScore) && Number.isInteger(data.readingScore);
  const total = scored ? data.listeningScore + data.readingScore : null;
  const before = previous?.data?.total;
  return {
    accountId: data.accountId,
    kind: NotificationKind.MOCK_RESULT,
    key: `mock:${data.attemptId}`,
    data: {
      mockTestId: data.mockTestId,
      mockTestTitle: data.mockTestTitle,
      attemptNumber: data.attemptNumber,
      total,
      listening: scored ? data.listeningScore : null,
      reading: scored ? data.readingScore : null,
      change: total !== null && Number.isInteger(before) ? total - before : null,
    },
    createdAt: new Date(data.submittedAt),
  };
}

export function unitOpenedNotification(data) {
  return {
    accountId: data.accountId,
    kind: NotificationKind.UNIT_OPENED,
    key: `unit:${data.unitId}`,
    data: { unitId: data.unitId, unitTitle: data.unitTitle, nextUnitId: data.nextUnitId, nextUnitTitle: data.nextUnitTitle },
    createdAt: new Date(data.passedAt),
  };
}

export function practiceResultNotification(data, kind = NotificationKind.SPEAKING_RESULT) {
  return {
    accountId: data.accountId,
    kind,
    key: `${kind === NotificationKind.WRITING_RESULT ? 'writing' : 'speaking'}:${data.submissionId}`,
    data: { submissionId: data.submissionId, promptId: data.promptId, kind: data.kind, title: data.title, status: data.status, total: data.total },
    createdAt: new Date(data.scoredAt),
  };
}

export function reviewNotification(data, kind) {
  const returned = kind === NotificationKind.REVIEW_RETURNED;
  return {
    accountId: data.accountId,
    kind,
    key: `${returned ? 'review-returned' : 'review'}:${data.submissionId}:${returned ? data.expiredAt : 'done'}`,
    data: { submissionId: data.submissionId, promptId: data.promptId, kind: data.kind, title: data.title, total: returned ? null : data.total, ...(data.swTestId ? { swTestId: data.swTestId, section: data.section, attemptNumber: data.attemptNumber } : {}) },
    createdAt: new Date(returned ? data.expiredAt : data.reviewedAt),
  };
}

export function swResultNotification(data) {
  return {
    accountId: data.accountId,
    kind: NotificationKind.SW_TEST_RESULT,
    key: `sw:${data.attemptId}:${data.scoredAt}`,
    data: { swTestId: data.swTestId, section: data.section, attemptNumber: data.attemptNumber, title: data.title, scaled: data.scaled },
    createdAt: new Date(data.scoredAt),
  };
}

export function notificationView(row) {
  return { id: row.id, kind: row.kind, data: row.data, createdAt: new Date(row.createdAt).toISOString(), read: Boolean(row.readAt) };
}
