import { ResponseCode } from '@appenglish/auth-contracts';
import { ContentResponseCode } from '@appenglish/content-contracts';
import { LearningResponseCode } from '@appenglish/learning-contracts';

const messages = Object.freeze({
  [ResponseCode.AUTH_INVALID_CREDENTIALS]: 'Email or password is invalid.',
  [ResponseCode.AUTH_EMAIL_NOT_VERIFIED]: 'Verify your email before signing in.',
  [ResponseCode.AUTH_ACCOUNT_DISABLED]: 'This account is disabled.',
  [ResponseCode.AUTH_ACCOUNT_SUSPENDED]: 'This account is suspended.',
  [ResponseCode.AUTH_OTP_INVALID]: 'The verification code is invalid.',
  [ResponseCode.AUTH_OTP_EXPIRED]: 'The verification code has expired.',
  [ResponseCode.AUTH_OTP_ATTEMPTS_EXCEEDED]: 'Too many code attempts. Request a new code.',
  [ResponseCode.AUTH_OTP_RATE_LIMITED]: 'Please wait before requesting another code.',
  [ResponseCode.AUTH_EMAIL_ALREADY_REGISTERED]: 'This email is already registered.',
  [ResponseCode.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ResponseCode.AUTH_ADMIN_LAST_ACCOUNT]: 'The last active administrator cannot be demoted or disabled.',
  [ResponseCode.AUTH_EMAIL_VERIFICATION_REQUIRED]: 'This account must verify its email before it can be activated.',
  [ResponseCode.AUTH_FORBIDDEN_ROLE]: 'You do not have permission to do this.',
  [ResponseCode.AUTH_CURRENT_PASSWORD_INVALID]: 'The current password is incorrect.',
  [ResponseCode.AVATAR_INVALID]: 'This picture cannot be used.',
  [ResponseCode.AUTH_REASON_REQUIRED]: 'Give a reason before locking the account.',
  [ResponseCode.RATE_LIMITED]: 'Too many attempts. Please wait a moment and try again.',
  [ResponseCode.EMAIL_SEND_ERROR]: 'We could not send the email. Check the server email configuration.',
  [ResponseCode.VALIDATION_ERROR]: 'Please check the highlighted fields.',
  [ContentResponseCode.CONTENT_NOT_FOUND]: 'This content no longer exists.',
  [ContentResponseCode.CONTENT_INVALID_STATE]: 'There is no draft to publish.',
  [ContentResponseCode.CONTENT_NOT_PUBLISHABLE]: 'This content does not meet the publishing requirements yet.',
  [ContentResponseCode.MEDIA_INVALID]: 'This file type or size is not allowed.',
  [ContentResponseCode.EXAM_TYPE_INVALID]: 'This exam type cannot be used here.',
  [ContentResponseCode.CONTENT_IN_USE]: 'Learners already have results for this content; unpublish it instead of deleting.',
  [ContentResponseCode.PRONUNCIATION_UNAVAILABLE]: 'The speech service is not answering. Check that it is running, then try again, or enter the pronunciation yourself.',
  [LearningResponseCode.PLACEMENT_NOT_AVAILABLE]: 'The placement test is not available yet.',
  [LearningResponseCode.PLACEMENT_ALREADY_TAKEN]: 'You have already taken or skipped the placement test.',
  [LearningResponseCode.PLACEMENT_NOT_IN_PROGRESS]: 'There is no placement test in progress.',
  [LearningResponseCode.LESSON_NOT_FOUND]: 'This lesson is not available.',
  [LearningResponseCode.LESSON_LOCKED]: 'This lesson is still locked.',
  [LearningResponseCode.LESSON_STEP_REQUIRED]: 'Finish the earlier step of the lesson first.',
  [LearningResponseCode.LESSON_TEST_NOT_IN_PROGRESS]: 'There is no lesson test in progress.',
  [LearningResponseCode.MOCK_TEST_NOT_FOUND]: 'This mock test is not available.',
  [LearningResponseCode.MOCK_TEST_NOT_IN_PROGRESS]: 'There is no mock test in progress.',
  [LearningResponseCode.COURSE_LESSON_NOT_FOUND]: 'This part of the listening course is not available.',
  [LearningResponseCode.COURSE_ITEM_LOCKED]: 'This part of the listening course is still locked. Pass the one before it first.',
  [LearningResponseCode.COURSE_PLACEMENT_DONE]: 'You have already taken or skipped the listening placement.',
  [LearningResponseCode.UNIT_REVIEW_NOT_FOUND]: 'This unit has no review.',
  [LearningResponseCode.UNIT_REVIEW_LOCKED]: 'The unit review opens once every lesson of the unit is completed.',
  [LearningResponseCode.PRACTICE_PROMPT_NOT_FOUND]: 'This prompt is not available.',
  [LearningResponseCode.SUBMISSION_NOT_FOUND]: 'This attempt is not available.',
  [LearningResponseCode.RECORDING_INVALID]: 'This recording cannot be used. Record again, up to 30 seconds.',
  [LearningResponseCode.AI_KEY_INVALID]: 'Gemini rejected this key. Check that you copied all of it.',
  [LearningResponseCode.AI_KEY_UNAVAILABLE]: 'The key cannot be checked right now. Try again in a minute.',
  [LearningResponseCode.ANSWER_INVALID]: 'Keep your text within the word limits.',
  [LearningResponseCode.REVIEW_LIMIT_REACHED]: 'You have used your three teacher reviews this week.',
  [LearningResponseCode.REVIEW_NOT_ALLOWED]: 'This answer cannot be sent to a teacher.',
  [LearningResponseCode.REVIEW_NOT_FOUND]: 'This answer is no longer waiting for a review.',
  [LearningResponseCode.REVIEW_LOCKED]: 'Another teacher is reviewing this answer, or your two hours ended.',
});

