import { PRACTICE_LEVEL_INFO, practiceLevelOf } from '@appenglish/content-contracts';
import { WRITING_LIMITS } from '@appenglish/learning-contracts';
import { GeminiError, GeminiFailure } from './gemini.js';

export const READ_ALOUD_LIMITS = Object.freeze({ points: 3, pointChars: 300, practiceWords: 8 });

export const READ_ALOUD_SYSTEM = [
  'You are an experienced examiner of the TOEIC Speaking task "Read a text aloud" (pronunciation, intonation and stress).',
  'You do not hear the recording. You get the passage, what an automatic speech recogniser heard, and how each passage word was matched.',
  'The recogniser makes mistakes: a wrong or missing word means the word may not have been clear, not that you know what the learner said. Never claim the learner said a specific wrong word.',
  'You cannot judge intonation from text: talk about pace and pauses only from the figures given, and suggest stressing key information such as names, numbers and times.',
  'The scores are already fixed; do not give a new score. Write for a learner at the level of the task: simple, encouraging and specific.',
  'Answer only with JSON that matches the schema.',
].join('\n');

const points = { type: 'ARRAY', items: { type: 'STRING' } };

export const READ_ALOUD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    feedback: { type: 'STRING' },
    strengths: points,
    improvements: points,
    practiceWords: points,
    vi: { type: 'OBJECT', properties: { feedback: { type: 'STRING' }, strengths: points, improvements: points }, required: ['feedback', 'strengths', 'improvements'] },
  },
  required: ['feedback', 'strengths', 'improvements', 'practiceWords', 'vi'],
};

const wordsWith = (words, status) => words.filter((word) => word.status === status);
const listOf = (items) => (items.length ? items.join(', ') : 'none');

export function buildReadAloudPrompt({ prompt, readAloud, answer, durationSeconds }) {
  const words = readAloud.words || [];
  const info = PRACTICE_LEVEL_INFO[practiceLevelOf(prompt.level)];
  const unclear = wordsWith(words, 'mispronounced').map((word) => `${word.text} (${Math.round((word.confidence || 0) * 100)}%)`);
  const scores = readAloud.scores || {};
  return [
    info ? `Task level: ${info.label}, for learners aiming at TOEIC Speaking ${info.scores} (0-200 scale)` : 'Task level: not given',
    `Passage:\n"""\n${readAloud.text}\n"""`,
    `Heard by the recogniser (no punctuation, may contain mistakes):\n"""\n${answer}\n"""`,
    `Passage words matched with low confidence, so maybe unclear (confidence): ${listOf(unclear)}`,
    `Passage words not heard: ${listOf(wordsWith(words, 'missing').map((word) => word.text))}`,
    `Extra words heard: ${listOf(readAloud.extra || [])}`,
    `Speaking time: ${durationSeconds ? `${Math.round(durationSeconds)} seconds of up to ${prompt.maxSeconds}` : `up to ${prompt.maxSeconds} seconds`}; pace ${readAloud.wordsPerMinute} words per minute (a clear read is about 120-160); ${readAloud.pauses} pauses longer than 0.7 seconds.`,
    `Fixed scores (0-10): accuracy ${scores.accuracy}, completeness ${scores.completeness}, fluency ${scores.fluency}, total ${scores.total}. TOEIC estimate ${readAloud.ets?.score ?? '?'} of ${readAloud.ets?.max ?? 3}.`,
    `Give: "feedback" (one short paragraph), "strengths" (at most ${READ_ALOUD_LIMITS.points} short points), "improvements" (at most ${READ_ALOUD_LIMITS.points} short, practical points), and "practiceWords" (at most ${READ_ALOUD_LIMITS.practiceWords} words copied exactly from the passage that are worth practising).`,
    'Also give "vi": the same feedback, strengths and improvements in natural Vietnamese for the learner. Keep quoted English words in English.',
  ].join('\n\n');
}

const clip = (value, max) => String(value ?? '').trim().slice(0, max);
const pointsOf = (value) => (Array.isArray(value) ? value : []).map((item) => clip(item, READ_ALOUD_LIMITS.pointChars)).filter(Boolean).slice(0, READ_ALOUD_LIMITS.points);
const bare = (word) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

export function parseReadAloudResult(raw, passage) {
  const feedback = clip(raw?.feedback, WRITING_LIMITS.feedbackChars);
  if (!feedback) throw new GeminiError(GeminiFailure.BAD_OUTPUT, 'Gemini left out the feedback');
  const inPassage = new Map(String(passage || '').split(/\s+/).map((word) => [bare(word), word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')]));
  const practiceWords = [];
  for (const item of Array.isArray(raw?.practiceWords) ? raw.practiceWords : []) {
    const word = inPassage.get(bare(String(item ?? '')));
    if (word && !practiceWords.includes(word)) practiceWords.push(word);
    if (practiceWords.length >= READ_ALOUD_LIMITS.practiceWords) break;
  }
  const viFeedback = clip(raw?.vi?.feedback, WRITING_LIMITS.feedbackChars);
  const vi = viFeedback ? { feedback: viFeedback, strengths: pointsOf(raw.vi.strengths), improvements: pointsOf(raw.vi.improvements) } : null;
  return { feedback, strengths: pointsOf(raw?.strengths), improvements: pointsOf(raw?.improvements), practiceWords, vi };
}
