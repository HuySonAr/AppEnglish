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

// The media ids a stored version refers to, through its schema; none when
// the content does not parse (an old shape) or the kind has no media.
const mediaIdsBy = (schema, extract) => (content) => {
  const parsed = schema.safeParse(content);
  return parsed.success ? extract(parsed.data) : [];
};

// Version history of every versioned content (D122): a Content Manager lists
// the versions of a lesson, mock test, listening exercise, course item or
// unit review, reads one, and restores one as the draft. Published versions
// stay immutable (D40): restoring copies, it never edits the old version.
export class ContentVersionService {
  constructor(repository, contentService, listeningService, courseService) {
    this.repository = repository;
    this.contentService = contentService;
    // What each kind is made of: its version entity and owner column, how to
    // find the owner and its published version id, the media a version refers
    // to (for discarding a draft), and the save-draft call that restoring
    // goes through (so media clean-up and ids work as usual).
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
        // The course service parses by item type itself.
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

  // A version's facts: current marks the one learners get.
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

  // Throws the draft away (D127): the draft row goes, and so do the files
  // only it used; what a published or taken-down version still uses stays.
  async discardDraft(actor, { kind, id }) {
    const { spec, owner } = await this.owner(actor, { kind, id });
    const rows = await this.repository.listVersionsOf(spec.entity, spec.owner, owner.id);
    const summary = rows.find((version) => version.status === LessonVersionStatus.DRAFT);
    if (!summary) throw contentErrors.noDraft();
    const draft = await this.repository.findVersionOf(spec.entity, summary.id);
    const mediaIds = spec.mediaIds ? spec.mediaIds(draft.content) : [];
    await this.repository.deleteVersionOf(spec.entity, draft.id);
    // Checked after the row is gone, so a file only the draft used is free.
    const removedMedia = await this.contentService.removeUnusedMedia(mediaIds);
    return { discarded: { versionId: draft.id, versionNumber: draft.versionNumber }, removedMedia: removedMedia.length };
  }

  // Removes an old version (D128): not the draft (Discard does that), not the
  // one learners get. The gateway refuses it first while learner attempts
  // refer to it. The files only this version used go with it.
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

  // Copies the version into the draft (replacing what the draft held) and
  // returns the editor's view of the content, as a save would.
  async restoreVersion(actor, { kind, id, versionId }) {
    const { spec, owner } = await this.owner(actor, { kind, id });
    const version = await this.version(spec, owner, id, versionId);
    if (version.status === LessonVersionStatus.DRAFT) throw contentErrors.versionIsDraft();
    const view = await spec.restore(actor, id, structuredClone(version.content));
    return { restoredFrom: this.versionView(spec, owner, version), ...view };
  }
}
