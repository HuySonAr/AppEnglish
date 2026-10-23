import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LearningError } from '../placement/placement.errors.js';

export const speakingErrors = Object.freeze({
  promptNotFound: () => new LearningError(LearningResponseCode.PRACTICE_PROMPT_NOT_FOUND, 'The speaking prompt was not found', 404),
  submissionNotFound: () => new LearningError(LearningResponseCode.SUBMISSION_NOT_FOUND, 'The submission was not found', 404),
  recordingInvalid: (reason, message) => new LearningError(LearningResponseCode.RECORDING_INVALID, message, 400, { reason }),
});
