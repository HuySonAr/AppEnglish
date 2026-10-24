import { z } from 'zod';
import { SpokenWordStatus } from '@appenglish/learning-contracts';

export const promptIdSchema = z.string().uuid();

export const submitSpeakingSchema = z.object({ durationSeconds: z.number().min(0).max(600) }).strict();

const score = z.number().min(0).max(10);

export const readAloudResultSchema = z.object({
  words: z
    .array(
      z.object({
        text: z.string().max(200),
        status: z.enum(Object.values(SpokenWordStatus)).nullable(),
        confidence: z.number().min(0).max(1).nullable(),
      }),
    )
    .max(500),
  extra: z.array(z.string().max(200)).max(500),
  scores: z.object({ accuracy: score, completeness: score, fluency: score, total: score }),
  wordsPerMinute: z.number().min(0).max(1000),
  pauses: z.number().int().min(0).max(1000),
  heard: z.string().max(1000).optional().default(''),
});

export const openWhisperSchema = z.object({
  transcript: z.string().max(4000),
  scores: z.object({ fluency: score, pronunciation: score }),
  wordsPerMinute: z.number().min(0).max(1000),
  pauses: z.number().int().min(0).max(1000),
  fillers: z.number().int().min(0).max(1000),
  words: z.number().int().min(0).max(2000),
});

const band = z.number().min(1).max(5);
const line = z.string().max(300);

export const openGradingSchema = z.object({
  criteria: z.object({ task: band, vocabulary: band, grammar: band, coherence: band }),
  feedback: z.string().max(2000),
  errors: z.array(z.object({ text: line.min(1), suggestion: line, explanation: line })).max(30),
  rewrite: z.string().max(6000),
  model: z.string().max(60).optional(),
});
