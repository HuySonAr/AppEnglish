import { z } from 'zod';
import { AccountRole } from '@appenglish/auth-contracts';

export const actorSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(Object.values(AccountRole)),
});

// Chosen option id by question id. Unknown ids are ignored when scoring.
export const answersSchema = z
  .object({ answers: z.record(z.string().uuid(), z.string().uuid()).default({}) })
  .strict()
  .refine((value) => Object.keys(value.answers).length <= 100, {
    message: 'Too many answers',
  });

export const settingsSchema = z
  .object({
    unit2Threshold: z.number().int().min(1).max(100),
    unit3Threshold: z.number().int().min(1).max(100),
  })
  .strict()
  .refine((value) => value.unit2Threshold < value.unit3Threshold, {
    message: 'The unit 3 threshold must be higher than the unit 2 threshold',
    path: ['unit3Threshold'],
  });
