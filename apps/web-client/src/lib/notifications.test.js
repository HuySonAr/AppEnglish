import test from 'node:test';
import assert from 'node:assert/strict';
import { describeNotification, mergeNotifications, notificationSources, timeAgo } from './notifications.js';

test('each role reads its own sources; an admin reads two, merged newest first', () => {
  assert.deepEqual(['STUDENT', 'CONTENT_MANAGER', 'ADMIN', 'OTHER'].map(notificationSources), [['progress'], ['content'], ['auth-admin', 'content-admin'], []]);
  const merged = mergeNotifications([
    { source: 'auth-admin', data: { notifications: [{ id: 'w', createdAt: '2026-10-19T17:00:00.000Z' }], unread: 1 } },
    { source: 'content-admin', data: { notifications: [{ id: 'u', createdAt: '2026-10-21T08:00:00.000Z' }, { id: 'v', createdAt: '2026-10-18T08:00:00.000Z' }], unread: 2 } },
  ]);
  assert.deepEqual([merged.notifications.map((item) => `${item.source}:${item.id}`), merged.unread], [['content-admin:u', 'auth-admin:w', 'content-admin:v'], 3]);
});

test('admin notices read as a sentence', () => {
  assert.equal(describeNotification({ kind: 'NEW_LEARNERS', data: { newLearners: 12, change: -3, weekStart: '2026-10-12', weekEnd: '2026-10-18' } }).title, '12 new learners last week (-3 on the week before)');
  assert.equal(describeNotification({ kind: 'CONTENT_UNPUBLISHED', data: { type: 'mockTest', title: 'Mock 1' } }).title, 'Mock test unpublished: Mock 1');
  assert.equal(describeNotification({ kind: 'SPEECH_FAILURES', data: { count: 3, day: '2026-10-22', lastError: 'Broker down' } }).title, '3 speech jobs failed on 2026-10-22');
});

test('notifications get a title and the page they open', () => {
  const mock = describeNotification({ kind: 'MOCK_RESULT', data: { mockTestId: 'm', mockTestTitle: 'Level 1 test', attemptNumber: 2, total: 650, change: 45 } });
  assert.deepEqual([mock.title, mock.detail, mock.to, mock.tone], ['Full test scored 650 / 990 (+45)', 'Level 1 test · attempt 2', '/student/mock-tests/m/history?attempt=2', 'success']);
  assert.equal(describeNotification({ kind: 'MOCK_RESULT', data: { mockTestId: 'm', attemptNumber: 3, total: 600, change: -50 } }).tone, 'warning');
  assert.equal(describeNotification({ kind: 'UNIT_OPENED', data: { unitTitle: 'Unit 1', nextUnitTitle: 'Unit 2' } }).title, 'Unit 2 is open');
  assert.equal(describeNotification({ kind: 'UNIT_OPENED', data: { unitTitle: 'Unit 9', nextUnitTitle: null } }).title, 'Unit 9 review passed');
  assert.equal(describeNotification({ kind: 'STREAK_REMINDER', data: { streak: 5 } }).title, 'Study today to keep your 5-day streak');
  const job = describeNotification({ kind: 'SPEECH_JOB', data: { task: 'transcribe', status: 'FAILED', error: 'No speech', owner: { type: 'mockTest', id: 'x', title: 'Mock 1' } } });
  assert.deepEqual([job.title, job.detail, job.to, job.tone], ['Transcribe failed · Mock 1', 'No speech', '/teacher/mock-tests/x', 'destructive']);
  assert.equal(describeNotification({ kind: 'SPEECH_JOB', data: { task: 'align', status: 'DONE', owner: { type: 'exercise', id: 'e', title: '' } } }).title, 'Auto-time finished');
});

test('times read as how long ago', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  assert.deepEqual(['2026-10-22T11:59:40Z', '2026-10-22T11:15:00Z', '2026-10-22T07:00:00Z', '2026-10-21T10:00:00Z', '2026-10-18T12:00:00Z'].map((iso) => timeAgo(iso, now)), ['just now', '45 min ago', '5 h ago', 'yesterday', '4 days ago']);
});

test('review notices link to the right area for each role (D191)', () => {
  const pending = describeNotification({ kind: 'REVIEW_PENDING', data: { kind: 'lesson', id: 'l1', title: 'Tickets', by: { displayName: 'Lan' } } });
  assert.deepEqual([pending.title, pending.detail, pending.to], ['Waiting for review · Lesson: Tickets', 'Sent by Lan.', '/content-manager/lessons/l1']);
  const prompt = describeNotification({ kind: 'REVIEW_PENDING', data: { kind: 'prompt', promptKind: 'open_speaking', id: 'p1', title: 'Hobbies' } });
  assert.equal(prompt.to, '/content-manager/speaking-prompts/p1');
  const returned = describeNotification({ kind: 'REVIEW_DONE', data: { kind: 'placement', id: 'main', title: '', outcome: 'returned', note: 'Fix part 5.' } });
  assert.deepEqual([returned.tone, returned.title, returned.detail, returned.to], ['warning', 'Returned · Placement test', 'Fix part 5.', '/teacher/placement']);
  const approved = describeNotification({ kind: 'REVIEW_DONE', data: { kind: 'prompt', promptKind: 'read_aloud', id: 'p2', title: 'Shop', outcome: 'approved' } });
  assert.deepEqual([approved.tone, approved.to], ['success', '/teacher/read-aloud/p2']);
  const sw = describeNotification({ kind: 'REVIEW_PENDING', data: { kind: 'swTest', id: 's1', title: 'Set A' } });
  assert.deepEqual([sw.title, sw.to], ['Waiting for review · S&W test: Set A', '/content-manager/sw-tests/s1']);
  assert.deepEqual(notificationSources('TEACHER'), ['content']);
});


test('S&W notices show the 0–200 score and open the result page', () => {
  const result = describeNotification({ kind: 'SW_TEST_RESULT', data: { swTestId: 't1', section: 'speaking', attemptNumber: 2, title: 'S&W 1', scaled: 150 } });
  assert.deepEqual([result.title, result.detail, result.to], ['Speaking score: 150 · S&W 1', 'Attempt 2', '/student/sw-tests/t1/result?section=speaking&attempt=2']);
  const reviewed = describeNotification({ kind: 'TEACHER_REVIEWED', data: { kind: 'sw_writing', swTestId: 't1', section: 'writing', attemptNumber: 1, title: 'S&W 1 · Writing', total: 160 } });
  assert.deepEqual([reviewed.title, reviewed.to], ['A teacher reviewed your Writing: 160 / 200', '/student/sw-tests/t1/result?section=writing&attempt=1']);
  const returned = describeNotification({ kind: 'REVIEW_RETURNED', data: { kind: 'sw_speaking', swTestId: 't1', section: 'speaking', attemptNumber: 3, title: 'S&W 1 · Speaking' } });
  assert.equal(returned.to, '/student/sw-tests/t1/result?section=speaking&attempt=3');
});
