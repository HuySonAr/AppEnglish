import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LearningError } from '../placement/placement.errors.js';

export const writingErrors = Object.freeze({
  promptNotFound: () => new LearningError(LearningResponseCode.PRACTICE_PROMPT_NOT_FOUND, 'The writing prompt was not found', 404),
  submissionNotFound: () => new LearningError(LearningResponseCode.SUBMISSION_NOT_FOUND, 'The submission was not found', 404),
  answerInvalid: (message, data = {}) => new LearningError(LearningResponseCode.ANSWER_INVALID, message, 400, data),
  keyInvalid: (message) => new LearningError(LearningResponseCode.AI_KEY_INVALID, message || 'Gemini rejected this key', 400),
  modelUnavailable: () => new LearningError(LearningResponseCode.AI_KEY_INVALID, 'This model is not available for your key', 400, { issues: [{ path: ['model'], message: 'This model is not available for your key' }] }),
  keyMissing: () => new LearningError(LearningResponseCode.AI_KEY_INVALID, 'Save a Gemini key first', 409),
  keyUnavailable: () => new LearningError(LearningResponseCode.AI_KEY_UNAVAILABLE, 'The key cannot be checked right now; try again in a minute', 503),
});
