import { z } from 'zod';
import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import { GOAL_SCORE, MockAttemptKind } from '@appenglish/learning-contracts';

export const mockIdSchema = z.string().uuid();

const reference = {
  kind: z.enum(Object.values(MockAttemptKind)),
  partKey: z.enum(LESSON_TEST_PARTS.map((part) => part.key)).optional(),
};
const partMatchesKind = [
  (value) => (value.kind === MockAttemptKind.MINI) === Boolean(value.partKey),
  { message: 'A mini test needs a part; a full test takes none', path: ['partKey'] },
];

export const attemptReferenceSchema = z.object(reference).strict().refine(...partMatchesKind);

export const attemptAnswersSchema = z
  .object({ ...reference, answers: z.record(z.string().uuid(), z.string().uuid()).default({}) })
  .strict()
  .refine(...partMatchesKind)
  .refine((value) => Object.keys(value.answers).length <= 400, { message: 'Too many answers' });

export const attemptReviewSchema = z
  .object({ ...reference, attemptNumber: z.number().int().min(1).optional() })
  .strict()
  .refine(...partMatchesKind);

const sectionTable = z
  .array(z.number().int().min(5).max(495).multipleOf(5))
  .length(101)
  .refine((values) => values.every((value, index) => index === 0 || value >= values[index - 1]), {
    message: 'Scores must not go down as right answers go up',
  });

export const scoreConversionSchema = z
  .object({ listening: sectionTable, reading: sectionTable })
  .strict();

export const mistakePracticeSchema = z.object({ partKey: z.enum(LESSON_TEST_PARTS.map((spec) => spec.key)).optional() }).strict();
export const mistakeAnswerSchema = z.object({ questionId: z.string().uuid(), optionId: z.string().uuid().nullable() }).strict();

export const studyGoalSchema = z
  .object({
    targetScore: z.number().int().min(GOAL_SCORE.min).max(GOAL_SCORE.max).refine((value) => value % GOAL_SCORE.step === 0, 'The target is a multiple of 5'),
    examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().default(null),
  })
  .strict();
