import { AiKeyEntity } from '../database/learning.entities.js';

export class AiKeyRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(AiKeyEntity);
  }

  async findKey(accountId) {
    return (await this.repo()).findOne({ where: { accountId } });
  }

  async saveKey(row) {
    return (await this.repo()).save(row);
  }

  async deleteKey(accountId) {
    const repository = await this.repo();
    await repository.manager.transaction(async (manager) => {
      await manager.delete(AiKeyEntity, { accountId });
      await manager.query(
        `UPDATE "learning_events" SET "payload" = "payload" - 'key' WHERE "type" IN ('writing.requested', 'speaking.grading.requested') AND "payload"->>'accountId' = $1 AND "payload" ? 'key'`,
        [accountId],
      );
    });
  }
}
