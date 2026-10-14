import { randomUUID } from 'node:crypto';
import { AccountRole } from '@appenglish/auth-contracts';
import { LISTENING_KINDS, LessonVersionStatus, listeningKind, lyricBlankCount } from '@appenglish/content-contracts';
import { contentErrors } from '../content/content.errors.js';
import { listeningContentSchema, listeningIssues, listeningMediaIds } from './listening.schemas.js';

const iso = (date) => (date ? new Date(date).toISOString() : null);

// Sentences keep the id the editor sent; new ones get one here.
const withIds = (content) => ({
  ...content,
  segments: content.segments.map((segment) => ({ ...segment, id: segment.id || randomUUID() })),
});

// Listening practice content (F05B-2, D85): topics, and exercises written and
// published by a Content Manager like mock tests. Files go through the
// content module (upload, clean-up).
export class ListeningService {
  constructor(repository, contentService) {
    this.repository = repository;
    this.contentService = contentService;
  }

  assertManager(actor) {
    this.contentService.assertManager(actor);
  }

  // Topics are kept by an Admin or a Content Manager.
  assertTopicEditor(actor) {
    if (![AccountRole.ADMIN, AccountRole.CONTENT_MANAGER].includes(actor.role)) throw contentErrors.forbiddenRole();
  }

  // ----- Topics

  topicView(topic) {
    return {
      id: topic.id,
      code: topic.code,
      name: topic.name,
      format: topic.format,
      // Exercises can be written only for a topic with a format (D88).
      hasEditor: Boolean(LISTENING_KINDS[topic.format]),
    };
  }

  // Every role may read the list: it names and filters exercises.
  async listTopics() {
    return { topics: (await this.repository.listTopics()).map((topic) => this.topicView(topic)) };
  }

  async assertTopicNameFree(name, exceptId) {
    const code = this.contentService.examTypeCode(name);
    const clash = (await this.repository.listTopics()).some(
      (topic) => topic.id !== exceptId && (topic.code === code || topic.name.toLowerCase() === name.toLowerCase()),
    );
    if (!code || clash) throw contentErrors.listeningTopicInvalid('NAME_TAKEN', 'A topic with this name already exists');
    return code;
  }

  // format says how its exercises are written (TOEIC parts or songs); a topic
  // without one cannot have exercises yet.
  async createTopic(actor, { name, format = null }) {
    this.assertTopicEditor(actor);
    const code = await this.assertTopicNameFree(name);
    return { topic: this.topicView(await this.repository.saveTopic({ code, name, format, createdBy: actor.id })) };
  }

  // Renames a topic or changes its format; the code stays. The format is
  // fixed once the topic has exercises, which are written for it.
  async updateTopic(actor, topicId, { name, format }) {
    this.assertTopicEditor(actor);
    const topic = await this.repository.findTopic(topicId);
    if (!topic) throw contentErrors.listeningTopicNotFound();
    if (name !== undefined) {
      await this.assertTopicNameFree(name, topicId);
      topic.name = name;
    }
    if (format !== undefined && format !== topic.format) {
      if ((await this.repository.listExercises()).some((exercise) => exercise.topicId === topicId))
        throw contentErrors.listeningTopicInvalid('HAS_EXERCISES', 'The format of a topic with exercises cannot change');
      topic.format = format;
    }
    return { topic: this.topicView(await this.repository.saveTopic(topic)) };
  }

  // ----- Exercises

  async exerciseView(exercise, topics) {
    const topic = topics
      ? topics.find((item) => item.id === exercise.topicId)
      : await this.repository.findTopic(exercise.topicId);
    return {
      id: exercise.id,
      title: exercise.title,
      level: exercise.level,
      kind: exercise.kind,
      topic: topic ? { id: topic.id, code: topic.code, name: topic.name } : null,
    };
  }

  async listExercises(actor) {
    this.assertManager(actor);
    const [exercises, topics, versions] = await Promise.all([
      this.repository.listExercises(),
      this.repository.listTopics(),
      this.repository.listVersionSummaries(),
    ]);
    return {
      exercises: await Promise.all(
        exercises.map(async (exercise) => {
          const own = versions.filter((version) => version.exerciseId === exercise.id);
          return {
            ...(await this.exerciseView(exercise, topics)),
            createdAt: iso(exercise.createdAt),
            publishedVersionNumber: own.find((version) => version.id === exercise.publishedVersionId)?.versionNumber ?? null,
            hasDraft: own.some((version) => version.status === LessonVersionStatus.DRAFT),
          };
        }),
      ),
    };
  }

  async createExercise(actor, input) {
    this.assertManager(actor);
    const topic = await this.repository.findTopic(input.topicId);
    if (!topic) throw contentErrors.listeningTopicNotFound();
    const kinds = LISTENING_KINDS[topic.format];
    if (!kinds) throw contentErrors.listeningTopicInvalid('NO_EDITOR', 'Exercises cannot be written for this topic yet');
    if (!kinds.some((kind) => kind.key === input.kind))
      throw contentErrors.listeningTopicInvalid('KIND_MISMATCH', 'This kind of exercise does not belong to the topic');
    const exercise = await this.repository.saveExercise({ ...input, publishedVersionId: null, createdBy: actor.id });
    const draft = await this.repository.saveVersion({
      exerciseId: exercise.id,
      versionNumber: 1,
      status: LessonVersionStatus.DRAFT,
      content: listeningContentSchema.parse({}),
      createdBy: actor.id,
    });
    return this.managedView(exercise, draft, null);
  }

