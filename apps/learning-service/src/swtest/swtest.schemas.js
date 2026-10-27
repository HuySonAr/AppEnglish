import { z } from 'zod';
import { SwSection } from '@appenglish/content-contracts';
import { SW_RAW_MAX } from '@appenglish/learning-contracts';

export const swTestIdSchema = z.string().uuid();
const section = z.enum(Object.values(SwSection));

export const swSectionSchema = z.object({ section }).strict();
export const swResultSchema = z.object({ section, attemptNumber: z.number().int().min(1).optional() }).strict();
const scaledTable = (length) =>
  z
    .array(z.number().int().min(0).max(200).multipleOf(10))
    .length(length)
    .refine((values) => values.every((value, index) => index === 0 || value >= values[index - 1]), { message: 'Scores must not go down as raw points go up' });

export const swConversionSchema = z.object({ speaking: scaledTable(SW_RAW_MAX.speaking + 1), writing: scaledTable(SW_RAW_MAX.writing + 1) }).strict();

export const swRecordingSchema = z
  .object({ section: z.literal(SwSection.SPEAKING), questionNumber: z.number().int().min(1).max(11), durationSeconds: z.number().min(0).max(600) })
  .strict();
export const swAnswersSchema = z
  .object({
    section: z.literal(SwSection.WRITING),
    answers: z.record(z.string().regex(/^[1-8]$/), z.string().max(8000)).default({}),
    lockThrough: z.number().int().min(0).max(8).optional(),
  })
  .strict();
