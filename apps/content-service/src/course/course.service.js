import { randomUUID } from 'node:crypto';
import { COURSE_LEVELS, COURSE_SECTIONS, CourseItemType, LessonVersionStatus } from '@appenglish/content-contracts';
import { contentErrors } from '../content/content.errors.js';
import { contentSchemaOf, courseExerciseIds, courseIssues } from './course.schemas.js';

const iso = (date) => (date ? new Date(date).toISOString() : null);
const withId = (item) => ({ ...item, id: item.id || randomUUID() });
const questionWithIds = (question) => ({
  ...withId(question),
  options: question.options.map(withId),
});
const sectionWithIds = (section) => ({
  ...withId(section),
  questions: section.questions.map(questionWithIds),
});

// The units of a level in learning order: section by section (D107), then
// by position within the section.
const sectionRank = (unit) => COURSE_SECTIONS.indexOf(unit.section);
const inCourseOrder = (units) => [...units].sort((a, b) => sectionRank(a) - sectionRank(b) || a.position - b.position);
const unitsOf = (items, level, section) =>
  inCourseOrder(items.filter((item) => item.level === level && item.type === CourseItemType.UNIT && (!section || item.section === section)));

// Items keep the ids the editor sent so learners' progress can follow them
// across versions; new items get one here.
function withIds(type, content) {
  if (type !== CourseItemType.UNIT) return { sections: content.sections.map(sectionWithIds) };
  return {
    lessons: content.lessons.map((lesson) => ({
      ...withId(lesson),
      keywords: lesson.keywords.map(withId),
      gist: questionWithIds(lesson.gist),
      detail: lesson.detail.map(questionWithIds),
    })),
    check: { sections: content.check.sections.map(sectionWithIds) },
  };
}

