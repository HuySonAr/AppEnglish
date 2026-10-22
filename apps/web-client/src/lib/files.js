// Helpers for files chosen in the browser (D125): size text and the checks a
// drop zone makes before a file is taken.

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// The extensions (".mp3") and MIME types ("audio/mpeg") of an accept string.
function acceptParts(accept) {
  const parts = (accept || '').split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
  return { extensions: parts.filter((part) => part.startsWith('.')), types: parts.filter((part) => !part.startsWith('.')) };
}

// Why a file cannot be taken, or null: not a type the accept string names
// (by extension, else by MIME type), or larger than maxBytes.
export function fileIssue(file, { accept, maxBytes } = {}) {
  if (!file) return 'No file was chosen.';
  const { extensions, types } = acceptParts(accept);
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  if (extensions.length || types.length) {
    const byExtension = extensions.some((extension) => name.endsWith(extension));
    const byType = types.some((wanted) => (wanted.endsWith('/*') ? type.startsWith(wanted.slice(0, -1)) : type === wanted));
    if (!byExtension && !byType) return `This file type is not allowed (${extensions.join(', ') || types.join(', ')}).`;
  }
  if (maxBytes && file.size > maxBytes) return `This file is ${formatBytes(file.size)}; the limit is ${formatBytes(maxBytes)}.`;
  return null;
}

// A rough kind for an icon, from the name and type.
export function fileKind(name = '', type = '') {
  const lower = `${name} ${type}`.toLowerCase();
  if (/\.(mp3|m4a|wav|ogg)\b|audio\//.test(lower)) return 'audio';
  if (/\.(mp4|webm|mov)\b|video\//.test(lower)) return 'video';
  if (/\.(jpe?g|png|webp|gif)\b|image\//.test(lower)) return 'image';
  if (/\.json\b|application\/json/.test(lower)) return 'json';
  return 'text';
}
