import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { AccountRole } from '@appenglish/auth-contracts';
import {
  ExamFormat,
  LESSON_TEST_QUESTION_COUNT,
  LessonVersionStatus,
  MIN_PUBLISHED_LESSONS_PER_UNIT,
  MediaSection,
  MOCK_TEST_DURATION_MINUTES,
  MockFormat,
  ORPHAN_MEDIA_GRACE_MS,
  UNIT_REVIEW_QUESTION_COUNT,
  UnitStatus,
  WORKING_VERSION_STATUSES,
  countBlanks,
} from '@appenglish/content-contracts';
import { contentErrors } from './content.errors.js';
import {
  contentMediaIds,
  lessonContentSchema,
  mockContentSchema,
  mockFullStructureIssues,
  mockIssues,
  placementContentSchema,
  placementIssues,
  publishIssues,
  unitReviewContentSchema,
  unitReviewIssues,
} from './content.schemas.js';

const emptyContent = () => lessonContentSchema.parse({});
const isWorking = (version) => WORKING_VERSION_STATUSES.includes(version.status);
const everPublished = (versions) => versions.some((version) => version.status === LessonVersionStatus.PUBLISHED);
const isoOrNull = (value) => (value ? new Date(value).toISOString() : null);
const logger = new Logger('ContentService');

function lessonMediaFolder(kind, unit, lesson, section) {
  return `${kind}/unit${unit.position}-lesson${lesson.position}/${section}`;
}

function reorder(items, id, position) {
  const moved = items.find((item) => item.id === id);
  const rest = items.filter((item) => item.id !== id);
  rest.splice(Math.min(position, items.length) - 1, 0, moved);
  rest.forEach((item, index) => {
    item.position = index + 1;
  });
  return rest;
}

function withIds(content) {
  const identified = (item) => ({ ...item, id: item.id || randomUUID() });
  return {
    ...(content.vocabulary ? { vocabulary: content.vocabulary.map(identified), fillIn: content.fillIn } : {}),
    test: Object.fromEntries(
      Object.entries(content.test).map(([key, part]) => [
        key,
        {
          ...part,
          ...(part.groups ? { groups: part.groups.map(identified) } : {}),
          questions: part.questions.map((question) => ({
            ...identified(question),
            options: question.options.map(identified),
          })),
        },
      ]),
    ),
  };
}

export class ContentService {
  constructor(repository, mediaStorage, pronunciationSource) {
    this.repository = repository;
    this.mediaStorage = mediaStorage;
    this.pronunciationSource = pronunciationSource;
  }

  isManager(actor) {
    return actor.role === AccountRole.CONTENT_MANAGER;
  }

  assertManager(actor) {
    if (!this.isManager(actor)) throw contentErrors.forbiddenRole();
  }

  isTeacher(actor) {
    return actor.role === AccountRole.TEACHER;
  }

  assertTeacher(actor) {
    if (!this.isTeacher(actor)) throw contentErrors.forbiddenRole();
  }

  isStaff(actor) {
    return this.isManager(actor) || this.isTeacher(actor);
  }

  assertStaff(actor) {
    if (!this.isStaff(actor)) throw contentErrors.forbiddenRole();
  }

  openDraft(draft, actor) {
    if (draft.status === LessonVersionStatus.PENDING_REVIEW)
      throw contentErrors.reviewState('PENDING_REVIEW', 'Withdraw it from review before editing');
    draft.status = LessonVersionStatus.DRAFT;
    draft.editedBy = actor.id;
    return draft;
  }

  newDraft(actor, fields) {
    return { ...fields, status: LessonVersionStatus.DRAFT, createdBy: actor.id, editedBy: actor.id };
  }

  draftFrom(published, fields) {
    const author = published.editedBy || published.createdBy;
    return { ...fields, content: structuredClone(published.content), status: LessonVersionStatus.DRAFT, createdBy: author, editedBy: author };
  }

  assertInReview(draft) {
    if (!draft) throw contentErrors.noDraft();
    if (draft.status !== LessonVersionStatus.PENDING_REVIEW)
      throw contentErrors.reviewState('NOT_IN_REVIEW', 'It is not waiting for review');
  }

  approve(draft, actor) {
    const at = new Date();
    Object.assign(draft, { status: LessonVersionStatus.PUBLISHED, publishedAt: at, publishedBy: actor.id, reviewedBy: actor.id, reviewedAt: at, reviewNote: null });
    return draft;
  }

  assertCanDelete(actor, published) {
    if (this.isManager(actor)) return;
    this.assertTeacher(actor);
    if (published) throw contentErrors.reviewState('PUBLISHED_BEFORE', 'Only a Content Manager can delete content that was published');
  }

  draftView(draft) {
    return draft
      ? {
          versionNumber: draft.versionNumber,
          content: draft.content,
          status: draft.status,
          reviewNote: draft.reviewNote || null,
          editedBy: draft.editedBy || draft.createdBy || null,
          submittedAt: isoOrNull(draft.submittedAt),
          reviewedAt: isoOrNull(draft.reviewedAt),
        }
      : null;
  }

  draftStatus(versions) {
    return versions.find(isWorking)?.status ?? null;
  }

