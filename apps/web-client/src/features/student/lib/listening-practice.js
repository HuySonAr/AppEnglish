import { ListeningFormat, listeningKind } from '@appenglish/content-contracts';
import { ListeningMode } from '@appenglish/learning-contracts';
import { compareText, matchesSearch } from '../../../lib/list.js';

export const listeningKindOf = listeningKind;

export function kindLabel(key) {
  const kind = listeningKindOf(key);
  if (!kind) return key;
  return kind.number ? `Part ${kind.number} · ${kind.title}` : kind.title;
}

export function sentenceLabel(kindKey, index, speaker) {
  const fixed = listeningKindOf(kindKey)?.labels?.[index];
  if (fixed) return fixed;
  return `${kindKey === 'song' ? 'Line' : 'Sentence'} ${index + 1}${speaker ? ` · ${speaker}` : ''}`;
}

export const isTried = (exercise) => exercise.checkCount > 0 || exercise.blanks?.checkCount > 0;

export const topicModes = (topic) =>
  topic?.format === ListeningFormat.SONG ? [ListeningMode.BLANKS, ListeningMode.FULL] : [ListeningMode.FULL];

export const resultOf = (exercise, mode) => (mode === ListeningMode.BLANKS ? exercise.blanks : exercise) || { bestAccuracy: null, checkCount: 0 };

export const modeLabels = { [ListeningMode.BLANKS]: 'Fill in the blanks', [ListeningMode.FULL]: 'Write every line' };

export const isTimed = (segment) => segment.start !== null && segment.end !== null && segment.end > segment.start;

export const ListeningSort = Object.freeze({ LEVEL: 'level', TITLE: 'title', BEST: 'best' });
export const listeningSortOptions = [
  { value: ListeningSort.LEVEL, label: 'Level, then part' },
  { value: ListeningSort.TITLE, label: 'Title A–Z' },
  { value: ListeningSort.BEST, label: 'Lowest best score first' },
];
export const ListeningDone = Object.freeze({ ALL: 'all', NEW: 'new', DONE: 'done' });
export const listeningDoneOptions = [
  { value: ListeningDone.ALL, label: 'All exercises' },
  { value: ListeningDone.NEW, label: 'Not tried yet' },
  { value: ListeningDone.DONE, label: 'Tried' },
];

export const exercisesFor = (exercises, topic, mode) =>
  exercises.filter((exercise) => exercise.topic?.id === topic && (mode !== ListeningMode.BLANKS || exercise.blankCount > 0));

export function filterListeningPractice(exercises, { topic, mode = ListeningMode.FULL, search, level, kind, done, sort }) {
  const best = (exercise) => resultOf(exercise, mode).bestAccuracy ?? 101;
  const tried = (exercise) => resultOf(exercise, mode).checkCount > 0;
  const byTitle = (a, b) => compareText(a.title, b.title);
  const compare = {
    [ListeningSort.LEVEL]: (a, b) => compareText(a.level, b.level) || compareText(a.kind, b.kind) || byTitle(a, b),
    [ListeningSort.TITLE]: byTitle,
    [ListeningSort.BEST]: (a, b) => best(a) - best(b) || byTitle(a, b),
  }[sort];
  return exercisesFor(exercises, topic, mode)
    .filter(
      (exercise) =>
        matchesSearch(exercise.title, search) &&
        (level === 'all' || exercise.level === level) &&
        (kind === 'all' || exercise.kind === kind) &&
        (done === ListeningDone.ALL || (done === ListeningDone.DONE) === tried(exercise)),
    )
    .sort(compare);
}

export const lineBlanks = (segment) => (segment.pieces || []).filter((piece) => 'blank' in piece).map((piece) => piece.blank);

export function lineAnswers(mode, segment, answers) {
  if (mode !== ListeningMode.BLANKS) return { [segment.id]: answers[segment.id] || '' };
  return Object.fromEntries(lineBlanks(segment).map((blank) => [String(blank), answers[blank] || '']));
}

export function runningScore(results) {
  const scores = Object.values(results).map((result) => result?.accuracy).filter((value) => typeof value === 'number');
  return scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
}

export function maskedWords(words = []) {
  return words.map((word) => {
    if (word.status === 'correct') return { text: word.text, status: 'correct' };
    if (word.status === 'extra') return { text: word.text, status: 'extra' };
    return { text: '*'.repeat(Math.max(1, String(word.text).replace(/[^\p{L}\p{N}']/gu, '').length)), status: 'hidden' };
  });
}

