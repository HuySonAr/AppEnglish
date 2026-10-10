import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultMaxFileSizeBytes } from './media.constants.js';
import { ImageKitMediaStorageAdapter } from './imagekit-media-storage.adapter.js';
import { LocalMediaStorageAdapter } from './local-media-storage.adapter.js';

// Relative MEDIA_LOCAL_ROOT values are resolved from the repository root so the
// ignored storage/media directory is used whatever the working directory is.
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export function createMediaStorage(source = process.env) {
  const adapter = source.MEDIA_STORAGE_ADAPTER || 'local';
  const maxFileSizeBytes = Number(source.MEDIA_MAX_FILE_SIZE_BYTES || defaultMaxFileSizeBytes);
  if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
    throw new Error('MEDIA_MAX_FILE_SIZE_BYTES must be a positive integer');
  }
  const local = new LocalMediaStorageAdapter({
    rootDirectory: path.resolve(repositoryRoot, source.MEDIA_LOCAL_ROOT || 'storage/media'),
    publicBaseUrl: source.MEDIA_LOCAL_PUBLIC_URL || 'http://localhost:3002/media',
    maxFileSizeBytes
  });
  if (adapter === 'local') return local;
  if (adapter === 'imagekit') {
    return new ImageKitMediaStorageAdapter({
      privateKey: source.IMAGEKIT_PRIVATE_KEY,
      publicKey: source.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: source.IMAGEKIT_URL_ENDPOINT,
      maxFileSizeBytes,
      localStorage: local
    });
  }
  throw new Error(`Unsupported MEDIA_STORAGE_ADAPTER: ${adapter}`);
}
