import { In, IsNull, MoreThan } from 'typeorm';
import { WORKING_VERSION_STATUSES } from '@appenglish/content-contracts';
import {
  ContentEventEntity,
  ProcessedMessageEntity,
  ListeningExerciseEntity,
  ListeningExerciseVersionEntity,
  ListeningTimingJobEntity,
  ListeningTopicEntity,
  MockTestEntity,
} from '../database/content.entities.js';

export class ListeningRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async repo(entity) {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    return this.dataSource.getRepository(entity);
  }

  async listTopics() {
    return (await this.repo(ListeningTopicEntity)).find({ order: { createdAt: 'ASC' } });
  }

  async findTopic(id) {
    return (await this.repo(ListeningTopicEntity)).findOne({ where: { id } });
  }

  async saveTopic(topic) {
    return (await this.repo(ListeningTopicEntity)).save(topic);
  }

  async deleteTopic(id) {
    await (await this.repo(ListeningTopicEntity)).delete({ id });
  }

  async listExercises() {
    return (await this.repo(ListeningExerciseEntity)).find({ order: { createdAt: 'ASC' } });
  }

  async findExercise(id) {
    return (await this.repo(ListeningExerciseEntity)).findOne({ where: { id } });
  }

  async saveExercise(exercise) {
    return (await this.repo(ListeningExerciseEntity)).save(exercise);
  }

  async listVersionSummaries() {
    return (await this.repo(ListeningExerciseVersionEntity)).find({
      select: { id: true, exerciseId: true, versionNumber: true, status: true },
    });
  }

  async findDraft(exerciseId) {
    return (await this.repo(ListeningExerciseVersionEntity)).findOne({ where: { exerciseId, status: In(WORKING_VERSION_STATUSES) } });
  }

  async findVersion(id) {
    return (await this.repo(ListeningExerciseVersionEntity)).findOne({ where: { id } });
  }

  async maxVersionNumber(exerciseId) {
    return (await (await this.repo(ListeningExerciseVersionEntity)).maximum('versionNumber', { exerciseId })) || 0;
  }

  async saveVersion(version) {
    return (await this.repo(ListeningExerciseVersionEntity)).save(version);
  }

  async publishVersion(exercise, version) {
    await this.repo(ListeningExerciseEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ListeningExerciseVersionEntity).save(version);
      await manager.getRepository(ListeningExerciseEntity).save(exercise);
    });
  }

  async deleteExerciseWithVersions(exerciseId) {
    await this.repo(ListeningExerciseEntity);
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ListeningTimingJobEntity).delete({ exerciseId });
      await manager.getRepository(ListeningExerciseVersionEntity).delete({ exerciseId });
      await manager.getRepository(ListeningExerciseEntity).delete({ id: exerciseId });
    });
  }

  async saveTimingJobWithEvent(job, eventOf) {
    await this.repo(ListeningTimingJobEntity);
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(ListeningTimingJobEntity).save(job);
      await manager.getRepository(ContentEventEntity).save(eventOf(saved));
      return saved;
    });
  }

  async listPendingEvents(limit) {
    return (await this.repo(ContentEventEntity)).find({ where: { publishedAt: IsNull() }, order: { createdAt: 'ASC' }, take: limit });
  }

  async markEventPublished(id, at) {
    await (await this.repo(ContentEventEntity)).update({ id }, { publishedAt: at });
  }

  async isProcessed(messageId) {
    return Boolean(await (await this.repo(ProcessedMessageEntity)).findOne({ where: { messageId } }));
  }

  async markProcessed(messageId, queue, at) {
    await (await this.repo(ProcessedMessageEntity)).createQueryBuilder().insert().values({ messageId, queue, processedAt: at }).orIgnore().execute();
  }

  async saveTimingJob(job) {
    return (await this.repo(ListeningTimingJobEntity)).save(job);
  }

  async findTimingJob(id) {
    return (await this.repo(ListeningTimingJobEntity)).findOne({ where: { id } });
  }

  async listJobsUpdatedSince(since) {
    return (await this.repo(ListeningTimingJobEntity)).find({ where: { updatedAt: MoreThan(since) }, select: { id: true, status: true, task: true, error: true, lines: true, result: true, createdAt: true, updatedAt: true } });
  }

  async listJobsRequestedBy(requestedBy, since, limit) {
    return (await this.repo(ListeningTimingJobEntity)).find({ where: { requestedBy, updatedAt: MoreThan(since) }, order: { updatedAt: 'DESC' }, take: limit });
  }

  async markJobsSeen(requestedBy, ids, at) {
    const query = (await this.repo(ListeningTimingJobEntity)).createQueryBuilder().update().set({ seenAt: at }).where('"requestedBy" = :requestedBy AND "seenAt" IS NULL', { requestedBy });
    if (ids) query.andWhere('id IN (:...ids)', { ids: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] });
    await query.execute();
  }

  async titlesOf({ exerciseIds, mockTestIds }) {
    const find = async (entity, ids) => (ids.length ? (await this.repo(entity)).find({ where: { id: In(ids) }, select: { id: true, title: true } }) : []);
    const rows = [...(await find(ListeningExerciseEntity, exerciseIds)), ...(await find(MockTestEntity, mockTestIds))];
    return new Map(rows.map((row) => [row.id, row.title]));
  }

  async listTimingJobs(owner) {
    return (await this.repo(ListeningTimingJobEntity)).find({ where: owner, order: { createdAt: 'ASC' } });
  }

  async findLatestTimingJob(owner) {
    return (await this.repo(ListeningTimingJobEntity)).findOne({ where: owner, order: { createdAt: 'DESC' } });
  }
}
