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

export function levelUpNotification(data) {
  return {
    accountId: data.accountId,
    kind: NotificationKind.COURSE_LEVEL_UP,
    key: `level:${data.to}`,
    data: { from: data.from, to: data.to },
    createdAt: new Date(data.reachedAt),
  };
}

export function notificationView(row) {
  return { id: row.id, kind: row.kind, data: row.data, createdAt: new Date(row.createdAt).toISOString(), read: Boolean(row.readAt) };
}
