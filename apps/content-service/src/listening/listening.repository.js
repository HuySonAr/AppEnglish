import {
  ListeningExerciseEntity,
  ListeningExerciseVersionEntity,
  ListeningTimingJobEntity,
  ListeningTopicEntity,
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

  async listExercises() {
    return (await this.repo(ListeningExerciseEntity)).find({ order: { createdAt: 'ASC' } });
  }

  async findExercise(id) {
    return (await this.repo(ListeningExerciseEntity)).findOne({ where: { id } });
  }

  async saveExercise(exercise) {
    return (await this.repo(ListeningExerciseEntity)).save(exercise);
  }

  // Version metadata without the content payload.
  async listVersionSummaries() {
    return (await this.repo(ListeningExerciseVersionEntity)).find({
      select: { id: true, exerciseId: true, versionNumber: true, status: true },
    });
  }

  async findDraft(exerciseId) {
    return (await this.repo(ListeningExerciseVersionEntity)).findOne({ where: { exerciseId, status: 'DRAFT' } });
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

  async saveTimingJob(job) {
    return (await this.repo(ListeningTimingJobEntity)).save(job);
  }

  async findTimingJob(id) {
    return (await this.repo(ListeningTimingJobEntity)).findOne({ where: { id } });
  }

  async findLatestTimingJob(exerciseId) {
    return (await this.repo(ListeningTimingJobEntity)).findOne({ where: { exerciseId }, order: { createdAt: 'DESC' } });
  }
}
