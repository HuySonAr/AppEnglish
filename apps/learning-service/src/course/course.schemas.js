import { z } from 'zod';
import { CourseLessonStep } from '@appenglish/learning-contracts';

export const unitIdSchema = z.string().uuid();
export const itemIdSchema = unitIdSchema;

// Which lesson of the unit; versionId keeps the checks on the version the
// learner opened.
const lessonRef = { lessonId: z.string().uuid(), versionId: z.string().uuid().optional() };

// Option id by question id, and what was written by sentence id.
const answers = z
  .record(z.string().max(80), z.string().max(2000))
  .default({})
  .refine((value) => Object.keys(value).length <= 50, { message: 'Too many answers' });

export const lessonOpenSchema = z.object({ lessonId: lessonRef.lessonId }).strict();

// One step checked as the learner goes: the main-idea question, the detail
// questions, or one sentence written down (segmentId).
export const stepCheckSchema = z
  .object({ ...lessonRef, step: z.enum(Object.values(CourseLessonStep)), segmentId: z.string().uuid().optional(), answers })
  .strict()
  .refine((value) => value.step !== CourseLessonStep.CLOSE || value.segmentId, { message: 'Choose the sentence', path: ['segmentId'] });

// Every answer of the lesson, scored together when the learner finishes.
export const lessonAnswersSchema = z.object({ ...lessonRef, answers }).strict();

// The answers of a unit check, level test or the placement: option id by
// question id.
export const testAnswersSchema = z.object({ versionId: z.string().uuid().optional(), answers }).strict();

// A sentence of the mistakes notebook written again.
export const mistakeCheckSchema = z.object({ text: z.string().max(2000).default('') }).strict();
