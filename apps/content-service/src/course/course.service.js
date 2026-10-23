import { randomUUID } from 'node:crypto';
import { COURSE_LEVELS, COURSE_RECORDING_KIND, CourseItemType, LessonVersionStatus, SpeechTask } from '@appenglish/content-contracts';
import { contentErrors } from '../content/content.errors.js';
import { contentSchemaOf, courseIssues, courseMediaIds } from './course.schemas.js';

const iso = (date) => (date ? new Date(date).toISOString() : null);
const withId = (item) => ({ ...item, id: item.id || randomUUID() });
const questionWithIds = (question) => ({ ...withId(question), options: question.options.map(withId) });
const sectionWithIds = (section) => ({ ...withId(section), questions: section.questions.map(questionWithIds) });

// The topics of a level in order.
const topicsOf = (items, level) =>
  items.filter((item) => item.level === level && item.type === CourseItemType.TOPIC).sort((a, b) => a.position - b.position);

// Items keep the ids the editor sent; new ones get one here.
function withIds(type, content) {
  if (type !== CourseItemType.TOPIC) return { sections: content.sections.map(sectionWithIds) };
  return {
    ...content,
    segments: content.segments.map(withId),
    vocabulary: content.vocabulary.map(withId),
    questions: content.questions.map(questionWithIds),
    ordering: { ...content.ordering, items: content.ordering.items.map(withId) },
  };
}

// The Listening course (F05C, D143–D145): each level A1–C2 has topics in
// order, each topic one listening lesson, and every level but the last a level
// test. Written and published by a Content Manager like mock tests. Each
// topic and level-test section holds its own recording (D147); speech jobs on
// a topic's recording go through ListeningService.
export class CourseService {
  constructor(repository, contentService, listeningService) {
    this.repository = repository;
    this.contentService = contentService;
    this.listeningService = listeningService;
  }

  assertManager(actor) {
    this.contentService.assertManager(actor);
  }

  itemView(item) {
    return { id: item.id, level: item.level, type: item.type, title: item.title, description: item.description, position: item.position };
  }

  // How much a content holds, for the course overview.
  counts(type, content) {
    if (!content) return { questions: 0, words: 0, hasRecording: false };
    const parsed = contentSchemaOf(type).parse(content);
    if (type === CourseItemType.TOPIC)
      return { questions: parsed.questions.length, words: parsed.vocabulary.length, hasRecording: Boolean(parsed.audioMediaId), ordering: parsed.ordering.enabled };
    return {
      questions: parsed.sections.reduce((sum, section) => sum + section.questions.length, 0),
      words: 0,
      hasRecording: parsed.sections.length > 0 && parsed.sections.every((section) => section.audioMediaId),
    };
  }

  // The course by level: its topics in order and its level test.
  async listCourse(actor) {
    this.assertManager(actor);
    const [items, versions] = await Promise.all([this.repository.listItems(), this.repository.listVersionSummaries()]);
    const summary = async (item) => {
      const own = versions.filter((version) => version.itemId === item.id);
      const draft = own.find((version) => version.status === LessonVersionStatus.DRAFT);
      const shown = draft
        ? await this.repository.findVersion(draft.id)
        : item.publishedVersionId
          ? await this.repository.findVersion(item.publishedVersionId)
          : null;
      return {
        ...this.itemView(item),
        publishedVersionNumber: own.find((version) => version.id === item.publishedVersionId)?.versionNumber ?? null,
        hasDraft: Boolean(draft),
        ...this.counts(item.type, shown?.content),
      };
    };
    return {
      levels: await Promise.all(
        COURSE_LEVELS.map(async (level) => {
          const test = items.find((item) => item.level === level && item.type === CourseItemType.LEVEL_TEST);
          return { level, topics: await Promise.all(topicsOf(items, level).map(summary)), levelTest: test ? await summary(test) : null };
        }),
      ),
    };
  }

  // A topic is added at the end of its level.
  async createItem(actor, { level, type, title, description }) {
    this.assertManager(actor);
    const topics = type === CourseItemType.TOPIC ? topicsOf(await this.repository.listItems(), level) : [];
    const created = await this.repository.createItemWithDraft(
      {
        level,
        type,
        section: null,
        title,
        description,
        position: type === CourseItemType.TOPIC ? topics.length + 1 : 0,
        publishedVersionId: null,
        createdBy: actor.id,
      },
      { versionNumber: 1, status: LessonVersionStatus.DRAFT, content: contentSchemaOf(type).parse({}), createdBy: actor.id },
    );
    if (!created) throw contentErrors.courseItemInvalid('LEVEL_TEST_EXISTS', `Level ${level} already has a level test`);
    return this.managedView(created.item, created.draft, null);
  }

  async findItemOrThrow(itemId) {
    const item = await this.repository.findItem(itemId);
    if (!item) throw contentErrors.courseItemNotFound();
    return item;
  }

