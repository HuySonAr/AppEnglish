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
  mediaNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Media was not found', 404),
  placementNotFound: () =>
    new ContentError(ContentResponseCode.CONTENT_NOT_FOUND, 'Placement test is not published', 404),
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
      'The dictionary service is not answering; try again or enter the pronunciation manually',
      503,
    ),
  mediaInvalid: (reason, message) =>
    new ContentError(ContentResponseCode.MEDIA_INVALID, message, 400, { reason }),
});
