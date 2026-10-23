import { In } from 'typeorm';
import { PracticePromptEntity, PracticePromptVersionEntity } from '../database/content.entities.js';

export class PracticeRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async listPrompts(where = {}) {
    return (await this.repo(PracticePromptEntity)).find({ where, order: { createdAt: 'DESC' } });
  }

  async findPrompt(id) {
    return (await this.repo(PracticePromptEntity)).findOne({ where: { id } });
  }

  async savePrompt(prompt) {
    return (await this.repo(PracticePromptEntity)).save(prompt);
  }

  async listVersions(promptIds) {
    if (!promptIds.length) return [];
    return (await this.repo(PracticePromptVersionEntity)).find({ where: { promptId: In(promptIds) }, order: { versionNumber: 'ASC' } });
  }

  async saveVersion(version) {
    return (await this.repo(PracticePromptVersionEntity)).save(version);
  }

  async createPromptWithVersion(prompt, versionOf) {
    await this.repo(PracticePromptEntity);
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(PracticePromptEntity).save(prompt);
      const version = await manager.getRepository(PracticePromptVersionEntity).save(versionOf(saved));
      return { prompt: saved, version };
    });
  }

  async publishVersion(prompt, version, previous) {
    await this.repo(PracticePromptEntity);
    return this.dataSource.transaction(async (manager) => {
      if (previous) await manager.getRepository(PracticePromptVersionEntity).save(previous);
      await manager.getRepository(PracticePromptVersionEntity).save(version);
      await manager.getRepository(PracticePromptEntity).save(prompt);
    });
  }

  async deletePrompt(id) {
    await (await this.repo(PracticePromptEntity)).delete({ id });
  }
}
