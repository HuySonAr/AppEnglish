import { LearningResponseCode } from '@appenglish/learning-contracts';

export class LearningError extends Error {
  constructor(code, message, status = 400, data = {}) {
    super(message);
    this.name = 'LearningError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export const placementErrors = Object.freeze({
  forbiddenRole: () =>
    new LearningError(
      LearningResponseCode.FORBIDDEN_ROLE,
      'Account does not have the required role',
      403,
    ),
  notAvailable: () =>
    new LearningError(
      LearningResponseCode.PLACEMENT_NOT_AVAILABLE,
      'The placement test is not available yet',
      409,
    ),
  alreadyTaken: () =>
    new LearningError(
      LearningResponseCode.PLACEMENT_ALREADY_TAKEN,
      'The placement test can only be taken once',
      409,
    ),
  notInProgress: () =>
    new LearningError(
      LearningResponseCode.PLACEMENT_NOT_IN_PROGRESS,
      'There is no placement attempt in progress',
      409,
    ),
});
