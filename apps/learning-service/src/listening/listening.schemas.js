import { z } from 'zod';
import { ListeningMode } from '@appenglish/learning-contracts';

export const exerciseIdSchema = z.string().uuid();

const mode = z.enum(Object.values(ListeningMode)).default(ListeningMode.FULL);

export const listeningOpenSchema = z.object({ mode }).strict();

export const lineAnswersSchema = z
  .object({ mode, segmentId: z.string().uuid(), answers: z.record(z.string().max(80), z.string().max(2000)).default({}) })
  .strict()
  .refine((value) => Object.keys(value.answers).length <= 50, { message: 'Too many answers' });

export const dictationAnswersSchema = z
  .object({ mode, answers: z.record(z.string().max(80), z.string().max(2000)).default({}) })
  .strict()
  .refine((value) => Object.keys(value.answers).length <= 200, { message: 'Too many answers' });
