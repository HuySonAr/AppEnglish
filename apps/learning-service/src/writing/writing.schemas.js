import { z } from 'zod';
import { AI_KEY_LIMITS, WRITING_CRITERIA, WRITING_LIMITS, isGradingModel, knownGeminiModel } from '@appenglish/learning-contracts';

export const submitWritingSchema = z.object({ text: z.string().max(WRITING_LIMITS.answerChars * 2) }).strict();

export const saveAiKeySchema = z
  .object({ key: z.string().trim().min(AI_KEY_LIMITS.min).max(AI_KEY_LIMITS.max).regex(AI_KEY_LIMITS.pattern, 'This does not look like a Gemini API key') })
  .strict();

export const aiSettingsSchema = z
  .object({
    model: z.string().refine(isGradingModel, 'Choose a Gemini model for text'),
    thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']).nullable().default(null),
  })
  .strict()
  .refine((value) => value.thinkingLevel === null || Boolean(knownGeminiModel(value.model)?.levels.includes(value.thinkingLevel)), {
    message: 'This model does not offer that thinking level',
    path: ['thinkingLevel'],
  });

const score = z.number().min(1).max(5);
const line = z.string().max(WRITING_LIMITS.errorText);

export const writingResultSchema = z.object({
  criteria: z.object(Object.fromEntries(WRITING_CRITERIA.map((key) => [key, score]))),
  scores: z.object({ vocabulary: score, grammar: score, coherence: score, task: score, total: score }),
  feedback: z.string().max(WRITING_LIMITS.feedbackChars),
  errors: z.array(z.object({ text: line.min(1), suggestion: line, explanation: line })).max(WRITING_LIMITS.errors),
  rewrite: z.string().max(WRITING_LIMITS.rewriteChars),
  etsScore: z.number().int().min(0).max(5).optional(),
  model: z.string().max(60).optional(),
});

export const modelListSchema = z.object({ fresh: z.boolean().optional().default(false) }).strict();
