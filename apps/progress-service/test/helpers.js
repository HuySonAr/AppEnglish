import { randomUUID } from 'node:crypto';
import { ProgressService } from '../src/progress/progress.service.js';
import { totalsOf } from '../src/progress/xp.rules.js';

export const student = { id: '22222222-2222-4222-8222-222222222222', role: 'STUDENT' };
export const otherStudent = { id: '44444444-4444-4444-8444-444444444444', role: 'STUDENT' };
export const manager = { id: '11111111-1111-4111-8111-111111111111', role: 'CONTENT_MANAGER' };

// In-memory stand-in for ProgressRepository.
export function createProgressRepository() {
  const tables = { results: [], completions: [], xp: [], studyDays: [], notifications: [] };
  const copy = (row) => (row ? structuredClone(row) : null);
  return {
    tables,
    async saveResult(result) {
      if (tables.results.some((row) => row.id === result.id)) return;
      tables.results.push(structuredClone(result));
    },
    async listResults(accountId) {
      return tables.results
        .filter((row) => row.accountId === accountId)
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
        .map(copy);
    },
    async saveCompletion(completion) {
      if (tables.completions.some((row) => row.accountId === completion.accountId && row.lessonId === completion.lessonId)) return;
      tables.completions.push({ id: randomUUID(), ...structuredClone(completion) });
    },
    async listCompletions(accountId) {
      return tables.completions.filter((row) => row.accountId === accountId).map(copy);
    },
    async saveXp(entry) {
      if (tables.xp.some((row) => row.id === entry.id || (row.accountId === entry.accountId && row.mockTestId === entry.mockTestId))) return;
      tables.xp.push(structuredClone(entry));
    },
    async listXp(accountId) {
      return tables.xp
        .filter((row) => row.accountId === accountId)
        .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt))
        .map(copy);
    },
    async listXpTotals() {
      return totalsOf(tables.xp);
    },
    async saveStudyDay({ accountId, day, activity, at }) {
      const row = tables.studyDays.find((item) => item.accountId === accountId && item.day === day);
      if (!row) tables.studyDays.push({ accountId, day, activities: [activity], firstAt: at, lastAt: at });
      else if (!row.activities.includes(activity)) row.activities.push(activity);
    },
    async addNotification(notification) {
      if (tables.notifications.some((row) => row.accountId === notification.accountId && row.key === notification.key)) return;
      tables.notifications.push({ id: randomUUID(), readAt: null, ...structuredClone(notification) });
    },
    async latestMockNotification(accountId, mockTestId) {
      return copy(tables.notifications.filter((row) => row.accountId === accountId && row.kind === 'MOCK_RESULT' && row.data.mockTestId === mockTestId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]);
    },
    async listNotifications(accountId, limit) {
      return tables.notifications.filter((row) => row.accountId === accountId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit).map(copy);
    },
    async countUnread(accountId) {
      return tables.notifications.filter((row) => row.accountId === accountId && !row.readAt).length;
    },
    async markNotificationsRead(accountId, ids, at) {
      for (const row of tables.notifications) if (row.accountId === accountId && !row.readAt && (!ids || ids.includes(row.id))) row.readAt = at;
    },
    async markNotificationKeyRead(accountId, key, at) {
      for (const row of tables.notifications) if (row.accountId === accountId && row.key === key && !row.readAt) row.readAt = at;
    },
    async deleteNotificationsBefore(accountId, before) {
      tables.notifications = tables.notifications.filter((row) => row.accountId !== accountId || new Date(row.createdAt) >= before);
    },
    async listStudyDays(accountId) {
      return tables.studyDays.filter((row) => row.accountId === accountId).map((row) => row.day).sort();
    },
  };
}

// Content-service stand-in: a published curriculum of units with lessons,
// shape = lessons per unit.
export function createCurriculum(shape = [2, 2]) {
  let number = 0;
  const units = shape.map((count, index) => ({
    id: randomUUID(),
    title: `Unit ${index + 1}`,
    description: '',
    lessons: Array.from({ length: count }, () => ({ id: randomUUID(), title: `Lesson ${++number}` })),
  }));
  return {
    units,
    lessons: units.flatMap((unit) => unit.lessons),
    async getCurriculum() {
      return structuredClone({ units });
    },
  };
}

export function progressHarness(shape, { now } = {}) {
  const repository = createProgressRepository();
  const content = createCurriculum(shape);
  const service = new ProgressService(repository, content, now ? { now } : {});
  return { repository, content, service };
}

// A learning.results message as learning-service sends it.
export function message(type, payload, id = randomUUID()) {
  return { id, type, occurredAt: '2026-10-17T08:00:00.000Z', payload };
}

const at = (minute) => `2026-10-17T08:${String(minute).padStart(2, '0')}:00.000Z`;

// A finished lesson-test attempt (23 questions: 9 listening, 14 reading).
export function lessonTest(accountId, lessonId, { attemptNumber = 1, listening, reading, minute = 0 }) {
  return {
    attemptId: randomUUID(),
    accountId,
    lessonId,
    lessonVersionId: randomUUID(),
    attemptNumber,
    correctCount: listening + reading,
    totalCount: 23,
    scorePercent: Math.round(((listening + reading) * 100) / 23),
    listeningCorrect: listening,
    listeningTotal: 9,
    readingCorrect: reading,
    readingTotal: 14,
    passed: (listening + reading) * 100 >= 80 * 23,
    durationSeconds: 300,
    submittedAt: at(minute),
  };
}

// A finished full mock-test attempt with the given totals.
export function mockTest(accountId, mockTestId, { attemptNumber = 1, listening, listeningTotal, reading, readingTotal, kind = 'FULL', minute = 0, email = '', title = 'Mock test' }) {
  return {
    attemptId: randomUUID(),
    accountId,
    accountEmail: email,
    mockTestId,
    mockTestTitle: title,
    mockVersionId: randomUUID(),
    kind,
    attemptNumber,
    correctCount: listening + reading,
    totalCount: listeningTotal + readingTotal,
    listeningCorrect: listening,
    listeningTotal,
    readingCorrect: reading,
    readingTotal,
    listeningScore: 300,
    readingScore: 250,
    submittedAt: at(minute),
  };
}
