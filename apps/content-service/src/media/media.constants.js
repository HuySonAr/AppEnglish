export const MediaKind = Object.freeze({
  AUDIO: 'audio',
  IMAGE: 'image',
  RECORDING: 'recording'
});

export const allowedMediaTypes = Object.freeze({
  [MediaKind.AUDIO]: Object.freeze({
    mimeTypes: Object.freeze(['audio/mpeg', 'audio/mp4', 'video/mp4', 'audio/x-m4a', 'audio/m4a']),
    extensions: Object.freeze(['.mp3', '.mp4', '.m4a'])
  }),
  [MediaKind.IMAGE]: Object.freeze({
    mimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
    extensions: Object.freeze(['.jpg', '.jpeg', '.png', '.webp'])
  }),
  [MediaKind.RECORDING]: Object.freeze({
    mimeTypes: Object.freeze(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav']),
    extensions: Object.freeze(['.webm', '.ogg', '.m4a', '.mp3', '.wav'])
  })
});

export const defaultMaxFileSizeBytes = 40 * 1024 * 1024;
