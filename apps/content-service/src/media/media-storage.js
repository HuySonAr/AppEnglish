export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export class MediaStorage {
  async upload() {
    throw new Error('MediaStorage.upload must be implemented by an adapter');
  }

  // Removes a stored file given its media asset ({ storage, storageId }).
  async delete() {
    throw new Error('MediaStorage.delete must be implemented by an adapter');
  }
}
