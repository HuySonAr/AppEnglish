import { z } from 'zod';
import { CEFR_LEVELS, PRACTICE_LIMITS, PracticePromptKind, WritingTaskType } from '@appenglish/content-contracts';

const text = (max) => z.string().trim().max(max).default('');
const mediaId = z.string().uuid().nullable().default(null);
const keyPoints = z.preprocess(
  (value) => (Array.isArray(value) ? value.filter((item) => typeof item !== 'string' || item.trim()) : value),
  z.array(z.string().trim().min(1).max(PRACTICE_LIMITS.keyPoint)).max(PRACTICE_LIMITS.keyPoints).default([]),
);

const common = {
  title: text(PRACTICE_LIMITS.title),
  level: z.enum(CEFR_LEVELS).default('A2'),
  topic: text(PRACTICE_LIMITS.topic),
};

export const practiceContentSchemas = Object.freeze({
  [PracticePromptKind.READ_ALOUD]: z
    .object({ ...common, text: text(PRACTICE_LIMITS.readAloudText), audioMediaId: mediaId })
    .strict(),
  [PracticePromptKind.OPEN_SPEAKING]: z
    .object({
      ...common,
      instructions: text(PRACTICE_LIMITS.instructions),
      imageMediaId: mediaId,
      maxSeconds: z.number().int().min(PRACTICE_LIMITS.speakingSeconds.min).max(PRACTICE_LIMITS.speakingSeconds.max).default(60),
      sampleAnswer: text(PRACTICE_LIMITS.sampleAnswer),
      keyPoints,
    })
    .strict(),
  [PracticePromptKind.WRITING]: z
    .object({
      ...common,
      taskType: z.enum(Object.values(WritingTaskType)).default(WritingTaskType.PARAGRAPH),
      instructions: text(PRACTICE_LIMITS.instructions),
      imageMediaId: mediaId,
      minWords: z.number().int().min(PRACTICE_LIMITS.words.min).max(PRACTICE_LIMITS.words.max).default(80),
      maxWords: z.number().int().min(PRACTICE_LIMITS.words.min).max(PRACTICE_LIMITS.words.max).default(150),
      sampleAnswer: text(PRACTICE_LIMITS.sampleAnswer),
      keyPoints,
    })
    .strict(),
});

export const practiceCreateSchema = z.object({ kind: z.enum(Object.values(PracticePromptKind)) }).strict();
export const practiceDraftSchema = z.object({ content: z.record(z.any()) }).strict();
export const practiceReturnSchema = z.object({ note: z.string().trim().min(1).max(PRACTICE_LIMITS.reviewNote) }).strict();
export const practiceListSchema = z.object({ status: z.string().max(20).optional() }).strict();

const countWords = (value) => (value.trim() ? value.trim().split(/\s+/).length : 0);

export function practiceIssues(kind, content) {
  const issues = [];
  const need = (path, ok, message) => {
    if (!ok) issues.push({ path, message });
  };
  need('title', content.title, 'Required');
  need('topic', content.topic, 'Required');
  if (kind === PracticePromptKind.READ_ALOUD) need('text', content.text, 'Required');
  if (kind !== PracticePromptKind.READ_ALOUD) {
    need('instructions', content.instructions, 'Required');
    need('sampleAnswer', content.sampleAnswer, 'Required');
  }
  if (kind === PracticePromptKind.WRITING) {
    need('maxWords', content.maxWords >= content.minWords, 'The most words must be at least the fewest');
    const words = countWords(content.sampleAnswer || '');
    need('sampleAnswer', !content.sampleAnswer || (words >= content.minWords && words <= content.maxWords), `The sample answer must have ${content.minWords} to ${content.maxWords} words`);
  }
  return issues;
}

export function practiceMediaIds(content) {
  return [content?.audioMediaId, content?.imageMediaId].filter(Boolean);
}

export const practiceMachineAudioSchema = z.object({ text: z.string().trim().min(1).max(PRACTICE_LIMITS.readAloudText) }).strict();

export const learnerRecordingsSchema = z
  .object({
    recordings: z
      .array(z.object({ storage: z.enum(['local', 'imagekit', 'r2']), storageId: z.string().min(1).max(500) }).strict())
      .max(100),
  })
  .strict();
