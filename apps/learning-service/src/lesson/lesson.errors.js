import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LearningError } from '../placement/placement.errors.js';

export const lessonErrors = Object.freeze({
  notFound: () =>
    new LearningError(LearningResponseCode.LESSON_NOT_FOUND, 'Lesson was not found', 404),
  locked: (placementRequired) =>
    new LearningError(LearningResponseCode.LESSON_LOCKED, 'Lesson is locked', 409, {
      placementRequired,
    }),
  stepRequired: (step) =>
    new LearningError(
      LearningResponseCode.LESSON_STEP_REQUIRED,
      'An earlier step of the lesson is not finished',
      409,
      { step },
    ),
  reviewNotFound: () =>
    new LearningError(LearningResponseCode.UNIT_REVIEW_NOT_FOUND, 'The unit has no review', 404),
  reviewLocked: (placementRequired, lessonsLeft) =>
    new LearningError(LearningResponseCode.UNIT_REVIEW_LOCKED, 'The unit review is locked until every lesson of the unit is completed', 409, {
      placementRequired,
      lessonsLeft,
    }),
  testNotInProgress: () =>
    new LearningError(
      LearningResponseCode.LESSON_TEST_NOT_IN_PROGRESS,
      'There is no lesson test in progress',
      409,
    ),
});