  async listUnits(actor) {
    const manager = this.isStaff(actor);
    const [units, lessons, versions, reviews] = await Promise.all([
      this.repository.listUnits(),
      this.repository.listLessons(),
      manager ? this.repository.listVersionSummaries() : [],
      manager ? this.repository.listReviewVersionSummaries() : [],
    ]);
    const visibleUnits = manager
      ? units
      : units.filter((unit) => unit.status === UnitStatus.PUBLISHED);
    return {
      units: visibleUnits.map((unit) => ({
        ...this.unitView(unit),
        ...(manager ? { review: this.reviewSummary(unit, reviews) } : {}),
        lessons: lessons
          .filter((lesson) => lesson.unitId === unit.id)
          .filter((lesson) => manager || lesson.publishedVersionId)
          .map((lesson) =>
            manager
              ? this.managedLessonSummary(lesson, versions)
              : { id: lesson.id, title: lesson.title, position: lesson.position },
          ),
      })),
    };
  }

  async createUnit(actor, input) {
    this.assertTeacher(actor);
    const units = await this.repository.listUnits();
    const unit = await this.repository.saveUnit({
      title: input.title,
      description: input.description,
      position: units.length + 1,
      status: UnitStatus.DRAFT,
      createdBy: actor.id,
    });
    return { unit: this.unitView(unit) };
  }

  async updateUnit(actor, unitId, changes) {
    if (changes.position !== undefined) this.assertManager(actor);
    if (changes.title !== undefined || changes.description !== undefined) this.assertTeacher(actor);
    const units = await this.repository.listUnits();
    const unit = units.find((item) => item.id === unitId);
    if (!unit) throw contentErrors.unitNotFound();
    if (changes.title !== undefined) unit.title = changes.title;
    if (changes.description !== undefined) unit.description = changes.description;
    if (changes.position !== undefined)
      await this.repository.saveUnits(reorder(units, unitId, changes.position));
    else await this.repository.saveUnit(unit);
    return { unit: this.unitView(unit) };
  }

  async publishUnit(actor, unitId) {
    this.assertManager(actor);
    const unit = await this.repository.findUnit(unitId);
    if (!unit) throw contentErrors.unitNotFound();
    if (unit.status !== UnitStatus.PUBLISHED) {
      const lessons = await this.repository.listLessonsByUnit(unitId);
      const published = lessons.filter((lesson) => lesson.publishedVersionId).length;
      if (published < MIN_PUBLISHED_LESSONS_PER_UNIT)
        throw contentErrors.notPublishable([
          {
            path: 'lessons',
            message: `A unit needs at least ${MIN_PUBLISHED_LESSONS_PER_UNIT} published lesson${MIN_PUBLISHED_LESSONS_PER_UNIT === 1 ? '' : 's'}; it has ${published}`,
          },
        ]);
      unit.status = UnitStatus.PUBLISHED;
      unit.publishedAt = new Date();
      await this.repository.saveUnit(unit);
    }
    return { unit: this.unitView(unit) };
  }

  async unpublishUnit(actor, unitId) {
    this.assertManager(actor);
    const unit = await this.repository.findUnit(unitId);
    if (!unit) throw contentErrors.unitNotFound();
    if (unit.status === UnitStatus.PUBLISHED) {
      unit.status = UnitStatus.DRAFT;
      await this.repository.saveUnit(unit);
      await this.noteUnpublished(actor, { type: 'unit', id: unit.id, title: unit.title });
    }
    return { unit: this.unitView(unit) };
  }

  reviewSummary(unit, summaries) {
    const own = summaries.filter((version) => version.unitId === unit.id);
    return {
      publishedVersionNumber: own.find((version) => version.id === unit.reviewVersionId)?.versionNumber ?? null,
      hasDraft: own.some(isWorking),
      draftStatus: this.draftStatus(own),
    };
  }

  async findUnitOrThrow(unitId) {
    const unit = await this.repository.findUnit(unitId);
    if (!unit) throw contentErrors.unitNotFound();
    return unit;
  }

  async publishedReviewVersion(unit) {
    return unit.reviewVersionId ? this.repository.findReviewVersion(unit.reviewVersionId) : null;
  }

  managedReviewView(unit, draft, published) {
    return {
      unit: this.unitView(unit),
      questionCount: UNIT_REVIEW_QUESTION_COUNT,
      draft: this.draftView(draft),
      published: published
        ? {
            versionId: published.id,
            versionNumber: published.versionNumber,
            publishedAt: new Date(published.publishedAt).toISOString(),
            content: published.content,
          }
        : null,
    };
  }

  async getUnitReview(actor, unitId) {
    this.assertStaff(actor);
    const unit = await this.findUnitOrThrow(unitId);
    return this.managedReviewView(unit, await this.repository.findReviewDraft(unitId), await this.publishedReviewVersion(unit));
  }

  async saveUnitReviewDraft(actor, unitId, content) {
    this.assertTeacher(actor);
    const unit = await this.findUnitOrThrow(unitId);
    let draft = await this.repository.findReviewDraft(unitId);
    if (draft) this.openDraft(draft, actor).content = withIds(content);
    else
      draft = this.newDraft(actor, {
        unitId,
        versionNumber: (await this.repository.maxReviewVersionNumber(unitId)) + 1,
        content: withIds(content),
      });
    draft = await this.repository.saveReviewVersion(draft);
    return this.managedReviewView(unit, draft, await this.publishedReviewVersion(unit));
  }

