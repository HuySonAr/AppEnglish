import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultMaxFileSizeBytes } from './media.constants.js';
import { ImageKitMediaStorageAdapter } from './imagekit-media-storage.adapter.js';
import { LocalMediaStorageAdapter } from './local-media-storage.adapter.js';
import { R2MediaStorageAdapter } from './r2-media-storage.adapter.js';

// Relative MEDIA_LOCAL_ROOT values are resolved from the repository root so the
// ignored storage/media directory is used whatever the working directory is.
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

// MEDIA_STORAGE_ADAPTER chooses where new files go: local, imagekit or r2.
// Files stored earlier in another storage can still be deleted.
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
  const imageKitSettings = {
    privateKey: source.IMAGEKIT_PRIVATE_KEY,
    publicKey: source.IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: source.IMAGEKIT_URL_ENDPOINT,
    maxFileSizeBytes,
    localStorage: local
  };
  if (adapter === 'imagekit') return new ImageKitMediaStorageAdapter(imageKitSettings);
  if (adapter === 'r2') {
    // With the ImageKit keys still set, files left there can be deleted too.
    const hasImageKit = source.IMAGEKIT_PRIVATE_KEY && source.IMAGEKIT_PUBLIC_KEY && source.IMAGEKIT_URL_ENDPOINT;
    return new R2MediaStorageAdapter({
      accountId: source.R2_ACCOUNT_ID,
      accessKeyId: source.R2_ACCESS_KEY_ID,
      secretAccessKey: source.R2_SECRET_ACCESS_KEY,
      bucket: source.R2_BUCKET,
      publicBaseUrl: source.R2_PUBLIC_BASE_URL,
      maxFileSizeBytes,
      otherStorages: {
        local,
        ...(hasImageKit ? { imagekit: new ImageKitMediaStorageAdapter(imageKitSettings) } : {})
      }
    });
  }
  throw new Error(`Unsupported MEDIA_STORAGE_ADAPTER: ${adapter}`);
}
