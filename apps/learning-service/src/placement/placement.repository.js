import { PlacementAttemptEntity, PlacementSettingsEntity } from '../database/learning.entities.js';

export class PlacementRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async findAttempt(accountId) {
    return (await this.repo(PlacementAttemptEntity)).findOne({ where: { accountId } });
  }

  async saveAttempt(attempt) {
    return (await this.repo(PlacementAttemptEntity)).save(attempt);
  }

  // Creates the account's single attempt. Returns null when one already
  // exists, e.g. two start requests racing.
  async createAttempt(attempt) {
    try {
      return await (await this.repo(PlacementAttemptEntity)).save(attempt);
    } catch (error) {
      if (error?.code === '23505') return null; // unique violation
      throw error;
    }
  }

  async findSettings() {
    return (await this.repo(PlacementSettingsEntity)).findOne({ where: { id: 1 } });
  }

  async saveSettings(settings) {
    return (await this.repo(PlacementSettingsEntity)).save({ ...settings, id: 1 });
  }
}