  async reviewDraftIssues(draft) {
    draft.content = unitReviewContentSchema.parse(draft.content);
    return unitReviewIssues(draft.content);
  }

  async publishUnitReview(actor, unitId) {
    this.assertManager(actor);
    const unit = await this.findUnitOrThrow(unitId);
    const draft = await this.repository.findReviewDraft(unitId);
    this.assertInReview(draft);
    const issues = await this.reviewDraftIssues(draft);
    if (issues.length) throw contentErrors.notPublishable(issues);
    this.approve(draft, actor);
    unit.reviewVersionId = draft.id;
    await this.repository.publishReviewVersion(unit, draft);
    return this.managedReviewView(unit, null, draft);
  }

  async unpublishUnitReview(actor, unitId) {
    this.assertManager(actor);
    const unit = await this.findUnitOrThrow(unitId);
    const published = await this.publishedReviewVersion(unit);
    if (unit.reviewVersionId) {
      unit.reviewVersionId = null;
      await this.repository.saveUnit(unit);
      await this.noteUnpublished(actor, { type: 'unitReview', id: unit.id, title: unit.title });
    }
    let draft = await this.repository.findReviewDraft(unitId);
    if (!draft && published)
      draft = await this.repository.saveReviewVersion(this.draftFrom(published, {
        unitId,
        versionNumber: (await this.repository.maxReviewVersionNumber(unitId)) + 1,
      }));
    return this.managedReviewView(unit, draft, null);
  }

  async getUnitReviewPaper(unitId, { versionId } = {}) {
    const unit = await this.repository.findUnit(unitId);
    if (!unit?.reviewVersionId || unit.status !== UnitStatus.PUBLISHED) throw contentErrors.unitReviewNotFound();
    const version = await this.repository.findReviewVersion(versionId || unit.reviewVersionId);
    if (version?.unitId !== unit.id || version.status !== LessonVersionStatus.PUBLISHED)
      throw contentErrors.unitReviewNotFound();
    return {
      unit: { id: unit.id, title: unit.title },
      versionId: version.id,
      versionNumber: version.versionNumber,
      test: unitReviewContentSchema.parse(version.content).test,
    };
  }

  async deleteUnit(actor, unitId) {
    this.assertStaff(actor);
    const unit = await this.repository.findUnit(unitId);
    if (!unit) throw contentErrors.unitNotFound();
    const lessons = await this.repository.listLessonsByUnit(unitId);
    const lessonIds = new Set(lessons.map((lesson) => lesson.id));
    const [lessonVersions, reviewVersions] = await Promise.all([this.repository.listVersionSummaries(), this.repository.listReviewVersionSummaries()]);
    this.assertCanDelete(
      actor,
      Boolean(unit.publishedAt) ||
        everPublished(lessonVersions.filter((version) => lessonIds.has(version.lessonId))) ||
        everPublished(reviewVersions.filter((version) => version.unitId === unitId)),
    );
    const mediaIds = await this.mediaIdsOfLessons(lessons.map((lesson) => lesson.id));
    await this.repository.deleteUnitWithLessons(unitId, lessons.map((lesson) => lesson.id));
    const units = (await this.repository.listUnits()).filter((item) => item.id !== unitId);
    await this.repository.saveUnits(units.map((item, index) => ({ ...item, position: index + 1 })));
    const removedMedia = await this.removeUnusedMedia(mediaIds);
    return { deleted: true, lessons: lessons.length, removedMedia: removedMedia.length };
  }

  async mediaIdsOfLessons(lessonIds) {
    const summaries = (await this.repository.listVersionSummaries()).filter((version) => lessonIds.includes(version.lessonId));
    const ids = [];
    for (const summary of summaries) {
      const version = await this.repository.findVersion(summary.id);
      const parsed = version ? lessonContentSchema.safeParse(version.content) : null;
      if (parsed?.success) ids.push(...contentMediaIds(parsed.data));
    }
    return [...new Set(ids)];
  }

  async createLesson(actor, unitId, input) {
    this.assertTeacher(actor);
    if (!(await this.repository.findUnit(unitId))) throw contentErrors.unitNotFound();
    const siblings = await this.repository.listLessonsByUnit(unitId);
    const { lesson, draft } = await this.repository.createLessonWithDraft(
      {
        unitId,
        title: input.title,
        position: siblings.length + 1,
        publishedVersionId: null,
        createdBy: actor.id,
      },
      this.newDraft(actor, { versionNumber: 1, content: emptyContent() }),
    );
    return this.managedLessonView(lesson, draft, null);
  }

  async updateLesson(actor, lessonId, changes) {
    if (changes.position !== undefined) this.assertManager(actor);
    if (changes.title !== undefined) this.assertTeacher(actor);
    const lesson = await this.repository.findLesson(lessonId);
    if (!lesson) throw contentErrors.lessonNotFound();
    if (changes.title !== undefined) lesson.title = changes.title;
    if (changes.position !== undefined) {
      const siblings = await this.repository.listLessonsByUnit(lesson.unitId);
      const ordered = reorder(
        siblings.map((item) => (item.id === lesson.id ? lesson : item)),
        lesson.id,
        changes.position,
      );
      await this.repository.saveLessons(ordered);
    } else await this.repository.saveLesson(lesson);
    return { lesson: this.lessonView(lesson) };
  }

