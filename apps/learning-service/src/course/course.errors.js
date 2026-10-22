import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LearningError } from '../placement/placement.errors.js';

export const courseErrors = Object.freeze({
  notFound: () => new LearningError(LearningResponseCode.COURSE_LESSON_NOT_FOUND, 'This part of the course was not found', 404),
  // A level opens once the level test before it is passed (D145).
  locked: () => new LearningError(LearningResponseCode.COURSE_ITEM_LOCKED, 'This level is locked: pass the test of the level before it', 409),
  noSentence: () =>
    new LearningError(LearningResponseCode.VALIDATION_ERROR, 'This sentence is not in the recording', 400, {
      issues: [{ path: ['segmentId'], message: 'This sentence is not in the recording' }],
    }),
  // The blanks mode needs blanks written for the sentence (D143).
  noBlanks: () =>
    new LearningError(LearningResponseCode.VALIDATION_ERROR, 'This sentence has no blanks', 400, {
      issues: [{ path: ['mode'], message: 'This sentence has no blanks' }],
    }),
});
