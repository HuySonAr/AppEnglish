
export const ProgressSource = Object.freeze({ LESSON_TEST: 'LESSON_TEST', MOCK_TEST: 'MOCK_TEST' });

export const ProgressSkill = Object.freeze({ LISTENING: 'listening', READING: 'reading' });

export const XP_MAX_PER_MOCK = 100;
export const LEADERBOARD_SIZE = 50;

export const STREAK_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const STREAK_REST_DAYS_PER_WEEK = 1;
export const STREAK_CALENDAR_WEEKS = 8;

export const NotificationKind = Object.freeze({
  MOCK_RESULT: 'MOCK_RESULT',
  UNIT_OPENED: 'UNIT_OPENED',
  STREAK_REMINDER: 'STREAK_REMINDER',
  SW_TEST_RESULT: 'SW_TEST_RESULT',
  SPEAKING_RESULT: 'SPEAKING_RESULT',
  WRITING_RESULT: 'WRITING_RESULT',
  TEACHER_REVIEWED: 'TEACHER_REVIEWED',
  REVIEW_RETURNED: 'REVIEW_RETURNED',
});
export const NOTIFICATION_LIST_SIZE = 30;
export const NOTIFICATION_KEEP_DAYS = 30;
export const STREAK_REMINDER_HOUR = 18;
export const StreakDayState = Object.freeze({ STUDIED: 'studied', REST: 'rest', MISSED: 'missed', TODAY: 'today', FUTURE: 'future' });

export function wholePercent(ratio) {
  return ratio === null || ratio === undefined ? null : Math.round(ratio * 100);
}

export const ProgressResponseCode = Object.freeze({
  SUCCESS: 0,
  FORBIDDEN_ROLE: 26,
  VALIDATION_ERROR: 30,
  SYSTEM_ERROR: 32,
});
