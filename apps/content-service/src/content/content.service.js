import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { AccountRole } from '@appenglish/auth-contracts';
import {
  LESSON_TEST_QUESTION_COUNT,
  LessonVersionStatus,
  MIN_PUBLISHED_LESSONS_PER_UNIT,
  MediaSection,
  UnitStatus,
  countBlanks,
} from '@appenglish/content-contracts';
import { contentErrors } from './content.errors.js';
import {
  contentMediaIds,
  lessonContentSchema,
  placementContentSchema,
  placementIssues,
  publishIssues,
} from './content.schemas.js';

const emptyContent = () => lessonContentSchema.parse({});
const logger = new Logger('ContentService');

// Storage folder of a lesson's files (D53), e.g. audio/unit1-lesson2/vocabulary:
// by kind, then the unit and lesson numbers, then the section.
function lessonMediaFolder(kind, unit, lesson, section) {
  return `${kind}/unit${unit.position}-lesson${lesson.position}/${section}`;
}

// Moves one item of a position-ordered list and renumbers it from 1.
function reorder(items, id, position) {
  const moved = items.find((item) => item.id === id);
  const rest = items.filter((item) => item.id !== id);
  rest.splice(Math.min(position, items.length) - 1, 0, moved);
  rest.forEach((item, index) => {
    item.position = index + 1;
  });
  return rest;
}

