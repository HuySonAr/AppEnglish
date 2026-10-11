import { z } from 'zod';
import { QuizKind } from '@appenglish/learning-contracts';

export const lessonIdSchema = z.string().uuid();

const kind = z.enum(Object.values(QuizKind));

export const quizRequestSchema = z.object({ kind }).strict();

// Chosen meaning by vocabulary item id.
export const quizAnswersSchema = z
  .object({ kind, answers: z.record(z.string().uuid(), z.string().max(300)).default({}) })
  .strict()
  .refine((value) => Object.keys(value.answers).length <= 200, { message: 'Too many answers' });

// Which finished attempt to review; the latest when omitted.
export const reviewRequestSchema = z
  .object({ attemptNumber: z.number().int().min(1).optional() })
  .strict();

// The word chosen for each blank, in order.
export const fillInAnswersSchema = z
  .object({ answers: z.array(z.string().max(100)).max(50) })
  .strict();
