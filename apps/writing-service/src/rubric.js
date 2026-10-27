import { OPEN_SPEAKING_CRITERIA, SW_ITEM_MAX, WRITING_CRITERIA, WRITING_LIMITS, countWords, writingScores } from '@appenglish/learning-contracts';
import { PRACTICE_LEVEL_INFO, practiceLevelOf } from '@appenglish/content-contracts';
import { GeminiError, GeminiFailure } from './gemini.js';
import { spokenGuide, writtenGuide } from './ets-rubric.js';

const CRITERIA = {
  cohesion: 'Cohesion: how well ideas are organised and linked (paragraphing, linking words, reference).',
  syntax: 'Syntax: range and control of sentence structures.',
  vocabulary: 'Vocabulary: range and precision of single words.',
  phraseology: 'Phraseology: natural word combinations, collocations and set phrases.',
  grammar: 'Grammar: accuracy of grammar (tense, agreement, articles, word forms).',
  conventions: 'Conventions: spelling, capitalisation and punctuation.',
  task: 'Task: how fully and relevantly the text does what the task asks, judged against the key points and the sample answer.',
};

const SCALE = [
  '5 = native-like control; errors are rare and do not distract.',
  '4 = good control; a few errors that do not block meaning.',
  '3 = adequate; noticeable errors or a limited range, meaning mostly clear.',
  '2 = weak; frequent errors or a very limited range that sometimes block meaning.',
  '1 = very weak; errors or gaps make the text hard to follow or off task.',
  'Use steps of 0.5.',
];

function levelLine(level, skill) {
  const info = PRACTICE_LEVEL_INFO[practiceLevelOf(level)];
  return info ? `Task level: ${info.label}, for learners aiming at TOEIC ${skill} ${info.scores} (0-200 scale)` : 'Task level: not given';
}

const TASK_TYPES = { sentence: 'sentences', email: 'an email', paragraph: 'a paragraph', essay: 'a short essay' };

export const SYSTEM = [
  'You are an experienced examiner of English writing for adult learners.',
  'Score the learner text on seven criteria with the same fixed 1-5 scale for every level, so scores compare with expert ratings (ELLIPSE).',
  'Write the feedback for a learner at the level of the task: simple, encouraging, specific, and never demand structures above that level.',
  'The sample answer is a reference, not an answer key: a different but correct and relevant answer must not lose points.',
  'Only quote errors exactly as they appear in the learner text.',
  'Answer only with JSON that matches the schema.',
].join('\n');

const score = { type: 'NUMBER' };

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    criteria: { type: 'OBJECT', properties: Object.fromEntries(WRITING_CRITERIA.map((key) => [key, score])), required: [...WRITING_CRITERIA] },
    feedback: { type: 'STRING' },
    errors: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { text: { type: 'STRING' }, suggestion: { type: 'STRING' }, explanation: { type: 'STRING' } },
        required: ['text', 'suggestion', 'explanation'],
      },
    },
    rewrite: { type: 'STRING' },
  },
  required: ['criteria', 'feedback', 'errors', 'rewrite'],
};

const PICTURE_TASKS = new Set(['describe_picture', 'picture_sentence']);

function withEtsScore(schema, guide) {
  if (!guide) return schema;
  return { ...schema, properties: { ...schema.properties, etsScore: { type: 'INTEGER' } }, required: [...schema.required, 'etsScore'] };
}

function etsLines(etsTask, guide, skill) {
  if (!guide) return [];
  return [
    `TOEIC ${skill} scoring guide for this task (${etsTask.replace(/_/g, ' ')}, whole number 0-${SW_ITEM_MAX[etsTask]}):\n${guide.join('\n')}`,
    PICTURE_TASKS.has(etsTask) ? 'You cannot see the picture: judge whether the answer plausibly fits a picture, and judge the language.' : '',
    `Also give "etsScore": the score on this scoring guide, judged on its own and not from the 1-5 criteria.`,
  ].filter(Boolean);
}