// Items keep the id the client sent so they stay traceable across versions;
// new items get one here.
function withIds(content) {
  const identified = (item) => ({ ...item, id: item.id || randomUUID() });
  return {
    ...(content.vocabulary ? { vocabulary: content.vocabulary.map(identified), fillIn: content.fillIn } : {}),
    test: Object.fromEntries(
      Object.entries(content.test).map(([key, part]) => [
        key,
        {
          ...part,
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

  // Content Managers see every unit and lesson with its publishing state;
  // other roles see published units and their published lessons only.
  async listUnits(actor) {
    const manager = this.isManager(actor);
    const [units, lessons, versions] = await Promise.all([
      this.repository.listUnits(),
      this.repository.listLessons(),
      manager ? this.repository.listVersionSummaries() : [],
    ]);
    const visibleUnits = manager
      ? units
      : units.filter((unit) => unit.status === UnitStatus.PUBLISHED);
    return {
      units: visibleUnits.map((unit) => ({
        ...this.unitView(unit),
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
    this.assertManager(actor);
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
    this.assertManager(actor);
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

  async createLesson(actor, unitId, input) {
    this.assertManager(actor);
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
      {
        versionNumber: 1,
        status: LessonVersionStatus.DRAFT,
        content: emptyContent(),
        createdBy: actor.id,
      },
    );
    return this.managedLessonView(lesson, draft, null);
  }

  async updateLesson(actor, lessonId, changes) {
    this.assertManager(actor);
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
    if (this.isManager(actor))
      return this.managedLessonView(
        lesson,
        await this.repository.findDraft(lessonId),
        published,
      );
    const unit = await this.repository.findUnit(lesson.unitId);
    // An unpublished lesson or unit is indistinguishable from a missing one.
    if (!published || unit?.status !== UnitStatus.PUBLISHED)
      throw contentErrors.lessonNotFound();
    return this.learnerLessonView(lesson, published);
  }

  async saveLessonDraft(actor, lessonId, content) {
    this.assertManager(actor);
    const lesson = await this.repository.findLesson(lessonId);
    if (!lesson) throw contentErrors.lessonNotFound();
    let draft = await this.repository.findDraft(lessonId);
    const previous = draft ? lessonContentSchema.safeParse(draft.content) : null;
    const previousMediaIds = previous?.success ? contentMediaIds(previous.data) : [];
    if (draft) draft.content = withIds(content);
    else
      draft = {
        lessonId,
        versionNumber: (await this.repository.maxVersionNumber(lessonId)) + 1,
        status: LessonVersionStatus.DRAFT,
        content: withIds(content),
        createdBy: actor.id,
      };
    draft = await this.repository.saveVersion(draft);
    // Files this save dropped from the draft are removed from storage.
    const kept = new Set(contentMediaIds(draft.content));
    await this.removeUnusedMedia(previousMediaIds.filter((id) => !kept.has(id)));
    const published = lesson.publishedVersionId
      ? await this.repository.findVersion(lesson.publishedVersionId)
      : null;
    return this.managedLessonView(lesson, draft, published);
  }

  // Publishing freezes the draft as the next immutable version (D40).
  async publishLesson(actor, lessonId) {
    this.assertManager(actor);
    const lesson = await this.repository.findLesson(lessonId);
    if (!lesson) throw contentErrors.lessonNotFound();
    const draft = await this.repository.findDraft(lessonId);
    if (!draft) throw contentErrors.noDraft();
    // Stored drafts are re-read through the schema so every part exists.
    draft.content = lessonContentSchema.parse(draft.content);
    const mediaIds = contentMediaIds(draft.content);
    const media = mediaIds.length ? await this.repository.findMediaByIds(mediaIds) : [];
    const issues = publishIssues(
      draft.content,
      new Map(media.map((asset) => [asset.id, asset])),
    );
    if (issues.length) throw contentErrors.notPublishable(issues);
    draft.status = LessonVersionStatus.PUBLISHED;
    draft.publishedAt = new Date();
    draft.publishedBy = actor.id;
    lesson.publishedVersionId = draft.id;
    await this.repository.publishVersion(lesson, draft);
    return this.managedLessonView(lesson, null, draft);
  }

  // Looks the word up in the dictionary source and stores the audio it has
  // for the requested accents. Whatever is missing comes back empty/null and
  // the Content Manager enters or uploads it (D47).
  async autofillPronunciation(actor, { word, accents, lessonId }) {
    this.assertManager(actor);
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
        audio[accent] = (
          await this.uploadMedia(actor, { kind: 'audio', fileName, mimeType: 'audio/mpeg', data, lessonId, section: MediaSection.VOCABULARY })
        ).media;
      } catch {
        // A failed download is reported as missing audio for that accent.
      }
    }
    return { found: entry.found, phonetic: entry.phonetic, audio };
  }

  async uploadMedia(actor, input) {
    this.assertManager(actor);
    // Files of a lesson go to that lesson's folder, vocabulary apart from the test.
    let folder;
    if (input.section === MediaSection.PLACEMENT) folder = `${input.kind}/placement`;
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
      },
    };
  }

  // ----- Placement test (F03): one shared test, versioned like a lesson.

  async getPlacement(actor) {
    this.assertManager(actor);
    return this.managedPlacementView(
      await this.repository.findPlacementDraft(),
      await this.repository.findPublishedPlacement(),
    );
  }

  async savePlacementDraft(actor, content) {
    this.assertManager(actor);
    let draft = await this.repository.findPlacementDraft();
    const previous = draft ? placementContentSchema.safeParse(draft.content) : null;
    const previousMediaIds = previous?.success ? contentMediaIds(previous.data) : [];
    if (draft) draft.content = withIds(content);
    else
      draft = {
        versionNumber: (await this.repository.maxPlacementVersionNumber()) + 1,
        status: LessonVersionStatus.DRAFT,
        content: withIds(content),
        createdBy: actor.id,
      };
    draft = await this.repository.savePlacementVersion(draft);
    const kept = new Set(contentMediaIds(draft.content));
    await this.removeUnusedMedia(previousMediaIds.filter((id) => !kept.has(id)));
    return this.managedPlacementView(draft, await this.repository.findPublishedPlacement());
  }

  // Publishing freezes the draft as the next version. Attempts already in
  // progress finish on the version they started (D40).
  async publishPlacement(actor) {
    this.assertManager(actor);
    const draft = await this.repository.findPlacementDraft();
    if (!draft) throw contentErrors.noDraft();
    draft.content = placementContentSchema.parse(draft.content);
    const mediaIds = contentMediaIds(draft.content);
    const media = mediaIds.length ? await this.repository.findMediaByIds(mediaIds) : [];
    const issues = placementIssues(draft.content, new Map(media.map((asset) => [asset.id, asset])));
    if (issues.length) throw contentErrors.notPublishable(issues);
    draft.status = LessonVersionStatus.PUBLISHED;
    draft.publishedAt = new Date();
    draft.publishedBy = actor.id;
    return this.managedPlacementView(null, await this.repository.savePlacementVersion(draft));
  }

  // For learning-service: the given published version, or the latest one,
  // with answers, the delivery URL of its files and the number of published
  // units (the highest unit a learner can start at).
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

  async managedPlacementView(draft, published) {
    return {
      media: await this.mediaOf([draft, published], placementContentSchema),
      draft: draft ? { versionNumber: draft.versionNumber, content: draft.content } : null,
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

  // Removes a file the editor no longer uses. A file a saved version still
  // refers to is kept; it goes when the draft that drops it is saved.
  async deleteMedia(actor, mediaId) {
    this.assertManager(actor);
    if (!(await this.repository.findMediaByIds([mediaId])).length) throw contentErrors.mediaNotFound();
    return { deleted: (await this.removeUnusedMedia([mediaId])).includes(mediaId) };
  }

  // Deletes, from storage and the database, the given media that no saved
  // lesson version (draft or published, D40) refers to. Returns the deleted
  // ids. A storage failure keeps the row so the delete can be retried.
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
      hasDraft: own.some((version) => version.status === LessonVersionStatus.DRAFT),
    };
  }

  // The files the given versions refer to, by media id, so an editor can show
  // and play them. Locally stored files have no delivery URL yet.
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
      draft: draft ? { versionNumber: draft.versionNumber, content: draft.content } : null,
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

  // Learners get the study material without any answer: fill-in answers and
  // the lesson test (questions, correct options, transcripts, explanations)
  // stay private.
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
