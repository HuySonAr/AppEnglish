import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MediaKind } from '../src/media/media.constants.js';
import { createMediaStorage } from '../src/media/media-storage.factory.js';
import { ImageKitMediaStorageAdapter } from '../src/media/imagekit-media-storage.adapter.js';

const audio = (overrides = {}) => ({
  kind: MediaKind.AUDIO,
  fileName: 'question.mp3',
  mimeType: 'audio/mpeg',
  data: new Uint8Array([1, 2, 3]),
  sizeBytes: 3,
  ...overrides
});

test('local adapter stores media outside build output and returns a local URL', async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'appenglish-media-'));
  try {
    const adapter = createMediaStorage({ MEDIA_STORAGE_ADAPTER: 'local', MEDIA_LOCAL_ROOT: rootDirectory });
    const result = await adapter.upload(audio());
    assert.equal(result.storage, 'local');
    assert.match(result.url, /^http:\/\/localhost:3002\/media\//);
    const storedPath = path.join(rootDirectory, decodeURIComponent(new URL(result.url).pathname.split('/').at(-1)));
    assert.deepEqual(await readFile(storedPath), Buffer.from([1, 2, 3]));
    const kept = await adapter.upload(audio());
    await adapter.delete({ storage: 'local', storageId: result.id });
    await adapter.delete({ storage: 'local', storageId: result.id });
    assert.deepEqual(await readdir(rootDirectory), [`${kept.id}-question.mp3`]);
    await assert.rejects(() => adapter.delete({ storage: 'imagekit', storageId: 'ik-file-1' }), /not configured/);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('validation rejects unsupported MIME, extension and oversized payloads', async () => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'appenglish-media-'));
  try {
    const adapter = createMediaStorage({ MEDIA_STORAGE_ADAPTER: 'local', MEDIA_LOCAL_ROOT: rootDirectory, MEDIA_MAX_FILE_SIZE_BYTES: '2' });
    await assert.rejects(() => adapter.upload(audio()), { code: 'MEDIA_FILE_TOO_LARGE' });
    await assert.rejects(() => adapter.upload(audio({ fileName: 'question.wav', sizeBytes: 3 })), { code: 'MEDIA_EXTENSION_NOT_ALLOWED' });
    await assert.rejects(() => adapter.upload(audio({ mimeType: 'audio/wav', sizeBytes: 3 })), { code: 'MEDIA_MIME_TYPE_NOT_ALLOWED' });
    const roomy = createMediaStorage({ MEDIA_STORAGE_ADAPTER: 'local', MEDIA_LOCAL_ROOT: rootDirectory });
    for (const mimeType of ['video/mp4', 'audio/mp4'])
      assert.equal((await roomy.upload(audio({ fileName: 'part1.mp4', mimeType }))).storage, 'local');
    for (const mimeType of ['audio/x-m4a', 'audio/mp4'])
      assert.equal((await roomy.upload(audio({ fileName: 'part2.m4a', mimeType }))).storage, 'local');
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('imagekit adapter uses official SDK upload without requiring a real credential in tests', async () => {
  const calls = [];
  const adapter = new ImageKitMediaStorageAdapter({
    client: { files: { upload: async (payload) => { calls.push(payload); return { fileId: 'ik-file-1', url: 'https://ik.imagekit.io/demo/question.mp3' }; } } }
  });
  const result = await adapter.upload(audio());
  assert.equal(result.storage, 'imagekit');
  assert.equal(result.url, 'https://ik.imagekit.io/demo/question.mp3');
  assert.equal(calls[0].fileName, 'question.mp3');
  assert.equal(calls[0].file instanceof File, true);
  assert.deepEqual([calls[0].file.name, calls[0].file.type, calls[0].file.size], ['question.mp3', 'audio/mpeg', 3]);
  assert.equal(calls[0].useUniqueFileName, true);
  assert.equal(calls[0].folder, '/appenglish/audio');
  await adapter.upload(audio({ folder: 'audio/unit1-lesson2/vocabulary' }));
  assert.equal(calls[1].folder, '/appenglish/audio/unit1-lesson2/vocabulary');
});

test('imagekit adapter deletes by file id, tolerates a missing file and removes older local files', async () => {
  const deleted = [];
  const local = [];
  const adapter = new ImageKitMediaStorageAdapter({
    client: { files: { delete: async (fileId) => {
      deleted.push(fileId);
      if (fileId === 'gone') throw Object.assign(new Error('not found'), { status: 404 });
      if (fileId === 'denied') throw Object.assign(new Error('forbidden'), { status: 403 });
    } } },
    localStorage: { delete: async (asset) => local.push(asset.storageId) }
  });
  await adapter.delete({ storage: 'imagekit', storageId: 'ik-file-1' });
  await adapter.delete({ storage: 'imagekit', storageId: 'gone' });
  await assert.rejects(() => adapter.delete({ storage: 'imagekit', storageId: 'denied' }), /forbidden/);
  await adapter.delete({ storage: 'local', storageId: 'old-local' });
  assert.deepEqual(deleted, ['ik-file-1', 'gone', 'denied']);
  assert.deepEqual(local, ['old-local']);
});

test('imagekit adapter is not selected without explicit credentials', () => {
  const adapter = createMediaStorage({ MEDIA_STORAGE_ADAPTER: 'local' });
  assert.equal(adapter.constructor.name, 'LocalMediaStorageAdapter');
  assert.throws(() => createMediaStorage({ MEDIA_STORAGE_ADAPTER: 'imagekit' }), /credentials are required/);
});