function readEtsScore(raw, etsTask) {
  const score = Number(raw?.etsScore);
  if (!Number.isFinite(score)) throw new GeminiError(GeminiFailure.BAD_OUTPUT, 'Gemini left out the ETS score');
  return Math.min(SW_ITEM_MAX[etsTask], Math.max(0, Math.round(score)));
}

export const writingSchema = (etsTask) => withEtsScore(SCHEMA, writtenGuide(etsTask));

export function buildWritingPrompt({ prompt, answer, etsTask }) {
  const keyPoints = (prompt.keyPoints || []).filter(Boolean);
  return [
    levelLine(prompt.level, 'Writing'),
    `Task type: ${TASK_TYPES[prompt.taskType] || prompt.taskType}`,
    `Word limit: ${prompt.minWords}-${prompt.maxWords} words`,
    `Task:\n${prompt.instructions}`,
    keyPoints.length ? `Key points the text must cover:\n${keyPoints.map((point) => `- ${point}`).join('\n')}` : 'Key points: none given; judge the task from the instructions and the sample answer.',
    `Sample answer (reference only):\n${prompt.sampleAnswer}`,
    `Criteria:\n${WRITING_CRITERIA.map((key) => `- ${key}: ${CRITERIA[key]}`).join('\n')}`,
    `Scale:\n${SCALE.join('\n')}`,
    `Also give: "feedback" (one short paragraph), "errors" (at most ${WRITING_LIMITS.errors}; each with the exact wrong text, a corrected version and a one-sentence explanation), and "rewrite" (a better version of the learner text at the task level).`,
    ...etsLines(etsTask, writtenGuide(etsTask), 'Writing'),
    `Learner text (${countWords(answer)} words):\n"""\n${answer}\n"""`,
  ].join('\n\n');
}

const clampScore = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(5, Math.max(1, Math.round(number * 2) / 2));
};
const clip = (value, max) => String(value ?? '').trim().slice(0, max);

function readErrors(raw, answer) {
  const errors = [];
  for (const item of Array.isArray(raw?.errors) ? raw.errors : []) {
    const text = clip(item?.text, WRITING_LIMITS.errorText);
    if (!text || !answer.includes(text) || errors.some((error) => error.text === text)) continue;
    const explanationVi = clip(item.explanationVi, WRITING_LIMITS.errorText);
    errors.push({ text, suggestion: clip(item.suggestion, WRITING_LIMITS.errorText), explanation: clip(item.explanation, WRITING_LIMITS.errorText), ...(explanationVi ? { explanationVi } : {}) });
    if (errors.length >= WRITING_LIMITS.errors) break;
  }
  return errors;
}

function readCriteria(raw, keys) {
  const criteria = {};
  for (const key of keys) {
    const value = clampScore(raw?.criteria?.[key]);
    if (value === null) throw new GeminiError(GeminiFailure.BAD_OUTPUT, `Gemini left out the ${key} score`);
    criteria[key] = value;
  }
  return criteria;
}

export function parseWritingResult(raw, answer, etsTask = null) {
  const criteria = readCriteria(raw, WRITING_CRITERIA);
  return {
    criteria,
    scores: writingScores(criteria),
    feedback: clip(raw?.feedback, WRITING_LIMITS.feedbackChars),
    errors: readErrors(raw, answer),
    rewrite: clip(raw?.rewrite, WRITING_LIMITS.rewriteChars),
    ...(writtenGuide(etsTask) ? { etsScore: readEtsScore(raw, etsTask) } : {}),
  };
}

const SPOKEN_CRITERIA = {
  task: 'Task: how fully and relevantly the answer does what the task asks, judged against the key points and the sample answer.',
  vocabulary: 'Vocabulary: range, precision and natural word combinations.',
  grammar: 'Grammar: range and accuracy of structures, as spoken.',
  coherence: 'Coherence: how clearly ideas are ordered and linked.',
};

