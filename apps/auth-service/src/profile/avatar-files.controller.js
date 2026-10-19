import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { AVATAR_STORAGE } from './avatar-storage.js';

// Serves locally stored avatars (AVATAR_STORAGE_ADAPTER=local) for development.
// With ImageKit the URLs point at ImageKit and this route is never used.
export class AvatarFilesController {
  constructor(storage) {
    this.storage = storage;
  }

  async file(name, response) {
    const root = this.storage.rootDirectory;
    if (!root || !/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(name)) throw new NotFoundException();
    const file = path.join(root, name);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException();
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.sendFile(file);
  }
}

Controller('avatars')(AvatarFilesController);
Inject(AVATAR_STORAGE)(AvatarFilesController, undefined, 0);
Get(':name')(AvatarFilesController.prototype, 'file', Object.getOwnPropertyDescriptor(AvatarFilesController.prototype, 'file'));
Param('name')(AvatarFilesController.prototype, 'file', 0);
Res()(AvatarFilesController.prototype, 'file', 1);