  async findExerciseOrThrow(exerciseId) {
    const exercise = await this.repository.findExercise(exerciseId);
    if (!exercise) throw contentErrors.listeningExerciseNotFound();
    return exercise;
  }

  // Title and level apply at once, also to the published exercise. The topic
  // and the kind stay: the sentences are written for them.
  async updateExercise(actor, exerciseId, changes) {
    this.assertManager(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    for (const [field, value] of Object.entries(changes)) if (value !== undefined) exercise[field] = value;
    await this.repository.saveExercise(exercise);
    return { exercise: await this.exerciseView(exercise) };
  }

  async publishedVersion(exercise) {
    return exercise.publishedVersionId ? this.repository.findVersion(exercise.publishedVersionId) : null;
  }

  async getExercise(actor, exerciseId) {
    this.assertManager(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    return this.managedView(exercise, await this.repository.findDraft(exerciseId), await this.publishedVersion(exercise));
  }

  async saveDraft(actor, exerciseId, content) {
    this.assertManager(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    let draft = await this.repository.findDraft(exerciseId);
    const previous = draft ? listeningContentSchema.safeParse(draft.content) : null;
    const previousMediaIds = previous?.success ? listeningMediaIds(previous.data) : [];
    if (draft) draft.content = withIds(content);
    else
      draft = {
        exerciseId,
        versionNumber: (await this.repository.maxVersionNumber(exerciseId)) + 1,
        status: LessonVersionStatus.DRAFT,
        content: withIds(content),
        createdBy: actor.id,
      };
    draft = await this.repository.saveVersion(draft);
    // A recording this save dropped is removed from storage.
    const kept = new Set(listeningMediaIds(draft.content));
    await this.contentService.removeUnusedMedia(previousMediaIds.filter((id) => !kept.has(id)));
    return this.managedView(exercise, draft, await this.publishedVersion(exercise));
  }

  // Publishing freezes the draft as the next immutable version.
  async publish(actor, exerciseId) {
    this.assertManager(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    const draft = await this.repository.findDraft(exerciseId);
    if (!draft) throw contentErrors.noDraft();
    draft.content = listeningContentSchema.parse(draft.content);
    const mediaIds = listeningMediaIds(draft.content);
    const media = mediaIds.length ? await this.contentService.repository.findMediaByIds(mediaIds) : [];
    const issues = listeningIssues(draft.content, listeningKind(exercise.kind), new Map(media.map((asset) => [asset.id, asset])));
    if (issues.length) throw contentErrors.notPublishable(issues);
    draft.status = LessonVersionStatus.PUBLISHED;
    draft.publishedAt = new Date();
    draft.publishedBy = actor.id;
    exercise.publishedVersionId = draft.id;
    await this.repository.publishVersion(exercise, draft);
    return this.managedView(exercise, null, draft);
  }

  // ----- Reads for learning-service (F05B-3). No actor: not exposed by the gateway.

  // Every topic, and the published exercises with their number of sentences.
  async listPublished() {
    const [exercises, topics] = await Promise.all([this.repository.listExercises(), this.repository.listTopics()]);
    const published = exercises.filter((exercise) => exercise.publishedVersionId);
    return {
      topics: topics.map((topic) => this.topicView(topic)),
      exercises: await Promise.all(
        published.map(async (exercise) => {
          const version = await this.repository.findVersion(exercise.publishedVersionId);
          const { segments } = listeningContentSchema.parse(version.content);
          return {
            ...(await this.exerciseView(exercise, topics)),
            segmentCount: segments.length,
            // Words to fill in, for songs (D88).
            blankCount: exercise.kind === 'song' ? segments.reduce((sum, segment) => sum + lyricBlankCount(segment.text), 0) : 0,
          };
        }),
      ),
    };
  }

  // An exercise's published version (the current one, or the given earlier
  // one) with its transcript and the URL of its recording.
  async getPaper(exerciseId, { versionId } = {}) {
    const exercise = await this.repository.findExercise(exerciseId);
    if (!exercise?.publishedVersionId) throw contentErrors.listeningExerciseNotFound();
    const version = await this.repository.findVersion(versionId || exercise.publishedVersionId);
    if (version?.exerciseId !== exercise.id || version.status !== LessonVersionStatus.PUBLISHED)
      throw contentErrors.listeningExerciseNotFound();
    return {
      exercise: await this.exerciseView(exercise),
      versionId: version.id,
      versionNumber: version.versionNumber,
      content: listeningContentSchema.parse(version.content),
      media: await this.mediaOf([version]),
    };
  }

  // The recordings the given versions use, by media id, so the editor can
  // play them. Locally stored files have no delivery URL.
  async mediaOf(versions) {
    const mediaIds = versions.flatMap((version) => {
      const parsed = version ? listeningContentSchema.safeParse(version.content) : null;
      return parsed?.success ? listeningMediaIds(parsed.data) : [];
    });
    const assets = mediaIds.length ? await this.contentService.repository.findMediaByIds([...new Set(mediaIds)]) : [];
    return Object.fromEntries(
      assets.map((asset) => [asset.id, { kind: asset.kind, fileName: asset.fileName, url: asset.storage === 'local' ? null : asset.url }]),
    );
  }

  async managedView(exercise, draft, published) {
    return {
      exercise: await this.exerciseView(exercise),
      media: await this.mediaOf([draft, published]),
      draft: draft ? { versionNumber: draft.versionNumber, content: draft.content } : null,
      published: published
        ? {
            versionId: published.id,
            versionNumber: published.versionNumber,
            publishedAt: iso(published.publishedAt),
            content: published.content,
          }
        : null,
    };
  }
}
