import { In, MoreThan } from 'typeorm';
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

  async listReviewActivity(since) {
    const versions = await (await this.repo(PracticePromptVersionEntity)).find({ where: [{ status: 'PENDING_REVIEW' }, { reviewedAt: MoreThan(since) }] });
    const ids = [...new Set(versions.map((version) => version.promptId))];
    const prompts = ids.length ? await (await this.repo(PracticePromptEntity)).find({ where: { id: In(ids) } }) : [];
    return { versions, prompts };
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
