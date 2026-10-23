import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILE_LIMITS } from '@appenglish/auth-contracts';
import { authErrors } from '../auth/auth.errors.js';

export const AVATAR_STORAGE = Symbol('AVATAR_STORAGE');

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export function validateAvatar(input, maxBytes = PROFILE_LIMITS.avatarMaxBytes) {
  if (!PROFILE_LIMITS.avatarMimeTypes.includes(String(input.mimeType).toLowerCase()))
    throw authErrors.avatarInvalid('AVATAR_MIME_TYPE_NOT_ALLOWED');
  if (!PROFILE_LIMITS.avatarExtensions.includes(path.extname(input.fileName).toLowerCase()))
    throw authErrors.avatarInvalid('AVATAR_EXTENSION_NOT_ALLOWED');
  const size = input.data?.byteLength ?? 0;
  if (!size) throw authErrors.avatarInvalid('AVATAR_EMPTY');
  if (size > maxBytes) throw authErrors.avatarInvalid('AVATAR_FILE_TOO_LARGE');
  return input;
}

export class LocalAvatarStorage {
  constructor({ rootDirectory, publicBaseUrl = 'http://localhost:3001/avatars', maxBytes } = {}) {
    this.rootDirectory = rootDirectory || path.resolve(repositoryRoot, 'storage/avatars');
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
    this.maxBytes = maxBytes;
  }

  async upload(input) {
    validateAvatar(input, this.maxBytes);
    const id = randomUUID();
    const name = `${id}${path.extname(input.fileName).toLowerCase()}`;
    await mkdir(this.rootDirectory, { recursive: true });
    await writeFile(path.join(this.rootDirectory, name), input.data, { flag: 'wx' });
    return { storage: 'local', storageId: id, url: `${this.publicBaseUrl}/${name}` };
  }

  async delete({ storage, storageId }) {
    if (storage !== 'local') throw new Error(`Cannot delete ${storage} avatar: storage is not configured`);
    const names = await readdir(this.rootDirectory).catch(() => []);
    for (const name of names.filter((item) => item.startsWith(`${storageId}.`)))
      await rm(path.join(this.rootDirectory, name), { force: true });
  }
}

export class ImageKitAvatarStorage {
  constructor({ client, privateKey, publicKey, urlEndpoint, maxBytes, localStorage } = {}) {
    if (!client && (!privateKey || !publicKey || !urlEndpoint))
      throw new Error('ImageKit credentials are required when the avatar storage is imagekit');
    this.client = client;
    this.settings = { privateKey, publicKey, urlEndpoint };
    this.maxBytes = maxBytes;
    this.localStorage = localStorage;
  }

  async sdk() {
    const module = await import('@imagekit/nodejs');
    this.client ||= new module.default(this.settings);
    return module;
  }

  async upload(input) {
    validateAvatar(input, this.maxBytes);
    const { toFile } = await this.sdk();
    const result = await this.client.files.upload({
      file: await toFile(Buffer.from(input.data), input.fileName, { type: input.mimeType }),
      fileName: input.fileName,
      useUniqueFileName: true,
      folder: '/appenglish/avatar',
    });
    return { storage: 'imagekit', storageId: result.fileId || randomUUID(), url: result.url };
  }

  async delete(asset) {
    if (asset.storage !== 'imagekit') {
      if (!this.localStorage) throw new Error(`Cannot delete ${asset.storage} avatar: storage is not configured`);
      return this.localStorage.delete(asset);
    }
    await this.sdk();
    try {
      await this.client.files.delete(asset.storageId);
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }
}

export function createAvatarStorage(source = process.env) {
  const adapter = source.AVATAR_STORAGE_ADAPTER || 'local';
  const maxBytes = Number(source.AVATAR_MAX_FILE_SIZE_BYTES || PROFILE_LIMITS.avatarMaxBytes);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
    throw new Error('AVATAR_MAX_FILE_SIZE_BYTES must be a positive integer');
  const local = new LocalAvatarStorage({
    rootDirectory: path.resolve(repositoryRoot, source.AVATAR_LOCAL_ROOT || 'storage/avatars'),
    publicBaseUrl: source.AVATAR_LOCAL_PUBLIC_URL || `http://localhost:${source.AUTH_SERVICE_PORT || 3001}/avatars`,
    maxBytes,
  });
  if (adapter === 'local') return local;
  if (adapter === 'imagekit')
    return new ImageKitAvatarStorage({
      privateKey: source.IMAGEKIT_PRIVATE_KEY,
      publicKey: source.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: source.IMAGEKIT_URL_ENDPOINT,
      maxBytes,
      localStorage: local,
    });
  throw new Error(`Unsupported AVATAR_STORAGE_ADAPTER: ${adapter}`);
}