export const OPEN_SYSTEM = [
  'You are an experienced examiner of spoken English for adult learners.',
  'You get an automatic transcript of a spoken answer, not the audio: ignore punctuation, capital letters and filler words such as um or uh, and do not judge pronunciation.',
  'Score four criteria with the same fixed 1-5 scale for every level.',
  'Write the feedback for a learner at the level of the task: simple, encouraging, specific, and never demand structures above that level.',
  'The sample answer is a reference, not an answer key: a different but correct and relevant answer must not lose points.',
  'Only quote errors exactly as they appear in the transcript.',
  'Answer only with JSON that matches the schema.',
].join('\n');

const spokenError = SCHEMA.properties.errors.items;
const VIETNAMESE_LINE = 'Also give "feedbackVi" (the feedback in natural Vietnamese) and, for each error, "explanationVi" (the explanation in Vietnamese). Keep quoted English words and corrections in English.';

export const OPEN_SCHEMA = {
  ...SCHEMA,
  properties: {
    ...SCHEMA.properties,
    criteria: { type: 'OBJECT', properties: Object.fromEntries(OPEN_SPEAKING_CRITERIA.map((key) => [key, score])), required: [...OPEN_SPEAKING_CRITERIA] },
    errors: { type: 'ARRAY', items: { ...spokenError, properties: { ...spokenError.properties, explanationVi: { type: 'STRING' } }, required: [...spokenError.required, 'explanationVi'] } },
    feedbackVi: { type: 'STRING' },
  },
  required: [...SCHEMA.required, 'feedbackVi'],
};

export const openSchema = (etsTask) => withEtsScore(OPEN_SCHEMA, spokenGuide(etsTask));

export function buildOpenSpeakingPrompt({ prompt, answer, durationSeconds, etsTask }) {
  const keyPoints = (prompt.keyPoints || []).filter(Boolean);
  return [
    levelLine(prompt.level, 'Speaking'),
    `Speaking time allowed: up to ${prompt.maxSeconds} seconds${durationSeconds ? `; the learner spoke for ${Math.round(durationSeconds)} seconds` : ''}`,
    `Task:\n${prompt.instructions}`,
    keyPoints.length ? `Key points the answer must cover:\n${keyPoints.map((point) => `- ${point}`).join('\n')}` : 'Key points: none given; judge the task from the instructions and the sample answer.',
    `Sample answer (reference only):\n${prompt.sampleAnswer}`,
    `Criteria:\n${OPEN_SPEAKING_CRITERIA.map((key) => `- ${key}: ${SPOKEN_CRITERIA[key]}`).join('\n')}`,
    `Scale:\n${SCALE.join('\n')}`,
    `Also give: "feedback" (one short paragraph), "errors" (at most ${WRITING_LIMITS.errors}; each with the exact wrong words from the transcript, a corrected version and a one-sentence explanation), and "rewrite" (a better spoken answer at the task level).`,
    VIETNAMESE_LINE,
    ...etsLines(etsTask, spokenGuide(etsTask), 'Speaking'),
    `Transcript (${countWords(answer)} words):\n"""\n${answer}\n"""`,
  ].join('\n\n');
}

export function parseOpenSpeakingResult(raw, transcript, etsTask = null) {
  return {
    criteria: readCriteria(raw, OPEN_SPEAKING_CRITERIA),
    feedback: clip(raw?.feedback, WRITING_LIMITS.feedbackChars),
    errors: readErrors(raw, transcript),
    rewrite: clip(raw?.rewrite, WRITING_LIMITS.rewriteChars),
    feedbackVi: clip(raw?.feedbackVi, WRITING_LIMITS.feedbackChars),
    ...(spokenGuide(etsTask) ? { etsScore: readEtsScore(raw, etsTask) } : {}),
  };
}
