import { z } from 'zod';
import { AccountRole } from '@appenglish/auth-contracts';
import { LearningEventType } from '@appenglish/learning-contracts';

// The learner an admin asks about (D114).
export const learnerIdSchema = z.string().uuid();

export const actorSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(Object.values(AccountRole)),
  // gRPC sends '' when the gateway passed none.
  email: z.string().max(320).optional(),
});

const count = z.number().int().min(0);
const isoDate = z.string().datetime({ offset: true });

// The per-skill counts every reported test carries.
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

// Payloads of the learning.results messages (LearningEventType). Fields
// progress does not use are allowed and ignored.
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

// The message envelope; the payload is checked by type in the service.
export const resultMessageSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1).max(40),
  occurredAt: isoDate.optional(),
  payload: z.record(z.unknown()),
});

export const payloadSchemas = Object.freeze({
  [LearningEventType.LESSON_TEST_SUBMITTED]: lessonTestSubmittedSchema,
  [LearningEventType.LESSON_COMPLETED]: lessonCompletedSchema,
  [LearningEventType.MOCK_SUBMITTED]: mockSubmittedSchema,
});
