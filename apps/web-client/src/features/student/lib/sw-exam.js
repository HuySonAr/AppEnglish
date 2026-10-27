import { ETS_TASK_TIMING, EtsSpeakingTask, EtsWritingTask, SW_SPEAKING_LAYOUT, SW_WRITING_GROUPS, SW_WRITING_LAYOUT, SwSection } from '@appenglish/content-contracts';
import { compareText, matchesSearch } from '../../../lib/list.js';

export const SpeakingStep = Object.freeze({ READ: 'read', LISTEN: 'listen', PREPARE: 'prepare', RECORD: 'record' });

export const sectionInfo = Object.freeze({
  [SwSection.SPEAKING]: { label: 'Speaking', questions: SW_SPEAKING_LAYOUT.total },
  [SwSection.WRITING]: { label: 'Writing', questions: SW_WRITING_LAYOUT.total },
});

const timingOf = (item) => item?.timing || ETS_TASK_TIMING[item?.task] || {};

export function respondSeconds(item) {
  const list = timingOf(item).respondSeconds || [];
  return list[item.setIndex ?? 0] ?? list[0] ?? 0;
}

export function playTimes(item) {
  const twice = timingOf(item).playTwice || [];
  return item.setIndex !== undefined && item.setIndex !== null && twice.includes(item.setIndex) ? 2 : 1;
}

export function speakingPlan(item) {
  const timing = timingOf(item);
  const steps = [];
  if (timing.readSeconds && !item.setIndex) steps.push({ kind: SpeakingStep.READ, seconds: timing.readSeconds });
  if (item.audioUrl) steps.push({ kind: SpeakingStep.LISTEN, times: playTimes(item) });
  if (timing.prepareSeconds) steps.push({ kind: SpeakingStep.PREPARE, seconds: timing.prepareSeconds });
  steps.push({ kind: SpeakingStep.RECORD, seconds: respondSeconds(item) });
  return steps;
}

export const showsQuestionText = (item) => item.task !== EtsSpeakingTask.RESPOND_INFO && Boolean(item.text);

export function nextOpenIndex(items, lockedThrough = 0) {
  const index = items.findIndex((item) => item.number > lockedThrough);
  return index === -1 ? items.length : index;
}

export function writingGroups(items) {
  return SW_WRITING_GROUPS.map((numbers) => {
    const own = items.filter((item) => numbers.includes(item.number));
    return {
      numbers: own.map((item) => item.number),
      lockThrough: numbers.at(-1),
      seconds: own.reduce((sum, item) => sum + (ETS_TASK_TIMING[item.task]?.writeSeconds || 0), 0),
    };
  }).filter((group) => group.numbers.length);
}

export function groupIndexAfter(groups, lockedThrough = 0) {
  const index = groups.findIndex((group) => group.lockThrough > lockedThrough);
  return index === -1 ? groups.length : index;
}

export function answersFor(answers, numbers) {
  return Object.fromEntries(numbers.map((number) => [String(number), String(answers?.[number] ?? answers?.[String(number)] ?? '')]));
}

export const recommendedWords = (item) => ETS_TASK_TIMING[item?.task]?.recommendedWords || 0;

export function writingMinutes() {
  const seconds =
    SW_WRITING_LAYOUT.pictureSentences * ETS_TASK_TIMING[EtsWritingTask.PICTURE_SENTENCE].writeSeconds +
    SW_WRITING_LAYOUT.emails * ETS_TASK_TIMING[EtsWritingTask.RESPOND_EMAIL].writeSeconds +
    SW_WRITING_LAYOUT.essay * ETS_TASK_TIMING[EtsWritingTask.OPINION_ESSAY].writeSeconds;
  return Math.round(seconds / 60);
}

export function micLevel(samples) {
  if (!samples?.length) return 0;
  let sum = 0;
  for (const value of samples) {
    const centered = (value - 128) / 128;
    sum += centered * centered;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

export const latestAttempt = (history) => history?.attempts?.at(-1) || null;

export function lastTakenAt(test) {
  const dates = [latestAttempt(test.speaking)?.submittedAt, latestAttempt(test.writing)?.submittedAt].filter(Boolean).sort();
  return dates.at(-1) || null;
}

export const SwListSort = Object.freeze({ TITLE_ASC: 'title-asc', TITLE_DESC: 'title-desc', RECENT: 'recent' });
export const swListSortOptions = [
  { value: SwListSort.TITLE_ASC, label: 'Title A–Z' },
  { value: SwListSort.TITLE_DESC, label: 'Title Z–A' },
  { value: SwListSort.RECENT, label: 'Taken most recently' },
];
export const swTakenOptions = [
  { value: 'all', label: 'Taken or not' },
  { value: 'taken', label: 'Taken' },
  { value: 'not-taken', label: 'Not taken yet' },
];

export function filterStudentSwTests(tests, { search = '', taken = 'all', sort = SwListSort.TITLE_ASC }) {
  const byTitle = (a, b) => compareText(a.title, b.title);
  const compare = {
    [SwListSort.TITLE_ASC]: byTitle,
    [SwListSort.TITLE_DESC]: (a, b) => byTitle(b, a),
    [SwListSort.RECENT]: (a, b) => String(lastTakenAt(b) || '').localeCompare(String(lastTakenAt(a) || '')) || byTitle(a, b),
  }[sort] || byTitle;
  return tests.filter((test) => matchesSearch(test.title, search) && (taken === 'all' || (taken === 'taken') === Boolean(lastTakenAt(test)))).sort(compare);
}