  async getLesson(actor, lessonId) {
    const lesson = await this.repository.findLesson(lessonId);
    if (!lesson) throw contentErrors.lessonNotFound();
    const published = lesson.publishedVersionId
      ? await this.repository.findVersion(lesson.publishedVersionId)
      : null;
    if (this.isStaff(actor))
      return this.managedLessonView(
        lesson,
        await this.repository.findDraft(lessonId),
        published,
      );
    const unit = await this.repository.findUnit(lesson.unitId);
    if (!published || unit?.status !== UnitStatus.PUBLISHED)
      throw contentErrors.lessonNotFound();
    return this.learnerLessonView(lesson, published);
  }

  async saveLessonDraft(actor, lessonId, content) {
    this.assertTeacher(actor);
    const lesson = await this.repository.findLesson(lessonId);
    if (!lesson) throw contentErrors.lessonNotFound();
    let draft = await this.repository.findDraft(lessonId);
    const previous = draft ? lessonContentSchema.safeParse(draft.content) : null;
    const previousMediaIds = previous?.success ? contentMediaIds(previous.data) : [];
    if (draft) this.openDraft(draft, actor).content = withIds(content);
    else
      draft = this.newDraft(actor, {
        lessonId,
        versionNumber: (await this.repository.maxVersionNumber(lessonId)) + 1,
        content: withIds(content),
      });
    draft = await this.repository.saveVersion(draft);
    const kept = new Set(contentMediaIds(draft.content));
    await this.removeUnusedMedia(previousMediaIds.filter((id) => !kept.has(id)));
    const published = lesson.publishedVersionId
      ? await this.repository.findVersion(lesson.publishedVersionId)
      : null;
    return this.managedLessonView(lesson, draft, published);
  }

  async mediaMapOf(mediaIds) {
    const media = mediaIds.length ? await this.repository.findMediaByIds(mediaIds) : [];
    return new Map(media.map((asset) => [asset.id, asset]));
  }

  async lessonDraftIssues(draft) {
    draft.content = lessonContentSchema.parse(draft.content);
    return publishIssues(draft.content, await this.mediaMapOf(contentMediaIds(draft.content)));
  }

  async publishLesson(actor, lessonId) {
    this.assertManager(actor);
    const lesson = await this.repository.findLesson(lessonId);
    if (!lesson) throw contentErrors.lessonNotFound();
    const draft = await this.repository.findDraft(lessonId);
    this.assertInReview(draft);
    const issues = await this.lessonDraftIssues(draft);
    if (issues.length) throw contentErrors.notPublishable(issues);
    this.approve(draft, actor);
    lesson.publishedVersionId = draft.id;
    await this.repository.publishVersion(lesson, draft);
    return this.managedLessonView(lesson, null, draft);
  }

  async unpublishLesson(actor, lessonId) {
    this.assertManager(actor);
    const lesson = await this.repository.findLesson(lessonId);
    if (!lesson) throw contentErrors.lessonNotFound();
    const published = lesson.publishedVersionId ? await this.repository.findVersion(lesson.publishedVersionId) : null;
    if (lesson.publishedVersionId) {
      lesson.publishedVersionId = null;
      await this.repository.saveLesson(lesson);
      await this.noteUnpublished(actor, { type: 'lesson', id: lesson.id, title: lesson.title });
    }
    let draft = await this.repository.findDraft(lessonId);
    if (!draft && published)
      draft = await this.repository.saveVersion(this.draftFrom(published, {
        lessonId,
        versionNumber: (await this.repository.maxVersionNumber(lessonId)) + 1,
      }));
    return this.managedLessonView(lesson, draft, null);
  }

  async deleteLesson(actor, lessonId) {
    this.assertStaff(actor);
    const lesson = await this.repository.findLesson(lessonId);
    if (!lesson) throw contentErrors.lessonNotFound();
    this.assertCanDelete(actor, everPublished((await this.repository.listVersionSummaries()).filter((version) => version.lessonId === lessonId)));
    const mediaIds = await this.mediaIdsOfLessons([lessonId]);
    await this.repository.deleteLessonWithVersions(lessonId);
    const rest = (await this.repository.listLessonsByUnit(lesson.unitId)).filter((item) => item.id !== lessonId);
    await this.repository.saveLessons(rest.map((item, index) => ({ ...item, position: index + 1 })));
    const removedMedia = await this.removeUnusedMedia(mediaIds);
    return { deleted: true, unitId: lesson.unitId, removedMedia: removedMedia.length };
  }

  async autofillPronunciation(actor, { word, accents, lessonId }) {
    this.assertTeacher(actor);
    let entry;
    try {
      entry = await this.pronunciationSource.lookup(word);
    } catch (error) {
      if (error?.name === 'PronunciationUnavailableError')
        throw contentErrors.pronunciationUnavailable();
      throw error;
    }
    const audio = {};
    for (const accent of accents) {
      audio[accent] = null;
      if (!entry.audio[accent]) continue;
      try {
        const data = await this.pronunciationSource.download(entry.audio[accent]);
        const fileName = `${word.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${accent}.mp3`;
        const { media } = await this.uploadMedia(actor, { kind: 'audio', fileName, mimeType: 'audio/mpeg', data, lessonId, section: MediaSection.VOCABULARY });
        const [asset] = await this.repository.findMediaByIds([media.id]);
        audio[accent] = { ...media, url: asset && asset.storage !== 'local' ? asset.url : null };
      } catch {
      }
    }
    return { found: entry.found, phonetic: entry.phonetic, audio };
  }

