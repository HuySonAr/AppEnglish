import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LearningError } from '../placement/placement.errors.js';

export const mockErrors = Object.freeze({
  notFound: () =>
    new LearningError(LearningResponseCode.MOCK_TEST_NOT_FOUND, 'Mock test was not found', 404),
  notInProgress: () =>
    new LearningError(
      LearningResponseCode.MOCK_TEST_NOT_IN_PROGRESS,
      'There is no mock test attempt in progress',
      409,
    ),
});
