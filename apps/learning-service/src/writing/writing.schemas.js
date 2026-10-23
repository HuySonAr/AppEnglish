import { z } from 'zod';
import { AI_KEY_LIMITS, WRITING_CRITERIA, WRITING_LIMITS } from '@appenglish/learning-contracts';

export const submitWritingSchema = z.object({ text: z.string().max(WRITING_LIMITS.answerChars * 2) }).strict();

export const saveAiKeySchema = z
  .object({ key: z.string().trim().min(AI_KEY_LIMITS.min).max(AI_KEY_LIMITS.max).regex(AI_KEY_LIMITS.pattern, 'This does not look like a Gemini API key') })
  .strict();

const score = z.number().min(1).max(5);
const line = z.string().max(WRITING_LIMITS.errorText);

export const writingResultSchema = z.object({
  criteria: z.object(Object.fromEntries(WRITING_CRITERIA.map((key) => [key, score]))),
  scores: z.object({ vocabulary: score, grammar: score, coherence: score, task: score, total: score }),
  feedback: z.string().max(WRITING_LIMITS.feedbackChars),
  errors: z.array(z.object({ text: line.min(1), suggestion: line, explanation: line })).max(WRITING_LIMITS.errors),
  rewrite: z.string().max(WRITING_LIMITS.rewriteChars),
});
