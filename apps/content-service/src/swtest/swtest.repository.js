import { In, MoreThan } from 'typeorm';
import { ContentReviewKind, WORKING_VERSION_STATUSES } from '@appenglish/content-contracts';
import { SwTestEntity, SwTestVersionEntity } from '../database/content.entities.js';

export class SwTestRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async listTests() {
    return (await this.repo(SwTestEntity)).find({ order: { createdAt: 'DESC' } });
  }

  async findTest(id) {
    return (await this.repo(SwTestEntity)).findOne({ where: { id } });
  }

  async saveTest(test) {
    return (await this.repo(SwTestEntity)).save(test);
  }

  async listVersionSummaries() {
    return (await this.repo(SwTestVersionEntity)).find({ select: { id: true, swTestId: true, versionNumber: true, status: true } });
  }

  async findDraft(swTestId) {
    return (await this.repo(SwTestVersionEntity)).findOne({ where: { swTestId, status: In(WORKING_VERSION_STATUSES) } });
  }

  async listWorkingVersions() {
    const rows = await (await this.repo(SwTestVersionEntity)).find({ where: { status: In(WORKING_VERSION_STATUSES) } });
    return rows.map(({ content, ...row }) => ({ ...row, kind: ContentReviewKind.SW_TEST, ownerId: row.swTestId }));
  }

  async listReviewActivity(since) {
    const rows = await (await this.repo(SwTestVersionEntity)).find({ where: [{ status: 'PENDING_REVIEW' }, { reviewedAt: MoreThan(since) }] });
    return rows.map(({ content, ...row }) => ({ ...row, kind: ContentReviewKind.SW_TEST, ownerId: row.swTestId }));
  }

  async findVersion(id) {
    return (await this.repo(SwTestVersionEntity)).findOne({ where: { id } });
  }

  async maxVersionNumber(swTestId) {
    return (await (await this.repo(SwTestVersionEntity)).maximum('versionNumber', { swTestId })) || 0;
  }

  async saveVersion(version) {
    return (await this.repo(SwTestVersionEntity)).save(version);
  }

  async publishVersion(test, version) {
    await this.repo(SwTestEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(SwTestVersionEntity).save(version);
      await manager.getRepository(SwTestEntity).save(test);
    });
  }

  async deleteTestWithVersions(id) {
    await this.repo(SwTestEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(SwTestVersionEntity).delete({ swTestId: id });
      await manager.getRepository(SwTestEntity).delete({ id });
    });
  }
}
