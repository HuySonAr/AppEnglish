import { PROFILE_LIMITS } from '@appenglish/auth-contracts';

export function squareCrop(width, height) {
  const size = Math.max(0, Math.min(width, height));
  return { x: Math.floor((width - size) / 2), y: Math.floor((height - size) / 2), size };
}

export function avatarFileIssue(file) {
  if (!file) return 'Choose a picture.';
  if (!PROFILE_LIMITS.avatarMimeTypes.includes(String(file.type).toLowerCase()))
    return 'Use a JPEG, PNG or WebP picture.';
  if (file.size > 25 * 1024 * 1024) return 'This picture is too large.';
  return null;
}

export function normalizeDisplayName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, PROFILE_LIMITS.displayNameMax);
}

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
