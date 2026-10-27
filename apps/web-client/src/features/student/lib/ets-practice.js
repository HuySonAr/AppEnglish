import { ETS_SET_QUESTIONS, ETS_SET_TASKS } from '@appenglish/content-contracts';
import { SubmissionStatus } from '@appenglish/learning-contracts';

export const TIMER_STORAGE_PREFIX = 'practice-no-timer:';

export const isSetPrompt = (prompt) => Boolean(prompt) && ETS_SET_TASKS.includes(prompt.etsTask) && (prompt.questions || []).length === ETS_SET_QUESTIONS;

export const hasTimer = (prompt) => Boolean(prompt?.timing);

export function recordSeconds(prompt, index = 0, timed = true) {
  const max = prompt.maxSeconds;
  const planned = timed ? prompt.timing?.respondSeconds?.[index] : null;
  return planned ? Math.min(planned, max) : max;
}

export const prepareSeconds = (prompt) => prompt.timing?.prepareSeconds || 0;
export const readSeconds = (prompt) => prompt.timing?.readSeconds || 0;
export const playCount = (prompt, index) => (prompt.timing?.playTwice?.includes(index) ? 2 : 1);

export function remainingSeconds(startedAt, totalSeconds, now) {
  if (startedAt === null || startedAt === undefined) return totalSeconds;
  return Math.max(0, totalSeconds - (now - startedAt) / 1000);
}

export function nextSetStep(index) {
  return index + 1 < ETS_SET_QUESTIONS ? { phase: 'question', index: index + 1 } : { phase: 'done', index };
}

export function newSetId(random = globalThis.crypto) {
  if (random?.randomUUID) return random.randomUUID();
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const timerStorageKey = (accountId) => `${TIMER_STORAGE_PREFIX}${accountId || 'guest'}`;

export function readNoTimer(storage, accountId) {
  try {
    return storage?.getItem(timerStorageKey(accountId)) === '1';
  } catch {
    return false;
  }
}

export function writeNoTimer(storage, accountId, value) {
  try {
    if (value) storage?.setItem(timerStorageKey(accountId), '1');
    else storage?.removeItem(timerStorageKey(accountId));
  } catch {
    return;
  }
}

function groupStatus(answers) {
  if (answers.some((answer) => answer.status === SubmissionStatus.SCORING)) return SubmissionStatus.SCORING;
  if (answers.every((answer) => answer.status === SubmissionStatus.DONE)) return SubmissionStatus.DONE;
  if (answers.some((answer) => answer.status === SubmissionStatus.FAILED)) return SubmissionStatus.FAILED;
  return answers[0]?.status || SubmissionStatus.SAVED;
}

export function setTotal(answers) {
  const totals = answers.map((answer) => answer.total).filter((total) => typeof total === 'number');
  if (!totals.length || totals.length !== answers.length) return null;
  return Math.round((totals.reduce((sum, total) => sum + total, 0) / totals.length) * 10) / 10;
}

export function groupBySet(submissions) {
  const groups = [];
  const byKey = new Map();
  for (const submission of submissions) {
    const key = submission.setId || submission.id;
    let group = byKey.get(key);
    if (!group) {
      group = { id: key, setId: submission.setId || null, answers: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.answers.push(submission);
  }
  return groups.map((group) => {
    const answers = [...group.answers].sort((a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0));
    const submittedAt = answers.map((answer) => answer.submittedAt).sort().at(-1) || null;
    const status = groupStatus(answers);
    return { ...group, answers, submittedAt, status, total: status === SubmissionStatus.DONE ? setTotal(answers) : null, reviewed: answers.some((answer) => answer.reviewed) };
  });
}

export function writingLocked(prompt, timed, remaining) {
  return Boolean(timed && prompt?.timing?.writeSeconds && remaining !== null && remaining <= 0);
}
