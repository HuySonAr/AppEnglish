import { ContentResponseCode } from '@appenglish/content-contracts';

export class ContentError extends Error {
  constructor(code, message, status = 400, data = {}) {
    super(message);
    this.name = 'ContentError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export const contentErrors = Object.freeze({
  forbiddenRole: () =>
    new ContentError(
      ContentResponseCode.FORBIDDEN_ROLE,
      'Account does not have the required role',
      403,
    ),
  unitNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Unit was not found', 404),
  lessonNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Lesson was not found', 404),
  unitReviewNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'The unit has no published review', 404),
  mediaNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Media was not found', 404),
  examTypeNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Exam type was not found', 404),
  // reason: NAME_TAKEN, or NO_EDITOR when tests cannot be written for the type yet.
  examTypeInvalid: (reason, message) =>
    new ContentError(ContentResponseCode.EXAM_TYPE_INVALID, message, 409, { reason }),
  listeningTopicNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Listening topic was not found', 404),
  // reason: NAME_TAKEN, or NO_EDITOR when exercises cannot be written for the topic yet.
  listeningTopicInvalid: (reason, message) =>
    new ContentError(ContentResponseCode.LISTENING_TOPIC_INVALID, message, 409, { reason }),
  // Auto-time (D97): RabbitMQ cannot be reached, so no job can be sent.
  speechUnavailable: () =>
    new ContentError(
      ContentResponseCode.SPEECH_UNAVAILABLE,
      'Auto-time is not available right now (the message broker cannot be reached); try again later',
      503,
    ),
  // reason: NO_AUDIO (no saved recording with an address), NO_LINES.
  autoTimeInvalid: (reason, message) =>
    new ContentError(ContentResponseCode.CONTENT_INVALID_STATE, message, 409, { reason }),
  courseItemNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Course unit or level test was not found', 404),
  // reason: LEVEL_TEST_EXISTS (one level test per level) or PLACEMENT_EXISTS
  // (one listening placement).
  courseItemInvalid: (reason, message) =>
    new ContentError(ContentResponseCode.CONTENT_INVALID_STATE, message, 409, { reason }),
  listeningExerciseNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Listening exercise was not found', 404),
  // Deleting is refused (D118): a listening exercise still used by the course
  // (reason COURSE_REFERENCE), or a published listening placement.
  inUse: (reason, message) =>
    new ContentError(ContentResponseCode.CONTENT_IN_USE, message, 409, { reason }),
  mockNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Mock test was not found', 404),
  placementNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Placement test is not published', 404),
  // Restoring (D122) copies a published or taken-down version; the draft
  // itself is what the editor already holds.
  versionIsDraft: () =>
    new ContentError(ContentResponseCode.CONTENT_INVALID_STATE, 'This version is the current draft', 409),
  // Deleting a version (D128): the one learners get stays until another is
  // published or it is taken down.
  versionIsCurrent: () =>
    new ContentError(ContentResponseCode.CONTENT_INVALID_STATE, 'This version is the one learners get; unpublish it or publish another first', 409, { reason: 'CURRENT' }),
  noDraft: () =>
    new ContentError(
      ContentResponseCode.CONTENT_INVALID_STATE,
      'There is no draft to publish',
      409,
    ),
  notPublishable: (issues) =>
    new ContentError(
      ContentResponseCode.CONTENT_NOT_PUBLISHABLE,
      'Content does not meet the publishing requirements',
      409,
      { issues },
    ),
  pronunciationUnavailable: () =>
    new ContentError(
      ContentResponseCode.PRONUNCIATION_UNAVAILABLE,
      'The pronunciation service is not answering; try again or enter the pronunciation manually',
      503,
    ),
  mediaInvalid: (reason, message) =>
    new ContentError(ContentResponseCode.MEDIA_INVALID, message, 400, { reason }),
});
