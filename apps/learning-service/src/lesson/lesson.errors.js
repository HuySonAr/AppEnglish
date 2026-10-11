import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LearningError } from '../placement/placement.errors.js';

export const lessonErrors = Object.freeze({
  notFound: () =>
    new LearningError(LearningResponseCode.LESSON_NOT_FOUND, 'Lesson was not found', 404),
  // placementRequired: the learner must take or skip the placement test first.
  locked: (placementRequired) =>
    new LearningError(LearningResponseCode.LESSON_LOCKED, 'Lesson is locked', 409, {
      placementRequired,
    }),
  // step: the step that has to be finished first.
  stepRequired: (step) =>
    new LearningError(
      LearningResponseCode.LESSON_STEP_REQUIRED,
      'An earlier step of the lesson is not finished',
      409,
      { step },
    ),
  testNotInProgress: () =>
    new LearningError(
      LearningResponseCode.LESSON_TEST_NOT_IN_PROGRESS,
      'There is no lesson test in progress',
      409,
    ),
});
