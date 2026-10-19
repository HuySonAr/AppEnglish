import { LearningResponseCode } from '@appenglish/learning-contracts';
import { LearningError } from '../placement/placement.errors.js';

export const courseErrors = Object.freeze({
  notFound: () => new LearningError(LearningResponseCode.COURSE_LESSON_NOT_FOUND, 'Course lesson was not found', 404),
  // Lessons and unit checks open one after the other; levels above the
  // learner's are closed (D102).
  locked: () => new LearningError(LearningResponseCode.COURSE_ITEM_LOCKED, 'This part of the course is locked', 409),
  // The listening placement is taken or skipped once (D103); also when it is
  // not published.
  placementDone: () => new LearningError(LearningResponseCode.COURSE_PLACEMENT_DONE, 'The listening placement was already taken or skipped', 409),
  placementUnavailable: () => new LearningError(LearningResponseCode.COURSE_LESSON_NOT_FOUND, 'The listening placement is not available yet', 404),
  // The lesson has no Focus on passage to check (D109).
  noFocus: () =>
    new LearningError(LearningResponseCode.VALIDATION_ERROR, 'This lesson has no Focus on step', 400, {
      issues: [{ path: ['step'], message: 'This lesson has no Focus on step' }],
    }),
  // Only the sentences chosen for writing down are checked one by one.
  noSentence: () =>
    new LearningError(LearningResponseCode.VALIDATION_ERROR, 'This sentence is not one to write down', 400, {
      issues: [{ path: ['segmentId'], message: 'This sentence is not one to write down' }],
    }),
});
