import { z } from 'zod';
import { CourseDictationMode } from '@appenglish/learning-contracts';

export const itemIdSchema = z.string().uuid();
export const unitIdSchema = itemIdSchema;

const answers = z
  .record(z.string().max(80), z.string().max(2000))
  .default({})
  .refine((value) => Object.keys(value).length <= 50, { message: 'Too many answers' });

export const sentenceCheckSchema = z
  .object({
    versionId: z.string().uuid().optional(),
    segmentId: z.string().uuid(),
    mode: z.enum(Object.values(CourseDictationMode)),
    text: z.string().max(2000).default(''),
    blanks: z.array(z.string().max(200)).max(30).default([]),
  })
  .strict();

export const testAnswersSchema = z.object({ versionId: z.string().uuid().optional(), answers }).strict();
