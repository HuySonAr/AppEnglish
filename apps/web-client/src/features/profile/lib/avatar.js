import { PROFILE_LIMITS } from '@appenglish/auth-contracts';

// Pure rules of the avatar picker (D113). The browser part (canvas) is in
// prepareAvatar below and is only called from the page.

// The largest centred square of a picture: { x, y, size }.
export function squareCrop(width, height) {
  const size = Math.max(0, Math.min(width, height));
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}

// Whether a chosen file can become an avatar at all; the server checks again.
export function avatarFileIssue(file) {
  if (!file) return 'Choose a picture.';
  if (!PROFILE_LIMITS.avatarMimeTypes.includes(String(file.type).toLowerCase()))
    return 'Use a JPEG, PNG or WebP picture.';
  // The crop below shrinks the file; only absurd inputs are refused here.
  if (file.size > 25 * 1024 * 1024) return 'This picture is too large.';
  return null;
}

// The display name as it will be saved: trimmed, single spaces, at most the limit.
export function normalizeDisplayName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, PROFILE_LIMITS.displayNameMax);
}

// Crops the picture to a centred square and shrinks it to the avatar size,
// returning a WebP file ready to upload. Browser only.
export async function prepareAvatar(file, size = PROFILE_LIMITS.avatarSize) {
  const bitmap = await createImageBitmap(file);
  try {
    const crop = squareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('The picture could not be processed.'))), 'image/webp', 0.9);
    });
    return new File([blob], 'avatar.webp', { type: 'image/webp' });
  } finally {
    bitmap.close?.();
  }
}