  // Title and description apply at once; a topic can move within its level.
  async updateItem(actor, itemId, { title, description, position }) {
    this.assertManager(actor);
    const item = await this.findItemOrThrow(itemId);
    if (title !== undefined) item.title = title;
    if (description !== undefined) item.description = description;
    if (item.type === CourseItemType.TOPIC && position !== undefined) {
      const topics = topicsOf(await this.repository.listItems(), item.level).filter((other) => other.id !== item.id);
      topics.splice(Math.min(position, topics.length + 1) - 1, 0, item);
      topics.forEach((other, index) => {
        other.position = index + 1;
      });
      await this.repository.saveItems(topics);
    } else await this.repository.saveItem(item);
    return { item: this.itemView(item) };
  }

  async publishedVersion(item) {
    return item.publishedVersionId ? this.repository.findVersion(item.publishedVersionId) : null;
  }

  async getItem(actor, itemId) {
    this.assertManager(actor);
    const item = await this.findItemOrThrow(itemId);
    return this.managedView(item, await this.repository.findDraft(itemId), await this.publishedVersion(item));
  }

  async saveDraft(actor, itemId, content) {
    this.assertManager(actor);
    const item = await this.findItemOrThrow(itemId);
    let draft = await this.repository.findDraft(itemId);
    const schema = contentSchemaOf(item.type);
    const previous = draft ? schema.safeParse(draft.content) : null;
    const previousMediaIds = previous?.success ? courseMediaIds(previous.data) : [];
    const parsed = schema.parse(content);
    if (draft) draft.content = withIds(item.type, parsed);
    else
      draft = {
        itemId,
        versionNumber: (await this.repository.maxVersionNumber(itemId)) + 1,
        status: LessonVersionStatus.DRAFT,
        content: withIds(item.type, parsed),
        createdBy: actor.id,
      };
    draft = await this.repository.saveVersion(draft);
    // A recording or pronunciation this save dropped is removed from storage
    // when no other version uses it.
    const kept = new Set(courseMediaIds(draft.content));
    await this.contentService.removeUnusedMedia(previousMediaIds.filter((mediaId) => !kept.has(mediaId)));
    return this.managedView(item, draft, await this.publishedVersion(item));
  }

  // Publishing freezes the draft as the next version.
  async publish(actor, itemId) {
    this.assertManager(actor);
    const item = await this.findItemOrThrow(itemId);
    const draft = await this.repository.findDraft(itemId);
    if (!draft) throw contentErrors.noDraft();
    draft.content = contentSchemaOf(item.type).parse(draft.content);
    const mediaIds = courseMediaIds(draft.content);
    const media = mediaIds.length ? await this.contentService.repository.findMediaByIds(mediaIds) : [];
    const issues = courseIssues(item.type, draft.content, new Map(media.map((asset) => [asset.id, asset])));
    if (issues.length) throw contentErrors.notPublishable(issues);
    draft.status = LessonVersionStatus.PUBLISHED;
    draft.publishedAt = new Date();
    draft.publishedBy = actor.id;
    item.publishedVersionId = draft.id;
    await this.repository.publishVersion(item, draft);
    return this.managedView(item, null, draft);
  }

  async unpublish(actor, itemId) {
    this.assertManager(actor);
    const item = await this.findItemOrThrow(itemId);
    const published = await this.publishedVersion(item);
    if (item.publishedVersionId) {
      item.publishedVersionId = null;
      await this.repository.saveItem(item);
      await this.contentService.noteUnpublished(actor, { type: 'courseItem', id: item.id, title: item.title });
    }
    let draft = await this.repository.findDraft(itemId);
    // The version taken down becomes the draft when there is none (D122).
    if (!draft && published)
      draft = await this.repository.saveVersion({
        itemId,
        versionNumber: (await this.repository.maxVersionNumber(itemId)) + 1,
        status: LessonVersionStatus.DRAFT,
        content: structuredClone(published.content),
        createdBy: actor.id,
      });
    return this.managedView(item, draft, null);
  }

  // Removes a topic or a level test with its versions, its speech jobs and the
  // recordings and pronunciations only it used. The gateway only calls this
  // when no learner has results for the item.
  async delete(actor, itemId) {
    this.assertManager(actor);
    const item = await this.findItemOrThrow(itemId);
    const versions = (await this.repository.listVersionSummaries()).filter((version) => version.itemId === itemId);
    const mediaIds = [];
    for (const summary of versions) {
      const version = await this.repository.findVersion(summary.id);
      const parsed = version ? contentSchemaOf(item.type).safeParse(version.content) : null;
      if (parsed?.success) mediaIds.push(...courseMediaIds(parsed.data));
    }
    await this.repository.deleteItemWithVersions(itemId);
    if (item.type === CourseItemType.TOPIC) {
      const rest = topicsOf(await this.repository.listItems(), item.level).filter((other) => other.id !== itemId);
      await this.repository.saveItems(rest.map((other, index) => ({ ...other, position: index + 1 })));
    }
    const removedMedia = await this.contentService.removeUnusedMedia([...new Set(mediaIds)]);
    return { deleted: true, type: item.type, level: item.level, removedMedia: removedMedia.length };
  }

