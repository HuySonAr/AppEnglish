export const MediaKind = Object.freeze({
  AUDIO: 'audio',
  IMAGE: 'image'
});

export const allowedMediaTypes = Object.freeze({
  [MediaKind.AUDIO]: Object.freeze({
    mimeTypes: Object.freeze(['audio/mpeg', 'audio/mp4', 'video/mp4', 'audio/x-m4a', 'audio/m4a']),
    extensions: Object.freeze(['.mp3', '.mp4', '.m4a'])
  }),
  [MediaKind.IMAGE]: Object.freeze({
    mimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
    extensions: Object.freeze(['.jpg', '.jpeg', '.png', '.webp'])
  })
});

export const defaultMaxFileSizeBytes = 40 * 1024 * 1024;
