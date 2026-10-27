import { z } from 'zod';
import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import { GOAL_SCORE, MockAttemptKind, SW_GOAL_SCORE } from '@appenglish/learning-contracts';

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
  .object({ ...reference, answers: z.record(z.string().uuid(), z.string().uuid()).default({}), listeningPosition: z.number().int().min(0).max(200).optional() })
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

const examDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().default(null);
const swScore = z.number().int().min(SW_GOAL_SCORE.min).max(SW_GOAL_SCORE.max).refine((value) => value % SW_GOAL_SCORE.step === 0, 'The target is a multiple of 10');

export const studyGoalSchema = z
  .object({
    lr: z
      .object({
        targetScore: z.number().int().min(GOAL_SCORE.min).max(GOAL_SCORE.max).refine((value) => value % GOAL_SCORE.step === 0, 'The target is a multiple of 5'),
        examDate,
      })
      .strict()
      .nullable()
      .default(null),
    sw: z
      .object({ speakingTarget: swScore.nullable().default(null), writingTarget: swScore.nullable().default(null), examDate })
      .strict()
      .refine((value) => value.speakingTarget !== null || value.writingTarget !== null, { message: 'Set a Speaking or a Writing target', path: ['speakingTarget'] })
      .nullable()
      .default(null),
  })
  .strict()
  .refine((value) => value.lr || value.sw, { message: 'Choose Listening & Reading, Speaking & Writing or both', path: ['lr'] });
