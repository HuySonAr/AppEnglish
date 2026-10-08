import path from 'node:path';
import { defaultMaxFileSizeBytes } from './media.constants.js';
import { ImageKitMediaStorageAdapter } from './imagekit-media-storage.adapter.js';
import { LocalMediaStorageAdapter } from './local-media-storage.adapter.js';

export function createMediaStorage(source = process.env) {
  const adapter = source.MEDIA_STORAGE_ADAPTER || 'local';
  const maxFileSizeBytes = Number(source.MEDIA_MAX_FILE_SIZE_BYTES || defaultMaxFileSizeBytes);
  if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
    throw new Error('MEDIA_MAX_FILE_SIZE_BYTES must be a positive integer');
  }
  if (adapter === 'local') {
    return new LocalMediaStorageAdapter({
      rootDirectory: path.resolve(source.MEDIA_LOCAL_ROOT || 'storage/media'),
      publicBaseUrl: source.MEDIA_LOCAL_PUBLIC_URL || 'http://localhost:3002/media',
      maxFileSizeBytes
    });
  }
  if (adapter === 'imagekit') {
    return new ImageKitMediaStorageAdapter({
      privateKey: source.IMAGEKIT_PRIVATE_KEY,
      publicKey: source.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: source.IMAGEKIT_URL_ENDPOINT,
      maxFileSizeBytes
    });
  }
  throw new Error(`Unsupported MEDIA_STORAGE_ADAPTER: ${adapter}`);
}
