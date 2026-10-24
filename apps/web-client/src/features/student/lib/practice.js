import { CEFR_LEVELS } from '@appenglish/content-contracts';
import { SpokenWordStatus, SubmissionStatus } from '@appenglish/learning-contracts';
import { compareText, matchesSearch } from '../../../lib/list.js';

export const DEFAULT_PRACTICE_LEVEL = 'A2';
export const SCORING_POLL_MS = 2000;
export const SCORING_POLL_LIMIT = 90;

export const PracticeSort = Object.freeze({ LEVEL: 'level', TITLE: 'title', BEST: 'best', RECENT: 'recent' });
export const practiceSortOptions = [
  { value: PracticeSort.LEVEL, label: 'Level, then title' },
  { value: PracticeSort.TITLE, label: 'Title A–Z' },
  { value: PracticeSort.BEST, label: 'Lowest best score first' },
  { value: PracticeSort.RECENT, label: 'Recently practised' },
];
export const PracticeTried = Object.freeze({ ALL: 'all', NEW: 'new', TRIED: 'tried' });
export const practiceTriedOptions = [
  { value: PracticeTried.ALL, label: 'All prompts' },
  { value: PracticeTried.NEW, label: 'Not tried yet' },
  { value: PracticeTried.TRIED, label: 'Tried' },
];

export function practiceTopicOptions(prompts) {
  const topics = [...new Set(prompts.map((prompt) => prompt.topic).filter(Boolean))].sort(compareText);
  return [{ value: 'all', label: 'All topics' }, ...topics.map((topic) => ({ value: topic, label: topic }))];
}

export function filterPracticePrompts(prompts, { search = '', level = 'all', topic = 'all', kind = 'all', tried = PracticeTried.ALL, sort = PracticeSort.LEVEL }) {
  const byTitle = (a, b) => compareText(a.title, b.title);
  const compare = {
    [PracticeSort.LEVEL]: (a, b) => CEFR_LEVELS.indexOf(a.level) - CEFR_LEVELS.indexOf(b.level) || byTitle(a, b),
    [PracticeSort.TITLE]: byTitle,
    [PracticeSort.BEST]: (a, b) => (a.bestTotal ?? 11) - (b.bestTotal ?? 11) || byTitle(a, b),
    [PracticeSort.RECENT]: (a, b) => String(b.lastSubmittedAt || '').localeCompare(String(a.lastSubmittedAt || '')) || byTitle(a, b),
  }[sort] || byTitle;
  return prompts
    .filter(
      (prompt) =>
        matchesSearch(`${prompt.title} ${prompt.topic}`, search) &&
        (level === 'all' || prompt.level === level) &&
        (topic === 'all' || prompt.topic === topic) &&
        (kind === 'all' || prompt.kind === kind) &&
        (tried === PracticeTried.ALL || (tried === PracticeTried.NEW ? prompt.attempts === 0 : prompt.attempts > 0)),
    )
    .sort(compare);
}

export const wordStyles = {
  [SpokenWordStatus.CORRECT]: 'text-success',
  [SpokenWordStatus.MISPRONOUNCED]: 'rounded bg-warning/15 px-0.5 text-foreground underline decoration-warning decoration-wavy underline-offset-4',
  [SpokenWordStatus.MISSING]: 'text-destructive line-through decoration-2',
};
export const wordLabels = {
  [SpokenWordStatus.CORRECT]: 'Clear',
  [SpokenWordStatus.MISPRONOUNCED]: 'Not clear',
  [SpokenWordStatus.MISSING]: 'Missed',
};

export function scoreTone(total, max = 10) {
  if (total === null || total === undefined) return 'muted';
  if (total >= max * 0.8) return 'success';
  if (total >= max * 0.5) return 'warning';
  return 'destructive';
}

export const toneText = { success: 'text-success', warning: 'text-warning', destructive: 'text-destructive', muted: 'text-muted-foreground' };
export const toneBar = { success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive', muted: 'bg-muted-foreground' };

export const isScoring = (submission) => submission?.status === SubmissionStatus.SCORING;

export function recordingType(isSupported) {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => isSupported(type)) || '';
}

export function formatClock(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function wordCounts(words = []) {
  const counts = { [SpokenWordStatus.CORRECT]: 0, [SpokenWordStatus.MISPRONOUNCED]: 0, [SpokenWordStatus.MISSING]: 0 };
  for (const word of words) if (word.status in counts) counts[word.status]++;
  return counts;
}

export function levelCounts(prompts) {
  return CEFR_LEVELS.map((level) => ({ level, count: prompts.filter((prompt) => prompt.level === level).length })).filter((entry) => entry.count > 0);
}

export function defaultPracticeLevel(prompts, profileLevel) {
  const levels = levelCounts(prompts).map((entry) => entry.level);
  if (!levels.length) return 'all';
  if (profileLevel && levels.includes(profileLevel)) return profileLevel;
  if (levels.includes(DEFAULT_PRACTICE_LEVEL)) return DEFAULT_PRACTICE_LEVEL;
  const base = CEFR_LEVELS.indexOf(DEFAULT_PRACTICE_LEVEL);
  const distance = (level) => Math.abs(CEFR_LEVELS.indexOf(level) - base);
  return [...levels].sort((a, b) => distance(a) - distance(b) || CEFR_LEVELS.indexOf(a) - CEFR_LEVELS.indexOf(b))[0];
}
