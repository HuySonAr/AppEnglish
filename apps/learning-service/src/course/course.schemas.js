import { z } from 'zod';
import { CourseDictationMode } from '@appenglish/learning-contracts';

export const itemIdSchema = z.string().uuid();
export const unitIdSchema = itemIdSchema;

// Option id by question id.
const answers = z
  .record(z.string().max(80), z.string().max(2000))
  .default({})
  .refine((value) => Object.keys(value).length <= 50, { message: 'Too many answers' });

// One dictation sentence checked (D145): what was written in the full mode,
// or the words typed in each blank in the blanks mode. versionId keeps the
// check on the version the learner opened.
export const sentenceCheckSchema = z
  .object({
    versionId: z.string().uuid().optional(),
    segmentId: z.string().uuid(),
    mode: z.enum(Object.values(CourseDictationMode)),
    text: z.string().max(2000).default(''),
    blanks: z.array(z.string().max(200)).max(30).default([]),
  })
  .strict();

// The answers of a level test: option id by question id.
export const testAnswersSchema = z.object({ versionId: z.string().uuid().optional(), answers }).strict();