  async uploadMedia(actor, input) {
    this.assertTeacher(actor);
    let folder;
    if (input.section === MediaSection.PRACTICE) folder = `${input.kind}/practice`;
    else if (input.section === MediaSection.PLACEMENT) folder = `${input.kind}/placement`;
    else if (input.section === MediaSection.MOCK) folder = `${input.kind}/mock`;
    else if (input.section === MediaSection.LISTENING) folder = `${input.kind}/listening`;
    else if (input.lessonId) {
      const lesson = await this.repository.findLesson(input.lessonId);
      if (!lesson) throw contentErrors.lessonNotFound();
      const unit = await this.repository.findUnit(lesson.unitId);
      folder = lessonMediaFolder(input.kind, unit, lesson, input.section || MediaSection.TEST);
    }
    let stored;
    try {
      stored = await this.mediaStorage.upload({
        folder,
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.data.byteLength,
        data: input.data,
      });
    } catch (error) {
      if (error?.name === 'MediaValidationError')
        throw contentErrors.mediaInvalid(error.code, error.message);
      throw error;
    }
    const asset = await this.repository.saveMedia({
      kind: stored.kind,
      storage: stored.storage,
      storageId: stored.id,
      url: stored.url,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      uploadedBy: actor.id,
    });
    return {
      media: {
        id: asset.id,
        kind: asset.kind,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        url: asset.storage === 'local' ? null : asset.url,
      },
    };
  }

  async getPlacement(actor) {
    this.assertStaff(actor);
    return this.managedPlacementView(
      await this.repository.findPlacementDraft(),
      await this.repository.findPublishedPlacement(),
    );
  }

  async savePlacementDraft(actor, content) {
    this.assertTeacher(actor);
    let draft = await this.repository.findPlacementDraft();
    const previous = draft ? placementContentSchema.safeParse(draft.content) : null;
    const previousMediaIds = previous?.success ? contentMediaIds(previous.data) : [];
    if (draft) this.openDraft(draft, actor).content = withIds(content);
    else
      draft = this.newDraft(actor, {
        versionNumber: (await this.repository.maxPlacementVersionNumber()) + 1,
        content: withIds(content),
      });
    draft = await this.repository.savePlacementVersion(draft);
    const kept = new Set(contentMediaIds(draft.content));
    await this.removeUnusedMedia(previousMediaIds.filter((id) => !kept.has(id)));
    return this.managedPlacementView(draft, await this.repository.findPublishedPlacement());
  }

  async placementDraftIssues(draft) {
    draft.content = placementContentSchema.parse(draft.content);
    return placementIssues(draft.content, await this.mediaMapOf(contentMediaIds(draft.content)));
  }

  async publishPlacement(actor) {
    this.assertManager(actor);
    const draft = await this.repository.findPlacementDraft();
    this.assertInReview(draft);
    const issues = await this.placementDraftIssues(draft);
    if (issues.length) throw contentErrors.notPublishable(issues);
    this.approve(draft, actor);
    return this.managedPlacementView(null, await this.repository.savePlacementVersion(draft));
  }

  async getPlacementPaper({ versionId } = {}) {
    const version = versionId
      ? await this.repository.findPlacementVersion(versionId)
      : await this.repository.findPublishedPlacement();
    if (!version || version.status !== LessonVersionStatus.PUBLISHED) throw contentErrors.placementNotFound();
    return {
      versionId: version.id,
      versionNumber: version.versionNumber,
      test: version.content.test,
      media: await this.mediaOf([version], placementContentSchema),
      publishedUnitCount: await this.repository.countPublishedUnits(),
    };
  }

  examTypeView(examType) {
    return {
      id: examType.id,
      code: examType.code,
      name: examType.name,
      format: examType.format,
      hasEditor: examType.format === ExamFormat.TOEIC,
    };
  }

  async listExamTypes() {
    return { examTypes: (await this.repository.listExamTypes()).map((item) => this.examTypeView(item)) };
  }

  assertAdmin(actor) {
    if (actor.role !== AccountRole.ADMIN) throw contentErrors.forbiddenRole();
  }

  async noteUnpublished(actor, { type, id, title }) {
    const at = new Date();
    await this.repository.addAdminNotice({ kind: 'CONTENT_UNPUBLISHED', key: `unpublished:${type}:${id}:${at.getTime()}`, data: { type, id, title, by: actor.id }, createdAt: at });
  }

  examTypeCode(name) {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
  }

  async assertExamTypeNameFree(name, exceptId) {
    const code = this.examTypeCode(name);
    const clash = (await this.repository.listExamTypes()).some(
      (item) => item.id !== exceptId && (item.code === code || item.name.toLowerCase() === name.toLowerCase()),
    );
    if (!code || clash)
      throw contentErrors.examTypeInvalid('NAME_TAKEN', 'An exam type with this name already exists');
    return code;
  }

