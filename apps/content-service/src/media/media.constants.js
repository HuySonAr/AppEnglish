export const MediaKind = Object.freeze({
  AUDIO: 'audio',
  IMAGE: 'image'
});

export const allowedMediaTypes = Object.freeze({
  [MediaKind.AUDIO]: Object.freeze({
    mimeTypes: Object.freeze(['audio/mpeg']),
    extensions: Object.freeze(['.mp3'])
  }),
  [MediaKind.IMAGE]: Object.freeze({
    mimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
    extensions: Object.freeze(['.jpg', '.jpeg', '.png', '.webp'])
  })
});

export const defaultMaxFileSizeBytes = 10 * 1024 * 1024;