// The Listening course (F05C, D100): units and level tests of each CEFR level,
// written and published by a Content Manager like mock tests. Recordings come
// from the listening library (ListeningService).
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
    return {
      id: item.id,
      level: item.level,
      type: item.type,
      section: item.section ?? null,
      title: item.title,
      description: item.description,
      position: item.position,
    };
  }

  // How much a content holds, for the course overview.
  counts(type, content) {
    if (!content) return { lessons: 0, questions: 0 };
    const parsed = contentSchemaOf(type).parse(content);
    const sections = type === CourseItemType.UNIT ? parsed.check.sections : parsed.sections;
    return {
      ...(type === CourseItemType.PLACEMENT
        ? {
            levels: [...new Set(parsed.sections.map((section) => section.level).filter(Boolean))].length,
          }
        : {}),
      lessons: type === CourseItemType.UNIT ? parsed.lessons.length : 0,
      questions: sections.reduce((sum, section) => sum + section.questions.length, 0),
    };
  }

  // The course by level: its units in order and its level test.
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
    const placement = items.find((item) => item.type === CourseItemType.PLACEMENT);
    return {
      placement: placement ? await summary(placement) : null,
      levels: await Promise.all(
        COURSE_LEVELS.map(async (level) => {
          const own = items.filter((item) => item.level === level);
          const test = own.find((item) => item.type === CourseItemType.LEVEL_TEST);
          return {
            level,
            units: await Promise.all(inCourseOrder(own.filter((item) => item.type === CourseItemType.UNIT)).map(summary)),
            levelTest: test ? await summary(test) : null,
          };
        }),
      ),
    };
  }

  // A unit is added at the end of its section (D107).
  async createItem(actor, { level, type, section, title, description }) {
    this.assertManager(actor);
    const units = type === CourseItemType.UNIT ? unitsOf(await this.repository.listItems(), level, section) : [];
    const created = await this.repository.createItemWithDraft(
      {
        level,
        type,
        section,
        title,
        description,
        position: type === CourseItemType.UNIT ? units.length + 1 : 0,
        publishedVersionId: null,
        createdBy: actor.id,
      },
      {
        versionNumber: 1,
        status: LessonVersionStatus.DRAFT,
        content: contentSchemaOf(type).parse({}),
        createdBy: actor.id,
      },
    );
    if (!created)
      throw type === CourseItemType.PLACEMENT
        ? contentErrors.courseItemInvalid('PLACEMENT_EXISTS', 'The listening placement already exists')
        : contentErrors.courseItemInvalid('LEVEL_TEST_EXISTS', `Level ${level} already has a level test`);
    return this.managedView(created.item, created.draft, null);
  }

  async findItemOrThrow(itemId) {
    const item = await this.repository.findItem(itemId);
    if (!item) throw contentErrors.courseItemNotFound();
    return item;
  }

  // Title and description apply at once. A unit can move within its section
  // (position) or to the end of the other section of its level (D107).
  async updateItem(actor, itemId, { title, description, section, position }) {
    this.assertManager(actor);
    const item = await this.findItemOrThrow(itemId);
    if (title !== undefined) item.title = title;
    if (description !== undefined) item.description = description;
    const unit = item.type === CourseItemType.UNIT;
    const moved = unit && section !== undefined && section !== item.section;
    if (unit && (moved || position !== undefined)) {
      const items = await this.repository.listItems();
      const changed = [];
      if (moved) {
        // The section left closes its gap.
        unitsOf(items, item.level, item.section)
          .filter((other) => other.id !== item.id)
          .forEach((other, index) => {
            other.position = index + 1;
            changed.push(other);
          });
        item.section = section;
      }
      const units = unitsOf(items, item.level, item.section).filter((other) => other.id !== item.id);
      const at = position === undefined || moved ? units.length : Math.min(position, units.length + 1) - 1;
      units.splice(at, 0, item);
      units.forEach((other, index) => {
        other.position = index + 1;
      });
      await this.repository.saveItems([...changed, ...units]);
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
    const parsed = contentSchemaOf(item.type).parse(content);
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
    return this.managedView(item, draft, await this.publishedVersion(item));
  }

  // Publishing freezes the draft as the next version; every recording it uses
  // must be published in the library.
  async publish(actor, itemId) {
    this.assertManager(actor);
    const item = await this.findItemOrThrow(itemId);
    const draft = await this.repository.findDraft(itemId);
    if (!draft) throw contentErrors.noDraft();
    draft.content = contentSchemaOf(item.type).parse(draft.content);
    const exercises = await this.exercisesOf([draft]);
    const issues = courseIssues(item.type, draft.content, new Map(Object.entries(exercises)));
    if (issues.length) throw contentErrors.notPublishable(issues);
    draft.status = LessonVersionStatus.PUBLISHED;
    draft.publishedAt = new Date();
    draft.publishedBy = actor.id;
    item.publishedVersionId = draft.id;
    await this.repository.publishVersion(item, draft);
    return this.managedView(item, null, draft);
  }

  // ----- Reads for learning-service (F05C). No actor: not exposed by the gateway.

  // The published course: by level, the published units in order (with their
  // lessons' ids and titles) and the published level test.
  async listPublished() {
    const items = (await this.repository.listItems()).filter((item) => item.publishedVersionId);
    const summary = async (item) => {
      const version = await this.repository.findVersion(item.publishedVersionId);
      const content = contentSchemaOf(item.type).parse(version.content);
      const sections = item.type === CourseItemType.UNIT ? content.check.sections : content.sections;
      return {
        ...this.itemView(item),
        versionId: version.id,
        lessons:
          item.type === CourseItemType.UNIT
            ? content.lessons.map((lesson) => ({
                id: lesson.id,
                title: lesson.title,
              }))
            : [],
        questionCount: sections.reduce((sum, section) => sum + section.questions.length, 0),
      };
    };
    const placement = items.find((item) => item.type === CourseItemType.PLACEMENT);
    return {
      placement: placement ? await summary(placement) : null,
      levels: await Promise.all(
        COURSE_LEVELS.map(async (level) => {
          const own = items.filter((item) => item.level === level);
          const test = own.find((item) => item.type === CourseItemType.LEVEL_TEST);
          return {
            level,
            units: await Promise.all(inCourseOrder(own.filter((item) => item.type === CourseItemType.UNIT)).map(summary)),
            levelTest: test ? await summary(test) : null,
          };
        }),
      ),
    };
  }

  // A published unit or level test (the current version, or the given one)
  // with its answers and the recordings it uses.
  async getPaper(itemId, { versionId } = {}) {
    const item = await this.repository.findItem(itemId);
    if (!item?.publishedVersionId) throw contentErrors.courseItemNotFound();
    const version = await this.repository.findVersion(versionId || item.publishedVersionId);
    if (version?.itemId !== item.id || version.status !== LessonVersionStatus.PUBLISHED) throw contentErrors.courseItemNotFound();
    return {
      item: this.itemView(item),
      versionId: version.id,
      versionNumber: version.versionNumber,
      content: contentSchemaOf(item.type).parse(version.content),
      exercises: await this.exercisesOf([version]),
    };
  }

  // The published library exercises the versions use, by id: title, level,
  // kind, topic, recording and sentences, so the editor can show and choose
  // them. An exercise not published is left out.
  async exercisesOf(versions) {
    const ids = [...new Set(versions.filter(Boolean).flatMap((version) => courseExerciseIds(version.content)))];
    const found = {};
    for (const exerciseId of ids) {
      try {
        const paper = await this.listeningService.getPaper(exerciseId);
        const { audioMediaId, segments } = paper.content;
        found[exerciseId] = {
          ...paper.exercise,
          audioUrl: (audioMediaId && paper.media[audioMediaId]?.url) || null,
          segments: segments.map(({ id, speaker, text, start, end }) => ({
            id,
            speaker,
            text,
            start,
            end,
          })),
        };
      } catch (error) {
        if (error?.status !== 404) throw error;
      }
    }
    return found;
  }

  async managedView(item, draft, published) {
    return {
      item: this.itemView(item),
      exercises: await this.exercisesOf([draft, published]),
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
