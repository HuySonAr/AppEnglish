import { randomUUID } from 'node:crypto';
import ImageKit, { toFile } from '@imagekit/nodejs';
import { mediaObjectSchema } from './media.schemas.js';
import { validateMediaUpload } from './media.validator.js';

export class ImageKitMediaStorageAdapter {
  // localStorage removes files that were stored locally before ImageKit was enabled.
  constructor({ client, privateKey, publicKey, urlEndpoint, maxFileSizeBytes, localStorage } = {}) {
    if (!client && (!privateKey || !publicKey || !urlEndpoint)) {
      throw new Error('ImageKit credentials are required when ImageKit adapter is enabled');
    }
    this.client = client || new ImageKit({ privateKey, publicKey, urlEndpoint });
    this.maxFileSizeBytes = maxFileSizeBytes;
    this.localStorage = localStorage;
  }

  async upload(input) {
    validateMediaUpload(input, this.maxFileSizeBytes);
    const result = await this.client.files.upload({
      // A bare Buffer would be sent as one form field per byte and exhaust memory.
      file: await toFile(Buffer.from(input.data), input.fileName, { type: input.mimeType }),
      fileName: input.fileName,
      useUniqueFileName: true,
      // input.folder is the lesson folder; uploads without a lesson go by kind.
      folder: `/appenglish/${input.folder || input.kind}`
    });
    return mediaObjectSchema.parse({
      id: result.fileId || randomUUID(),
      kind: input.kind,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      url: result.url,
      storage: 'imagekit'
    });
  }

  // A file ImageKit no longer has counts as deleted.
  async delete(asset) {
    if (asset.storage !== 'imagekit') {
      if (!this.localStorage) throw new Error(`Cannot delete ${asset.storage} media: storage is not configured`);
      return this.localStorage.delete(asset);
    }
    try {
      await this.client.files.delete(asset.storageId);
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }
}
