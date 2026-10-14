import { z } from 'zod';
import { ListeningMode } from '@appenglish/learning-contracts';

export const exerciseIdSchema = z.string().uuid();

const mode = z.enum(Object.values(ListeningMode)).default(ListeningMode.FULL);

// Which mode the exercise is opened in.
export const listeningOpenSchema = z.object({ mode }).strict();

// One line checked as the learner goes (D93): the line and what was written
// for it, keyed as in a whole check.
export const lineAnswersSchema = z
  .object({ mode, segmentId: z.string().uuid(), answers: z.record(z.string().max(80), z.string().max(2000)).default({}) })
  .strict()
  .refine((value) => Object.keys(value.answers).length <= 50, { message: 'Too many answers' });

// What the learner wrote: by sentence id (full mode) or by blank number
// (blanks mode).
export const dictationAnswersSchema = z
  .object({ mode, answers: z.record(z.string().max(80), z.string().max(2000)).default({}) })
  .strict()
  .refine((value) => Object.keys(value.answers).length <= 200, { message: 'Too many answers' });
