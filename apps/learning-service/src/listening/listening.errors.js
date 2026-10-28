import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LearningError } from '../placement/placement.errors.js';

export const listeningErrors = Object.freeze({
  notFound: () =>
    new LearningError(LearningResponseCode.LISTENING_EXERCISE_NOT_FOUND, 'Listening exercise was not found', 404),
  noLine: () =>
    new LearningError(LearningResponseCode.VALIDATION_ERROR, 'This line is not part of the exercise', 400, {
      issues: [{ path: ['segmentId'], message: 'This line is not part of the exercise' }],
    }),
  wrongMode: () =>
    new LearningError(LearningResponseCode.VALIDATION_ERROR, 'This exercise cannot be practised in this mode', 400, {
      issues: [{ path: ['mode'], message: 'This exercise cannot be practised in this mode' }],
    }),
  badBlanks: () =>
    new LearningError(LearningResponseCode.VALIDATION_ERROR, 'The answers do not match the hidden words', 400, {
      issues: [{ path: ['answers'], message: 'The answers do not match the hidden words' }],
    }),
  noBlanks: () =>
    new LearningError(LearningResponseCode.VALIDATION_ERROR, 'This exercise has no blanks to fill in', 400, {
      issues: [{ path: ['mode'], message: 'This exercise has no blanks to fill in' }],
    }),
});
