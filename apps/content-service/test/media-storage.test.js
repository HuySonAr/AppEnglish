import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MediaKind } from '../src/media/media.constants.js';
import { createMediaStorage } from '../src/media/media-storage.factory.js';
import { ImageKitMediaStorageAdapter } from '../src/media/imagekit-media-storage.adapter.js';
import { R2MediaStorageAdapter } from '../src/media/r2-media-storage.adapter.js';

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

test('r2 adapter stores under the folder, returns the public URL and deletes by key', async () => {
  const sent = [];
  const local = [];
  const adapter = new R2MediaStorageAdapter({
    client: { send: async (command) => sent.push([command.constructor.name, command.input]) },
    bucket: 'appenglish-media',
    publicBaseUrl: 'https://media.example.test/',
    otherStorages: { local: { delete: async (asset) => local.push(asset.storageId) } },
  });
  const stored = await adapter.upload(audio({ fileName: 'Part 1 (final).mp3', folder: 'audio/unit1-lesson2/test' }));
  assert.equal(stored.storage, 'r2');
  assert.match(stored.id, /^appenglish\/audio\/unit1-lesson2\/test\/[0-9a-f-]{36}-Part_1__final_.mp3$/);
  assert.equal(stored.url, `https://media.example.test/${stored.id}`);
  assert.deepEqual(sent[0][0], 'PutObjectCommand');
  assert.deepEqual({ ...sent[0][1], Body: sent[0][1].Body.length }, { Bucket: 'appenglish-media', Key: stored.id, Body: 3, ContentType: 'audio/mpeg' });
  assert.match((await adapter.upload(audio())).id, /^appenglish\/audio\/[0-9a-f-]{36}-question.mp3$/);
  await assert.rejects(() => adapter.upload(audio({ mimeType: 'audio/wav' })), { code: 'MEDIA_MIME_TYPE_NOT_ALLOWED' });

  await adapter.delete({ storage: 'r2', storageId: stored.id });
  assert.deepEqual(sent.at(-1), ['DeleteObjectCommand', { Bucket: 'appenglish-media', Key: stored.id }]);
  await adapter.delete({ storage: 'local', storageId: 'old-local' });
  assert.deepEqual(local, ['old-local']);
  await assert.rejects(() => adapter.delete({ storage: 'imagekit', storageId: 'ik-1' }), /not configured/);
});

test('r2 adapter is selected only with its settings', () => {
  const settings = { MEDIA_STORAGE_ADAPTER: 'r2', R2_ACCOUNT_ID: 'account', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET: 'bucket', R2_PUBLIC_BASE_URL: 'https://media.example.test' };
  const adapter = createMediaStorage(settings);
  assert.equal(adapter.constructor.name, 'R2MediaStorageAdapter');
  assert.deepEqual(Object.keys(adapter.otherStorages), ['local']);
  const both = createMediaStorage({ ...settings, IMAGEKIT_PRIVATE_KEY: 'private', IMAGEKIT_PUBLIC_KEY: 'public', IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/demo' });
  assert.deepEqual(Object.keys(both.otherStorages), ['local', 'imagekit']);
  for (const missing of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'])
    assert.throws(() => createMediaStorage({ ...settings, [missing]: '' }), /are required/, missing);
});

