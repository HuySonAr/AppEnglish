import path from 'node:path';
import { allowedMediaTypes, defaultMaxFileSizeBytes } from './media.constants.js';
import { MediaValidationError } from './media.errors.js';

export function validateMediaUpload(input, maxFileSizeBytes = defaultMaxFileSizeBytes) {
  const typePolicy = allowedMediaTypes[input.kind];
  if (!typePolicy) throw new MediaValidationError('MEDIA_KIND_NOT_SUPPORTED', 'Media kind is not supported');
  if (!typePolicy.mimeTypes.includes(input.mimeType.toLowerCase())) {
    throw new MediaValidationError('MEDIA_MIME_TYPE_NOT_ALLOWED', 'Media MIME type is not allowed');
  }
  const extension = path.extname(input.fileName).toLowerCase();
  if (!typePolicy.extensions.includes(extension)) {
    throw new MediaValidationError('MEDIA_EXTENSION_NOT_ALLOWED', 'Media file extension is not allowed');
  }
  if (input.sizeBytes > maxFileSizeBytes) {
    throw new MediaValidationError('MEDIA_FILE_TOO_LARGE', 'Media file exceeds the configured size limit');
  }
  if (input.data.byteLength !== input.sizeBytes) {
    throw new MediaValidationError('MEDIA_SIZE_MISMATCH', 'Media payload size does not match sizeBytes');
  }
  return input;
}
