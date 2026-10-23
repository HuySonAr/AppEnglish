import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LearningError } from '../placement/placement.errors.js';

export const mockErrors = Object.freeze({
  notFound: () =>
    new LearningError(LearningResponseCode.MOCK_TEST_NOT_FOUND, 'Mock test was not found', 404),
  mistakeNotFound: () => new LearningError(LearningResponseCode.MOCK_TEST_NOT_FOUND, 'This question is not in your review list', 404),
  goalInvalid: (message) => new LearningError(LearningResponseCode.VALIDATION_ERROR, message, 400),
  notInProgress: () =>
    new LearningError(
      LearningResponseCode.MOCK_TEST_NOT_IN_PROGRESS,
      'There is no mock test attempt in progress',
      409,
    ),
});