  async createExamType(actor, { name }) {
    this.assertAdmin(actor);
    const code = await this.assertExamTypeNameFree(name);
    const examType = await this.repository.saveExamType({ code, name, format: null, createdBy: actor.id });
    return { examType: this.examTypeView(examType) };
  }

  async updateExamType(actor, examTypeId, { name }) {
    this.assertAdmin(actor);
    const examType = await this.repository.findExamType(examTypeId);
    if (!examType) throw contentErrors.examTypeNotFound();
    await this.assertExamTypeNameFree(name, examTypeId);
    examType.name = name;
    await this.repository.saveExamType(examType);
    return { examType: this.examTypeView(examType) };
  }

  async mockView(mockTest) {
    const examType = await this.repository.findExamType(mockTest.examTypeId);
    return {
      id: mockTest.id,
      title: mockTest.title,
      level: mockTest.level,
      durationMinutes: mockTest.durationMinutes,
      format: mockTest.format || MockFormat.FULL,
      examType: examType ? { id: examType.id, code: examType.code, name: examType.name } : null,
    };
  }

  questionCount(content) {
    return Object.values(content.test).reduce((sum, part) => sum + part.questions.length, 0);
  }

  async listMockTests(actor) {
    this.assertStaff(actor);
    const [mockTests, versions] = await Promise.all([
      this.repository.listMockTests(),
      this.repository.listMockVersionSummaries(),
    ]);
    return {
      mockTests: await Promise.all(mockTests.map(async (mockTest) => {
        const own = versions.filter((version) => version.mockTestId === mockTest.id);
        return {
          ...(await this.mockView(mockTest)),
          createdAt: mockTest.createdAt ? new Date(mockTest.createdAt).toISOString() : null,
          publishedVersionNumber:
            own.find((version) => version.id === mockTest.publishedVersionId)?.versionNumber ?? null,
          hasDraft: own.some(isWorking),
          draftStatus: this.draftStatus(own),
        };
      })),
    };
  }

  async createMockTest(actor, input) {
    this.assertTeacher(actor);
    const examType = await this.repository.findExamType(input.examTypeId);
    if (!examType) throw contentErrors.examTypeNotFound();
    if (examType.format !== ExamFormat.TOEIC)
      throw contentErrors.examTypeInvalid('NO_EDITOR', 'Tests cannot be written for this exam type yet');
    const format = input.format || MockFormat.FULL;
    const durationMinutes = format === MockFormat.FULL ? MOCK_TEST_DURATION_MINUTES : input.durationMinutes;
    const mockTest = await this.repository.saveMockTest({ ...input, format, durationMinutes, publishedVersionId: null, createdBy: actor.id });
    const draft = await this.repository.saveMockVersion(this.newDraft(actor, { mockTestId: mockTest.id, versionNumber: 1, content: mockContentSchema.parse({}) }));
    return this.managedMockView(mockTest, draft, null);
  }

  async findMockOrThrow(mockTestId) {
    const mockTest = await this.repository.findMockTest(mockTestId);
    if (!mockTest) throw contentErrors.mockNotFound();
    return mockTest;
  }

  async updateMockTest(actor, mockTestId, changes) {
    this.assertTeacher(actor);
    const mockTest = await this.findMockOrThrow(mockTestId);
    if (changes.format !== undefined && changes.format !== mockTest.format) {
      const versions = (await this.repository.listMockVersionSummaries()).filter((version) => version.mockTestId === mockTestId);
      if (everPublished(versions)) throw contentErrors.reviewState('PUBLISHED_BEFORE', 'The test type cannot change after it was published');
    }
    for (const [field, value] of Object.entries(changes)) if (value !== undefined) mockTest[field] = value;
    if (mockTest.format === MockFormat.FULL) mockTest.durationMinutes = MOCK_TEST_DURATION_MINUTES;
    await this.repository.saveMockTest(mockTest);
    return { mockTest: await this.mockView(mockTest) };
  }

  async publishedMockVersion(mockTest) {
    return mockTest.publishedVersionId ? this.repository.findMockVersion(mockTest.publishedVersionId) : null;
  }

  async getMockTest(actor, mockTestId) {
    this.assertStaff(actor);
    const mockTest = await this.findMockOrThrow(mockTestId);
    return this.managedMockView(
      mockTest,
      await this.repository.findMockDraft(mockTestId),
      await this.publishedMockVersion(mockTest),
    );
  }

  async saveMockTestDraft(actor, mockTestId, content) {
    this.assertTeacher(actor);
    const mockTest = await this.findMockOrThrow(mockTestId);
    let draft = await this.repository.findMockDraft(mockTestId);
    const previous = draft ? mockContentSchema.safeParse(draft.content) : null;
    const previousMediaIds = previous?.success ? contentMediaIds(previous.data) : [];
    if (draft) this.openDraft(draft, actor).content = withIds(content);
    else
      draft = this.newDraft(actor, {
        mockTestId,
        versionNumber: (await this.repository.maxMockVersionNumber(mockTestId)) + 1,
        content: withIds(content),
      });
    draft = await this.repository.saveMockVersion(draft);
    const kept = new Set(contentMediaIds(draft.content));
    await this.removeUnusedMedia(previousMediaIds.filter((id) => !kept.has(id)));
    return this.managedMockView(mockTest, draft, await this.publishedMockVersion(mockTest));
  }

