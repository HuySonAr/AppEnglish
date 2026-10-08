import { randomUUID } from 'node:crypto';
import ImageKit from '@imagekit/nodejs';
import { mediaObjectSchema } from './media.schemas.js';
import { validateMediaUpload } from './media.validator.js';

export class ImageKitMediaStorageAdapter {
  constructor({ client, privateKey, publicKey, urlEndpoint, maxFileSizeBytes } = {}) {
    if (!client && (!privateKey || !publicKey || !urlEndpoint)) {
      throw new Error('ImageKit credentials are required when ImageKit adapter is enabled');
    }
    this.client = client || new ImageKit({ privateKey, publicKey, urlEndpoint });
    this.maxFileSizeBytes = maxFileSizeBytes;
  }

  async upload(input) {
    validateMediaUpload(input, this.maxFileSizeBytes);
    const result = await this.client.files.upload({
      file: Buffer.from(input.data),
      fileName: input.fileName,
      useUniqueFileName: true,
      folder: `/appenglish/${input.kind}`
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
}
