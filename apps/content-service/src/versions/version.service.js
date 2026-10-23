import { AccountRole } from '@appenglish/auth-contracts';
import { ContentVersionKind, LessonVersionStatus } from '@appenglish/content-contracts';
import {
  LessonVersionEntity,
  ListeningCourseVersionEntity,
  ListeningExerciseVersionEntity,
  MockTestVersionEntity,
  UnitReviewVersionEntity,
} from '../database/content.entities.js';
import { contentErrors } from '../content/content.errors.js';
import { contentMediaIds, lessonContentSchema, mockContentSchema, unitReviewContentSchema } from '../content/content.schemas.js';
import { listeningContentSchema, listeningMediaIds } from '../listening/listening.schemas.js';

const mediaIdsBy = (schema, extract) => (content) => {
  const parsed = schema.safeParse(content);
  return parsed.success ? extract(parsed.data) : [];
};

export class ContentVersionService {
  constructor(repository, contentService, listeningService, courseService) {
    this.repository = repository;
    this.contentService = contentService;
    this.kinds = {
      [ContentVersionKind.LESSON]: {
        entity: LessonVersionEntity,
        owner: 'lessonId',
        find: (id) => repository.findLesson(id),
        publishedId: (owner) => owner.publishedVersionId,
        notFound: contentErrors.lessonNotFound,
        mediaIds: mediaIdsBy(lessonContentSchema, contentMediaIds),
        restore: (actor, id, content) => contentService.saveLessonDraft(actor, id, lessonContentSchema.parse(content)),
      },
      [ContentVersionKind.MOCK_TEST]: {
        entity: MockTestVersionEntity,
        owner: 'mockTestId',
        find: (id) => repository.findMockTest(id),
        publishedId: (owner) => owner.publishedVersionId,
        notFound: contentErrors.mockNotFound,
        mediaIds: mediaIdsBy(mockContentSchema, contentMediaIds),
        restore: (actor, id, content) => contentService.saveMockTestDraft(actor, id, mockContentSchema.parse(content)),
      },
      [ContentVersionKind.LISTENING_EXERCISE]: {
        entity: ListeningExerciseVersionEntity,
        owner: 'exerciseId',
        find: (id) => listeningService.repository.findExercise(id),
        publishedId: (owner) => owner.publishedVersionId,
        notFound: contentErrors.listeningExerciseNotFound,
        mediaIds: mediaIdsBy(listeningContentSchema, listeningMediaIds),
        restore: (actor, id, content) => listeningService.saveDraft(actor, id, listeningContentSchema.parse(content)),
      },
      [ContentVersionKind.COURSE_ITEM]: {
        entity: ListeningCourseVersionEntity,
        owner: 'itemId',
        find: (id) => courseService.repository.findItem(id),
        publishedId: (owner) => owner.publishedVersionId,
        notFound: contentErrors.courseItemNotFound,
        restore: (actor, id, content) => courseService.saveDraft(actor, id, content),
      },
      [ContentVersionKind.UNIT_REVIEW]: {
        entity: UnitReviewVersionEntity,
        owner: 'unitId',
        find: (id) => repository.findUnit(id),
        publishedId: (owner) => owner.reviewVersionId,
        notFound: contentErrors.unitNotFound,
        restore: (actor, id, content) => contentService.saveUnitReviewDraft(actor, id, unitReviewContentSchema.parse(content)),
      },
    };
  }

  assertManager(actor) {
    if (actor.role !== AccountRole.CONTENT_MANAGER) throw contentErrors.forbiddenRole();
  }

  async owner(actor, { kind, id }) {
    this.assertManager(actor);
    const spec = this.kinds[kind];
    const owner = await spec.find(id);
    if (!owner) throw spec.notFound();
    return { spec, owner };
  }

  versionView(spec, owner, version) {
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      current: version.id === spec.publishedId(owner),
      publishedAt: version.publishedAt ? new Date(version.publishedAt).toISOString() : null,
      publishedBy: version.publishedBy || null,
      createdAt: version.createdAt ? new Date(version.createdAt).toISOString() : null,
      createdBy: version.createdBy || null,
    };
  }

  async listVersions(actor, { kind, id }) {
    const { spec, owner } = await this.owner(actor, { kind, id });
    const rows = await this.repository.listVersionsOf(spec.entity, spec.owner, id);
    return { kind, id, versions: rows.map((version) => this.versionView(spec, owner, version)) };
  }

  async version(spec, owner, id, versionId) {
    const version = versionId ? await this.repository.findVersionOf(spec.entity, versionId) : null;
    if (!version || version[spec.owner] !== owner.id) throw spec.notFound();
    return version;
  }

  async getVersion(actor, { kind, id, versionId }) {
    const { spec, owner } = await this.owner(actor, { kind, id });
    const version = await this.version(spec, owner, id, versionId);
    return { kind, id, version: { ...this.versionView(spec, owner, version), content: version.content } };
  }

  async discardDraft(actor, { kind, id }) {
    const { spec, owner } = await this.owner(actor, { kind, id });
    const rows = await this.repository.listVersionsOf(spec.entity, spec.owner, owner.id);
    const summary = rows.find((version) => version.status === LessonVersionStatus.DRAFT);
    if (!summary) throw contentErrors.noDraft();
    const draft = await this.repository.findVersionOf(spec.entity, summary.id);
    const mediaIds = spec.mediaIds ? spec.mediaIds(draft.content) : [];
    await this.repository.deleteVersionOf(spec.entity, draft.id);
    const removedMedia = await this.contentService.removeUnusedMedia(mediaIds);
    return { discarded: { versionId: draft.id, versionNumber: draft.versionNumber }, removedMedia: removedMedia.length };
  }

  async deleteVersion(actor, { kind, id, versionId }) {
    const { spec, owner } = await this.owner(actor, { kind, id });
    const version = await this.version(spec, owner, id, versionId);
    if (version.status === LessonVersionStatus.DRAFT) throw contentErrors.versionIsDraft();
    if (version.id === spec.publishedId(owner)) throw contentErrors.versionIsCurrent();
    const mediaIds = spec.mediaIds ? spec.mediaIds(version.content) : [];
    await this.repository.deleteVersionOf(spec.entity, version.id);
    const removedMedia = await this.contentService.removeUnusedMedia(mediaIds);
    return { deleted: { versionId: version.id, versionNumber: version.versionNumber }, removedMedia: removedMedia.length };
  }

  async restoreVersion(actor, { kind, id, versionId }) {
    const { spec, owner } = await this.owner(actor, { kind, id });
    const version = await this.version(spec, owner, id, versionId);
    if (version.status === LessonVersionStatus.DRAFT) throw contentErrors.versionIsDraft();
    const view = await spec.restore(actor, id, structuredClone(version.content));
    return { restoredFrom: this.versionView(spec, owner, version), ...view };
  }
}