  async mockDraftIssues(draft, mockTest) {
    draft.content = mockContentSchema.parse(draft.content);
    const issues = mockIssues(draft.content, await this.mediaMapOf(contentMediaIds(draft.content)));
    return mockTest.format === MockFormat.PRACTICE ? issues : [...issues, ...mockFullStructureIssues(draft.content.test)];
  }

  async publishMockTest(actor, mockTestId) {
    this.assertManager(actor);
    const mockTest = await this.findMockOrThrow(mockTestId);
    const draft = await this.repository.findMockDraft(mockTestId);
    this.assertInReview(draft);
    const issues = await this.mockDraftIssues(draft, mockTest);
    if (issues.length) throw contentErrors.notPublishable(issues);
    this.approve(draft, actor);
    mockTest.publishedVersionId = draft.id;
    await this.repository.publishMockVersion(mockTest, draft);
    return this.managedMockView(mockTest, null, draft);
  }

  async unpublishMockTest(actor, mockTestId) {
    this.assertManager(actor);
    const mockTest = await this.findMockOrThrow(mockTestId);
    const published = await this.publishedMockVersion(mockTest);
    if (mockTest.publishedVersionId) {
      mockTest.publishedVersionId = null;
      await this.repository.saveMockTest(mockTest);
      await this.noteUnpublished(actor, { type: 'mockTest', id: mockTest.id, title: mockTest.title });
    }
    let draft = await this.repository.findMockDraft(mockTestId);
    if (!draft && published)
      draft = await this.repository.saveMockVersion(this.draftFrom(published, {
        mockTestId,
        versionNumber: (await this.repository.maxMockVersionNumber(mockTestId)) + 1,
      }));
    return this.managedMockView(mockTest, draft, null);
  }

  async deleteMockTest(actor, mockTestId) {
    this.assertStaff(actor);
    await this.findMockOrThrow(mockTestId);
    const summaries = (await this.repository.listMockVersionSummaries()).filter((version) => version.mockTestId === mockTestId);
    this.assertCanDelete(actor, everPublished(summaries));
    const mediaIds = [];
    for (const summary of summaries) {
      const version = await this.repository.findMockVersion(summary.id);
      const parsed = version ? mockContentSchema.safeParse(version.content) : null;
      if (parsed?.success) mediaIds.push(...contentMediaIds(parsed.data));
    }
    await this.repository.deleteMockTestWithVersions(mockTestId);
    const removedMedia = await this.removeUnusedMedia([...new Set(mediaIds)]);
    return { deleted: true, removedMedia: removedMedia.length };
  }

  async managedMockView(mockTest, draft, published) {
    return {
      mockTest: await this.mockView(mockTest),
      media: await this.mediaOf([draft, published], mockContentSchema),
      draft: this.draftView(draft),
      published: published
        ? {
            versionId: published.id,
            versionNumber: published.versionNumber,
            publishedAt: new Date(published.publishedAt).toISOString(),
            content: published.content,
          }
        : null,
    };
  }

  async listPublishedMockTests() {
    const mockTests = (await this.repository.listMockTests()).filter((mockTest) => mockTest.publishedVersionId);
    return {
      mockTests: await Promise.all(
        mockTests.map(async (mockTest) => {
          const version = await this.repository.findMockVersion(mockTest.publishedVersionId);
          const content = mockContentSchema.parse(version.content);
          return {
            ...(await this.mockView(mockTest)),
            questionCount: this.questionCount(content),
            partCounts: Object.fromEntries(
              Object.entries(content.test).map(([key, part]) => [key, part.questions.length]),
            ),
          };
        }),
      ),
    };
  }

  async getMockPaper(mockTestId, { versionId } = {}) {
    const mockTest = await this.repository.findMockTest(mockTestId);
    if (!mockTest?.publishedVersionId) throw contentErrors.mockNotFound();
    const version = await this.repository.findMockVersion(versionId || mockTest.publishedVersionId);
    if (version?.mockTestId !== mockTest.id || version.status !== LessonVersionStatus.PUBLISHED)
      throw contentErrors.mockNotFound();
    return {
      mockTest: await this.mockView(mockTest),
      versionId: version.id,
      versionNumber: version.versionNumber,
      test: mockContentSchema.parse(version.content).test,
      media: await this.mediaOf([version], mockContentSchema),
    };
  }

  async getCurriculum() {
    const [units, lessons] = await Promise.all([
      this.repository.listUnits(),
      this.repository.listLessons(),
    ]);
    return {
      units: units
        .filter((unit) => unit.status === UnitStatus.PUBLISHED)
        .map((unit) => ({
          id: unit.id,
          title: unit.title,
          description: unit.description,
          reviewVersionId: unit.reviewVersionId || null,
          lessons: lessons
            .filter((lesson) => lesson.unitId === unit.id && lesson.publishedVersionId)
            .map((lesson) => ({ id: lesson.id, title: lesson.title })),
        })),
    };
  }

