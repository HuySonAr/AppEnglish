import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mediaObjectSchema } from './media.schemas.js';
import { validateMediaUpload } from './media.validator.js';

// Stores media in a Cloudflare R2 bucket through its S3-compatible API. Files
// are served from the bucket's public URL as they were uploaded, without any
// processing.
export class R2MediaStorageAdapter {
  // otherStorages: { local, imagekit } adapters that can delete files stored
  // before R2 was enabled.
  constructor({ client, accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl, maxFileSizeBytes, otherStorages = {} } = {}) {
    if (!bucket || !publicBaseUrl || (!client && (!accountId || !accessKeyId || !secretAccessKey)))
      throw new Error('R2 credentials, bucket and public URL are required when the R2 adapter is enabled');
    this.client =
      client ||
      new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    this.bucket = bucket;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
    this.maxFileSizeBytes = maxFileSizeBytes;
    this.otherStorages = otherStorages;
  }

  async upload(input) {
    validateMediaUpload(input, this.maxFileSizeBytes);
    const safeFileName = path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    // input.folder is the lesson, placement or mock folder; else by kind.
    const key = `appenglish/${input.folder || input.kind}/${randomUUID()}-${safeFileName}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: Buffer.from(input.data),
        ContentType: input.mimeType,
      }),
    );
    return mediaObjectSchema.parse({
      id: key,
      kind: input.kind,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      url: `${this.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`,
      storage: 'r2',
    });
  }

  // Deleting an object that is already gone succeeds in S3/R2.
  async delete(asset) {
    if (asset.storage !== 'r2') {
      const other = this.otherStorages[asset.storage];
      if (!other) throw new Error(`Cannot delete ${asset.storage} media: storage is not configured`);
      return other.delete(asset);
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: asset.storageId }));
  }
}
