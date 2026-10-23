import dataSource from '../database/data-source.js';
import { createMediaStorage } from './media-storage.factory.js';

const storage = createMediaStorage();
if (storage.constructor.name !== 'R2MediaStorageAdapter')
  throw new Error('Set MEDIA_STORAGE_ADAPTER=r2 and the R2_* variables first');

await dataSource.initialize();
let moved = 0;
let failed = 0;
try {
  const assets = await dataSource.query(
    `SELECT * FROM "media_assets" WHERE "storage" = 'imagekit' ORDER BY "createdAt"`,
  );
  console.log(`${assets.length} file(s) on ImageKit`);
  for (const asset of assets) {
    try {
      const response = await fetch(`${asset.url}?tr=orig-true`);
      const data = Buffer.from(await response.arrayBuffer());
      if (!response.ok || data.byteLength !== asset.sizeBytes)
        throw new Error(`download gave status ${response.status} and ${data.byteLength} of ${asset.sizeBytes} bytes`);
      const folder = decodeURIComponent(new URL(asset.url).pathname).match(/\/appenglish\/(.+)\/[^/]+$/)?.[1];
      const stored = await storage.upload({
        folder,
        kind: asset.kind,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: data.byteLength,
        data,
      });
      await dataSource.query(
        `UPDATE "media_assets" SET "storage" = $1, "storageId" = $2, "url" = $3 WHERE "id" = $4`,
        [stored.storage, stored.id, stored.url, asset.id],
      );
      moved++;
      console.log(`moved  ${asset.fileName} -> ${stored.id}`);
      await storage.delete(asset).catch((error) => console.log(`       ImageKit copy not deleted: ${error.message}`));
    } catch (error) {
      failed++;
      console.log(`FAILED ${asset.fileName}: ${error.message}`);
    }
  }
} finally {
  await dataSource.destroy();
}
console.log(`${moved} moved, ${failed} failed`);
process.exit(failed ? 1 : 0);