  async getLessonPaper(lessonId, { versionId } = {}) {
    const lesson = await this.repository.findLesson(lessonId);
    const unit = lesson ? await this.repository.findUnit(lesson.unitId) : null;
    if (!lesson?.publishedVersionId || unit?.status !== UnitStatus.PUBLISHED)
      throw contentErrors.lessonNotFound();
    const version = await this.repository.findVersion(versionId || lesson.publishedVersionId);
    if (version?.lessonId !== lesson.id || version.status !== LessonVersionStatus.PUBLISHED)
      throw contentErrors.lessonNotFound();
    const content = lessonContentSchema.parse(version.content);
    return {
      lesson: { id: lesson.id, title: lesson.title, unitId: unit.id, unitTitle: unit.title },
      versionId: version.id,
      versionNumber: version.versionNumber,
      content,
      media: await this.mediaOf([version], lessonContentSchema),
    };
  }

  async managedPlacementView(draft, published) {
    return {
      media: await this.mediaOf([draft, published], placementContentSchema),
      draft: this.draftView(draft),
      published: published
        ? {
            versionId: published.id,
            versionNumber: published.versionNumber,
            publishedAt: new Date(published.publishedAt).toISOString(),
            content: published.content,
          }
        : null,
    };
  }

  async deleteMedia(actor, mediaId) {
    this.assertStaff(actor);
    if (!(await this.repository.findMediaByIds([mediaId])).length) throw contentErrors.mediaNotFound();
    return { deleted: (await this.removeUnusedMedia([mediaId])).includes(mediaId) };
  }

  async listOrphanMedia(actor, { now = Date.now() } = {}) {
    this.assertManager(actor);
    const [candidates, referenced] = await Promise.all([
      this.repository.listMediaBefore(new Date(now - ORPHAN_MEDIA_GRACE_MS)),
      this.repository.listReferencedMediaIds(),
    ]);
    const orphans = [];
    for (const asset of candidates) {
      if (referenced.has(asset.id.toLowerCase())) continue;
      orphans.push({
        id: asset.id,
        kind: asset.kind,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        storage: asset.storage,
        url: asset.storage === 'local' ? null : asset.url,
        createdAt: asset.createdAt ? new Date(asset.createdAt).toISOString() : null,
      });
    }
    return { media: orphans, totalBytes: orphans.reduce((sum, asset) => sum + (asset.sizeBytes || 0), 0) };
  }

  async deleteOrphanMedia(actor, { ids }) {
    this.assertManager(actor);
    const deleted = await this.removeUnusedMedia(ids);
    return { deleted, skipped: ids.filter((id) => !deleted.includes(id)) };
  }

  async removeUnusedMedia(mediaIds) {
    const deleted = [];
    for (const id of new Set(mediaIds)) {
      if (await this.repository.isMediaReferenced(id)) continue;
      const [asset] = await this.repository.findMediaByIds([id]);
      if (!asset) continue;
      try {
        await this.mediaStorage.delete(asset);
        await this.repository.deleteMedia(id);
        deleted.push(id);
      } catch (error) {
        logger.warn(`Could not delete media ${id} from ${asset.storage}: ${error.message}`);
      }
    }
    return deleted;
  }

  unitView(unit) {
    return {
      id: unit.id,
      title: unit.title,
      description: unit.description,
      position: unit.position,
      status: unit.status,
      publishedAt: unit.publishedAt ? new Date(unit.publishedAt).toISOString() : null,
    };
  }

  lessonView(lesson) {
    return {
      id: lesson.id,
      unitId: lesson.unitId,
      title: lesson.title,
      position: lesson.position,
    };
  }

  managedLessonSummary(lesson, versions) {
    const own = versions.filter((version) => version.lessonId === lesson.id);
    return {
      id: lesson.id,
      title: lesson.title,
      position: lesson.position,
      publishedVersionNumber:
        own.find((version) => version.id === lesson.publishedVersionId)?.versionNumber ?? null,
      hasDraft: own.some(isWorking),
      draftStatus: this.draftStatus(own),
    };
  }

  async mediaOf(versions, schema) {
    const mediaIds = versions.flatMap((version) => {
      const parsed = version ? schema.safeParse(version.content) : null;
      return parsed?.success ? contentMediaIds(parsed.data) : [];
    });
    const assets = mediaIds.length ? await this.repository.findMediaByIds([...new Set(mediaIds)]) : [];
    return Object.fromEntries(
      assets.map((asset) => [
        asset.id,
        { kind: asset.kind, fileName: asset.fileName, url: asset.storage === 'local' ? null : asset.url },
      ]),
    );
  }

  async managedLessonView(lesson, draft, published) {
    return {
      media: await this.mediaOf([draft, published], lessonContentSchema),
      lesson: this.lessonView(lesson),
      draft: this.draftView(draft),
      published: published
        ? {
            versionId: published.id,
            versionNumber: published.versionNumber,
            publishedAt: new Date(published.publishedAt).toISOString(),
            content: published.content,
          }
        : null,
    };
  }

  learnerLessonView(lesson, published) {
    const { vocabulary, fillIn } = published.content;
    return {
      lesson: {
        ...this.lessonView(lesson),
        versionId: published.id,
        versionNumber: published.versionNumber,
      },
      vocabulary,
      fillIn: { passage: fillIn.passage, blankCount: countBlanks(fillIn.passage) },
      wordBank: [...new Set(vocabulary.map((item) => item.word))],
      test: { questionCount: LESSON_TEST_QUESTION_COUNT },
    };
  }
}