const mediaReasons = Object.freeze({
  MEDIA_MIME_TYPE_NOT_ALLOWED: 'This file format is not allowed. Use MP3, MP4 or M4A for audio and JPEG, PNG or WebP for images.',
  MEDIA_EXTENSION_NOT_ALLOWED: 'This file extension is not allowed. Use .mp3, .mp4 or .m4a for audio and .jpg, .jpeg, .png or .webp for images.',
  MEDIA_FILE_TOO_LARGE: 'This file is larger than the upload limit.',
  AVATAR_MIME_TYPE_NOT_ALLOWED: 'Use a JPEG, PNG or WebP picture.',
  AVATAR_EXTENSION_NOT_ALLOWED: 'Use a .jpg, .png or .webp picture.',
  AVATAR_EMPTY: 'The picture is empty.',
  AVATAR_FILE_TOO_LARGE: 'This picture is larger than the upload limit.',
});

export function responseData(response) {
  return response?.data?.data ?? {};
}

export function responseCode(response) {
  return response?.data?.code;
}

export function errorCode(error) {
  return error?.response?.data?.code;
}

export function errorReason(error) {
  const code = errorCode(error);
  if (code !== ResponseCode.AUTH_ACCOUNT_DISABLED && code !== ResponseCode.AUTH_ACCOUNT_SUSPENDED) return null;
  const reason = error?.response?.data?.data?.reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

export function errorNextAction(error) {
  return error?.response?.data?.data?.nextAction ?? null;
}

function waitText(seconds) {
  if (!seconds) return '';
  if (seconds < 90) return ` Try again in ${Math.max(1, Math.round(seconds))} second${seconds === 1 ? '' : 's'}.`;
  const minutes = Math.ceil(seconds / 60);
  return ` Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

export function getApiErrorMessage(error) {
  const code = errorCode(error);
  if (code === ResponseCode.RATE_LIMITED || error?.response?.status === 429)
    return `Too many attempts.${waitText(error?.response?.data?.data?.retryAfterSeconds)}`;
  if (error?.response?.status === 413) return mediaReasons.MEDIA_FILE_TOO_LARGE;
  const reason = mediaReasons[error?.response?.data?.data?.reason];
  if ((code === ContentResponseCode.MEDIA_INVALID || code === ResponseCode.AVATAR_INVALID) && reason) return reason;
  return messages[code] || error?.response?.data?.data?.message || 'Something went wrong. Please try again.';
}

export function isUnauthorizedError(error) {
  return error?.response?.status === 401 || error?.response?.data?.code === ResponseCode.AUTH_SESSION_EXPIRED;
}