  // ----- Speech jobs on a topic's recording (D147): Auto-time finds the times
  // of the saved sentences, Transcribe writes them from the recording.

  async topicForSpeech(actor, itemId) {
    this.assertManager(actor);
    const item = await this.findItemOrThrow(itemId);
    if (item.type !== CourseItemType.TOPIC)
      throw contentErrors.courseItemInvalid('NOT_A_TOPIC', 'Only a topic has sentences to time');
    return item;
  }

  async startSpeechJob(actor, itemId, task) {
    const item = await this.topicForSpeech(actor, itemId);
    const version = (await this.repository.findDraft(itemId)) || (await this.publishedVersion(item));
    const content = version ? contentSchemaOf(item.type).parse(version.content) : null;
    return this.listeningService.queueSpeechJob(actor, {
      owner: { courseItemId: itemId },
      task,
      kind: COURSE_RECORDING_KIND,
      audioMediaId: content?.audioMediaId,
      segments: content?.segments || [],
    });
  }

  requestAutoTime(actor, itemId) {
    return this.startSpeechJob(actor, itemId, SpeechTask.ALIGN);
  }

  requestTranscribe(actor, itemId) {
    return this.startSpeechJob(actor, itemId, SpeechTask.TRANSCRIBE);
  }

  async getAutoTime(actor, itemId) {
    await this.topicForSpeech(actor, itemId);
    return this.listeningService.latestSpeechJob({ courseItemId: itemId });
  }

  // ----- Reads for learning-service. No actor: not exposed by the gateway.

  // The published course: by level, the published topics in order and the
  // published level test.
  async listPublished() {
    const items = (await this.repository.listItems()).filter((item) => item.publishedVersionId);
    const summary = async (item) => {
      const version = await this.repository.findVersion(item.publishedVersionId);
      const content = contentSchemaOf(item.type).parse(version.content);
      return {
        ...this.itemView(item),
        versionId: version.id,
        questionCount:
          item.type === CourseItemType.TOPIC ? content.questions.length : content.sections.reduce((sum, section) => sum + section.questions.length, 0),
      };
    };
    return {
      levels: await Promise.all(
        COURSE_LEVELS.map(async (level) => {
          const test = items.find((item) => item.level === level && item.type === CourseItemType.LEVEL_TEST);
          return { level, topics: await Promise.all(topicsOf(items, level).map(summary)), levelTest: test ? await summary(test) : null };
        }),
      ),
    };
  }

  // A published topic or level test (the current version, or the given one)
  // with its answers and the URLs of its recordings and pronunciations.
  async getPaper(itemId, { versionId } = {}) {
    const item = await this.repository.findItem(itemId);
    if (!item?.publishedVersionId) throw contentErrors.courseItemNotFound();
    const version = await this.repository.findVersion(versionId || item.publishedVersionId);
    if (version?.itemId !== item.id || version.status !== LessonVersionStatus.PUBLISHED) throw contentErrors.courseItemNotFound();
    const content = contentSchemaOf(item.type).parse(version.content);
    return {
      item: this.itemView(item),
      versionId: version.id,
      versionNumber: version.versionNumber,
      content,
      media: await this.mediaUrls(courseMediaIds(content)),
    };
  }

  // id → URL of the given media.
  async mediaUrls(ids) {
    if (!ids.length) return {};
    const assets = await this.contentService.repository.findMediaByIds(ids);
    return Object.fromEntries(assets.map((asset) => [asset.id, asset.url]));
  }

  // The media the versions use, by id, for the editor: kind, file name and
  // URL (none for a locally stored file, which cannot be played).
  async mediaOf(versions) {
    const ids = [...new Set(versions.filter(Boolean).flatMap((version) => {
      const parsed = contentSchemaOf(version.type).safeParse(version.content);
      return parsed.success ? courseMediaIds(parsed.data) : [];
    }))];
    if (!ids.length) return {};
    const assets = await this.contentService.repository.findMediaByIds(ids);
    return Object.fromEntries(
      assets.map((asset) => [asset.id, { kind: asset.kind, fileName: asset.fileName, url: asset.storage === 'local' ? null : asset.url }]),
    );
  }

  async managedView(item, draft, published) {
    return {
      item: this.itemView(item),
      media: await this.mediaOf([draft, published].filter(Boolean).map((version) => ({ type: item.type, content: version.content }))),
      draft: draft ? { versionNumber: draft.versionNumber, content: draft.content } : null,
      published: published
        ? { versionId: published.id, versionNumber: published.versionNumber, publishedAt: iso(published.publishedAt), content: published.content }
        : null,
    };
  }
}
