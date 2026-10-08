import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mediaObjectSchema } from './media.schemas.js';
import { validateMediaUpload } from './media.validator.js';

export class LocalMediaStorageAdapter {
  constructor({ rootDirectory, publicBaseUrl = 'http://localhost:3002/media', maxFileSizeBytes } = {}) {
    this.rootDirectory = rootDirectory || path.resolve(process.cwd(), 'storage', 'media');
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
    this.maxFileSizeBytes = maxFileSizeBytes;
  }

  async upload(input) {
    validateMediaUpload(input, this.maxFileSizeBytes);
    const id = randomUUID();
    const safeFileName = path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFileName = `${id}-${safeFileName}`;
    await mkdir(this.rootDirectory, { recursive: true });
    await writeFile(path.join(this.rootDirectory, storedFileName), input.data, { flag: 'wx' });
    return mediaObjectSchema.parse({
      id,
      kind: input.kind,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      url: `${this.publicBaseUrl}/${encodeURIComponent(storedFileName)}`,
      storage: 'local'
    });
  }
}
