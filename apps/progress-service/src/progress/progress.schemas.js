import { z } from 'zod';
import { AccountRole } from '@appenglish/auth-contracts';
import { LearningEventType, StudyActivity } from '@appenglish/learning-contracts';

export const learnerIdSchema = z.string().uuid();

export const actorSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(Object.values(AccountRole)),
  email: z.string().max(320).optional(),
});

const count = z.number().int().min(0);
const isoDate = z.string().datetime({ offset: true });

const skillCounts = {
  attemptNumber: z.number().int().min(1),
  correctCount: count,
  totalCount: count,
  listeningCorrect: count,
  listeningTotal: count,
  readingCorrect: count,
  readingTotal: count,
  submittedAt: isoDate,
};

export const lessonTestSubmittedSchema = z
  .object({
    attemptId: z.string().uuid(),
    accountId: z.string().uuid(),
    lessonId: z.string().uuid(),
    ...skillCounts,
  })
  .passthrough();

export const lessonCompletedSchema = z
  .object({
    accountId: z.string().uuid(),
    lessonId: z.string().uuid(),
    completedAt: isoDate,
  })
  .passthrough();

export const mockSubmittedSchema = z
  .object({
    attemptId: z.string().uuid(),
    accountId: z.string().uuid(),
    accountEmail: z.string().max(320).optional().default(''),
    mockTestId: z.string().uuid(),
    mockTestTitle: z.string().max(200).optional().default(''),
    kind: z.string(),
    ...skillCounts,
  })
  .passthrough();

export const resultMessageSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1).max(40),
  requestId: z.string().max(64).optional(),
  occurredAt: isoDate.optional(),
  payload: z.record(z.unknown()),
});

export const activityRecordedSchema = z
  .object({
    accountId: z.string().uuid(),
    activity: z.enum(Object.values(StudyActivity)),
    occurredAt: isoDate,
  })
  .passthrough();

export const unitReviewPassedSchema = z
  .object({
    accountId: z.string().uuid(),
    unitId: z.string().uuid(),
    unitTitle: z.string().max(200).optional().default(''),
    nextUnitId: z.string().uuid().nullable().optional().default(null),
    nextUnitTitle: z.string().max(200).nullable().optional().default(null),
    passedAt: isoDate,
  })
  .passthrough();

export const courseLevelUpSchema = z
  .object({
    accountId: z.string().uuid(),
    from: z.string().min(1).max(4),
    to: z.string().min(1).max(4),
    reachedAt: isoDate,
  })
  .passthrough();

export const practiceScoredSchema = z
  .object({
    accountId: z.string().uuid(),
    submissionId: z.string().uuid(),
    promptId: z.string().uuid(),
    kind: z.string().min(1).max(20),
    title: z.string().max(200).optional().default(''),
    status: z.enum(['DONE', 'FAILED']),
    total: z.number().min(0).max(10).nullable(),
    scoredAt: isoDate,
  })
  .passthrough();

export const reviewCompletedSchema = z
  .object({
    accountId: z.string().uuid(),
    submissionId: z.string().uuid(),
    promptId: z.string().uuid(),
    kind: z.string().min(1).max(20),
    title: z.string().max(200).optional().default(''),
    total: z.number().min(0).max(10),
    reviewedAt: isoDate,
  })
  .passthrough();

export const reviewExpiredSchema = z
  .object({
    accountId: z.string().uuid(),
    submissionId: z.string().uuid(),
    promptId: z.string().uuid(),
    kind: z.string().min(1).max(20),
    title: z.string().max(200).optional().default(''),
    expiredAt: isoDate,
  })
  .passthrough();

export const markReadSchema = z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).strict();

export const payloadSchemas = Object.freeze({
  [LearningEventType.LESSON_TEST_SUBMITTED]: lessonTestSubmittedSchema,
  [LearningEventType.LESSON_COMPLETED]: lessonCompletedSchema,
  [LearningEventType.MOCK_SUBMITTED]: mockSubmittedSchema,
  [LearningEventType.ACTIVITY_RECORDED]: activityRecordedSchema,
  [LearningEventType.UNIT_REVIEW_PASSED]: unitReviewPassedSchema,
  [LearningEventType.COURSE_LEVEL_UP]: courseLevelUpSchema,
  [LearningEventType.SPEAKING_SCORED]: practiceScoredSchema,
  [LearningEventType.WRITING_SCORED]: practiceScoredSchema,
  [LearningEventType.REVIEW_COMPLETED]: reviewCompletedSchema,
  [LearningEventType.REVIEW_EXPIRED]: reviewExpiredSchema,
});
