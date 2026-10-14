import { ListeningFormat, listeningKind } from '@appenglish/content-contracts';
import { ListeningMode } from '@appenglish/learning-contracts';
import { compareText, matchesSearch } from '../../../lib/list.js';

// Listening practice for learners (F05B-3, D86).

export const listeningKindOf = listeningKind;

// "Part 3 · Conversation", or "Song".
export function kindLabel(key) {
  const kind = listeningKindOf(key);
  if (!kind) return key;
  return kind.number ? `Part ${kind.number} · ${kind.title}` : kind.title;
}

// What a sentence is called: its fixed label in Parts 1 and 2 ("(B)",
// "Question"), "Line 3" in a song, else "Sentence 3", with the speaker when
// there is one.
export function sentenceLabel(kindKey, index, speaker) {
  const fixed = listeningKindOf(kindKey)?.labels?.[index];
  if (fixed) return fixed;
  return `${kindKey === 'song' ? 'Line' : 'Sentence'} ${index + 1}${speaker ? ` · ${speaker}` : ''}`;
}

// True once the learner checked the exercise in either mode.
export const isTried = (exercise) => exercise.checkCount > 0 || exercise.blanks?.checkCount > 0;

// The ways a topic's exercises are practised (D92): a song topic offers
// filling in the blanks and writing every line; the others writing only.
export const topicModes = (topic) =>
  topic?.format === ListeningFormat.SONG ? [ListeningMode.BLANKS, ListeningMode.FULL] : [ListeningMode.FULL];

// The learner's results of an exercise in a mode: { bestAccuracy, checkCount, … }.
export const resultOf = (exercise, mode) => (mode === ListeningMode.BLANKS ? exercise.blanks : exercise) || { bestAccuracy: null, checkCount: 0 };

// What a mode is called.
export const modeLabels = { [ListeningMode.BLANKS]: 'Fill in the blanks', [ListeningMode.FULL]: 'Write every line' };

// A sentence can be replayed alone when it has its place in the recording.
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

// The exercises of one topic that can be practised in the mode (only songs
// with blanks for filling in), before any search or filter.
export const exercisesFor = (exercises, topic, mode) =>
  exercises.filter((exercise) => exercise.topic?.id === topic && (mode !== ListeningMode.BLANKS || exercise.blankCount > 0));

// The exercises of one topic and mode that pass the search and filters,
// sorted. level and kind are 'all' or a value; tried and the best score are
// those of the mode; "lowest best score first" puts those not tried last.
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

// Song lines practised one at a time (D93).

// The blank numbers of a line in blanks mode (none for a line without blanks).
export const lineBlanks = (segment) => (segment.pieces || []).filter((piece) => 'blank' in piece).map((piece) => piece.blank);

// What is sent to check one line: its text by line id, or its blanks by number.
export function lineAnswers(mode, segment, answers) {
  if (mode !== ListeningMode.BLANKS) return { [segment.id]: answers[segment.id] || '' };
  return Object.fromEntries(lineBlanks(segment).map((blank) => [String(blank), answers[blank] || '']));
}

// The score so far: the mean of the lines checked (lines without a score,
// such as a line without blanks, do not count); null before any.
export function runningScore(results) {
  const scores = Object.values(results).map((result) => result?.accuracy).filter((value) => typeof value === 'number');
  return scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
}

