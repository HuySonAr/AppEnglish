export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export class MediaStorage {
  async upload() {
    throw new Error('MediaStorage.upload must be implemented by an adapter');
  }
}
