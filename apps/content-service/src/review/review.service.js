import { ContentReviewKind, LessonVersionStatus, PLACEMENT_REVIEW_ID, PracticePromptStatus } from '@appenglish/content-contracts';
import { contentErrors } from '../content/content.errors.js';

const iso = (value) => (value ? new Date(value).toISOString() : null);
const ms = (value) => new Date(value).getTime();
const REVIEW_NOTICE_DAYS = 30;
const APPROVED_PROMPT = new Set([PracticePromptStatus.PUBLISHED, PracticePromptStatus.ARCHIVED, PracticePromptStatus.UNPUBLISHED]);

export class ContentReviewService {
  constructor(contentService, listeningService, { now = () => new Date(), practiceRepository = null, swTestService = null } = {}) {
    const content = contentService;
    const repository = contentService.repository;
    const listening = listeningService;
    this.content = content;
    this.listening = listening;
    this.now = now;
    this.practiceRepository = practiceRepository;
    this.swTestService = swTestService;
    this.kinds = {
      [ContentReviewKind.LESSON]: {
        find: (id) => repository.findLesson(id),
        notFound: contentErrors.lessonNotFound,
        working: (id) => repository.findDraft(id),
        save: (version) => repository.saveVersion(version),
        issues: (item, draft) => content.lessonDraftIssues(draft),
        publish: (actor, id) => content.publishLesson(actor, id),
      },
      [ContentReviewKind.UNIT_REVIEW]: {
        find: (id) => repository.findUnit(id),
        notFound: contentErrors.unitNotFound,
        working: (id) => repository.findReviewDraft(id),
        save: (version) => repository.saveReviewVersion(version),
        issues: (item, draft) => content.reviewDraftIssues(draft),
        publish: (actor, id) => content.publishUnitReview(actor, id),
      },
      [ContentReviewKind.PLACEMENT]: {
        find: async (id) => (id === PLACEMENT_REVIEW_ID ? { id } : null),
        notFound: contentErrors.noDraft,
        working: () => repository.findPlacementDraft(),
        save: (version) => repository.savePlacementVersion(version),
        issues: (item, draft) => content.placementDraftIssues(draft),
        publish: (actor) => content.publishPlacement(actor),
      },
      [ContentReviewKind.MOCK_TEST]: {
        find: (id) => repository.findMockTest(id),
        notFound: contentErrors.mockNotFound,
        working: (id) => repository.findMockDraft(id),
        save: (version) => repository.saveMockVersion(version),
        issues: (item, draft) => content.mockDraftIssues(draft, item),
        publish: (actor, id) => content.publishMockTest(actor, id),
      },
      ...(swTestService
        ? {
            [ContentReviewKind.SW_TEST]: {
              find: (id) => swTestService.repository.findTest(id),
              notFound: contentErrors.swTestNotFound,
              working: (id) => swTestService.repository.findDraft(id),
              save: (version) => swTestService.repository.saveVersion(version),
              issues: (item, draft) => swTestService.draftIssues(draft),
              publish: (actor, id) => swTestService.publish(actor, id),
            },
          }
        : {}),
      [ContentReviewKind.LISTENING_EXERCISE]: {
        find: (id) => listening.repository.findExercise(id),
        notFound: contentErrors.listeningExerciseNotFound,
        working: (id) => listening.repository.findDraft(id),
        save: (version) => listening.repository.saveVersion(version),
        issues: (item, draft) => listening.draftIssues(item, draft),
        publish: (actor, id) => listening.publish(actor, id),
      },
    };
  }

  async state(kind, id) {
    const spec = this.kinds[kind];
    if (!spec) throw contentErrors.noDraft();
    const item = await spec.find(id);
    if (!item) throw spec.notFound();
    const draft = await spec.working(id);
    if (!draft) throw contentErrors.noDraft();
    return { spec, item, draft };
  }

  view(kind, id, draft) {
    return {
      kind,
      id,
      versionNumber: draft.versionNumber,
      status: draft.status,
      reviewNote: draft.reviewNote || null,
      submittedAt: iso(draft.submittedAt),
      reviewedAt: iso(draft.reviewedAt),
    };
  }

  async submit(actor, { kind, id }) {
    this.content.assertTeacher(actor);
    const { spec, item, draft } = await this.state(kind, id);
    if (draft.status === LessonVersionStatus.PENDING_REVIEW) throw contentErrors.reviewState('PENDING_REVIEW', 'It is already waiting for review');
    const issues = await spec.issues(item, draft);
    if (issues.length) throw contentErrors.notPublishable(issues);
    const saved = await spec.save({ ...draft, status: LessonVersionStatus.PENDING_REVIEW, submittedBy: actor.id, submittedAt: this.now(), reviewNote: null });
    return this.view(kind, id, saved);
  }

  async withdraw(actor, { kind, id }) {
    this.content.assertTeacher(actor);
    const { spec, draft } = await this.state(kind, id);
    if (draft.status !== LessonVersionStatus.PENDING_REVIEW) throw contentErrors.reviewState('NOT_IN_REVIEW', 'It is not waiting for review');
    const saved = await spec.save({ ...draft, status: LessonVersionStatus.DRAFT });
    return this.view(kind, id, saved);
  }

  async approve(actor, { kind, id }) {
    this.content.assertManager(actor);
    const { spec } = await this.state(kind, id);
    await spec.publish(actor, id);
    return { kind, id, status: LessonVersionStatus.PUBLISHED };
  }

  async returnForChanges(actor, { kind, id, note }) {
    this.content.assertManager(actor);
    const { spec, draft } = await this.state(kind, id);
    if (draft.status !== LessonVersionStatus.PENDING_REVIEW) throw contentErrors.reviewState('NOT_IN_REVIEW', 'It is not waiting for review');
    const saved = await spec.save({ ...draft, status: LessonVersionStatus.RETURNED, reviewNote: note, reviewedBy: actor.id, reviewedAt: this.now() });
    return this.view(kind, id, saved);
  }

  async listQueue(actor) {
    this.content.assertStaff(actor);
    const [rows, describe] = await Promise.all([this.workingRows(), this.describer()]);
    const items = rows
      .map((row) => {
        const owner = describe(row);
        if (!owner) return null;
        return {
          kind: row.kind,
          ...owner,
          versionId: row.id,
          versionNumber: row.versionNumber,
          status: row.status,
          editedBy: row.editedBy || row.createdBy || null,
          submittedBy: row.submittedBy || null,
          submittedAt: iso(row.submittedAt),
          reviewedBy: row.reviewedBy || null,
          reviewedAt: iso(row.reviewedAt),
          reviewNote: row.reviewNote || null,
          updatedAt: iso(row.updatedAt),
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(b.submittedAt || b.updatedAt).localeCompare(String(a.submittedAt || a.updatedAt)));
    return { items };
  }

  async notices(actor) {
    const since = new Date(this.now().getTime() - REVIEW_NOTICE_DAYS * 86400000);
    const manager = this.content.isManager(actor);
    const [rows, describe, practice] = await Promise.all([
      this.activityRows(since),
      this.describer(),
      this.practiceRepository ? this.practiceRepository.listReviewActivity(since) : { versions: [], prompts: [] },
    ]);
    const notices = [];
    for (const row of rows) {
      const owner = describe(row);
      if (!owner) continue;
      const base = { kind: row.kind, id: owner.id, title: owner.title, context: owner.context };
      if (manager && row.status === LessonVersionStatus.PENDING_REVIEW && row.submittedAt)
        notices.push({ id: `review-pending:${row.id}:${ms(row.submittedAt)}`, kind: 'REVIEW_PENDING', data: { ...base, byId: row.submittedBy || null }, createdAt: iso(row.submittedAt) });
      if (!manager && row.submittedBy === actor.id && row.reviewedAt && ms(row.reviewedAt) > since.getTime()) {
        const outcome = row.status === LessonVersionStatus.PUBLISHED ? 'approved' : row.reviewNote ? 'returned' : null;
        if (outcome) notices.push({ id: `review-done:${row.id}:${ms(row.reviewedAt)}`, kind: 'REVIEW_DONE', data: { ...base, outcome, note: outcome === 'returned' ? row.reviewNote : null }, createdAt: iso(row.reviewedAt) });
      }
    }
    const prompts = new Map(practice.prompts.map((prompt) => [prompt.id, prompt]));
    for (const version of practice.versions) {
      const prompt = prompts.get(version.promptId);
      if (!prompt) continue;
      const base = { kind: 'prompt', promptKind: prompt.kind, id: prompt.id, title: version.content?.title || '', context: '' };
      if (manager && version.status === PracticePromptStatus.PENDING_REVIEW && version.submittedAt)
        notices.push({ id: `review-pending:${version.id}:${ms(version.submittedAt)}`, kind: 'REVIEW_PENDING', data: { ...base, byId: prompt.authorId }, createdAt: iso(version.submittedAt) });
      if (!manager && prompt.authorId === actor.id && version.reviewedAt && ms(version.reviewedAt) > since.getTime()) {
        const outcome = APPROVED_PROMPT.has(version.status) ? 'approved' : version.reviewNote ? 'returned' : null;
        if (outcome) notices.push({ id: `review-done:${version.id}:${ms(version.reviewedAt)}`, kind: 'REVIEW_DONE', data: { ...base, outcome, note: outcome === 'returned' ? version.reviewNote : null }, createdAt: iso(version.reviewedAt) });
      }
    }
    return notices;
  }

  async workingRows() {
    const [rows, swRows] = await Promise.all([this.content.repository.listWorkingVersions(), this.swTestService ? this.swTestService.repository.listWorkingVersions() : []]);
    return [...rows, ...swRows];
  }

  async activityRows(since) {
    const [rows, swRows] = await Promise.all([this.content.repository.listReviewActivity(since), this.swTestService ? this.swTestService.repository.listReviewActivity(since) : []]);
    return [...rows, ...swRows];
  }

  async describer() {
    const repository = this.content.repository;
    const [units, lessons, mockTests, exercises, placement, swTests] = await Promise.all([
      repository.listUnits(),
      repository.listLessons(),
      repository.listMockTests(),
      this.listening.repository.listExercises(),
      repository.findPublishedPlacement(),
      this.swTestService ? this.swTestService.repository.listTests() : [],
    ]);
    const swTestsById = new Map(swTests.map((row) => [row.id, row]));
    const byId = (list) => new Map(list.map((row) => [row.id, row]));
    const unitsById = byId(units);
    const lessonsById = byId(lessons);
    const mocksById = byId(mockTests);
    const exercisesById = byId(exercises);
    const describe = (row) => {
      if (row.kind === ContentReviewKind.LESSON) {
        const lesson = lessonsById.get(row.ownerId);
        return lesson && { id: lesson.id, title: lesson.title, context: unitsById.get(lesson.unitId)?.title || '', live: Boolean(lesson.publishedVersionId) };
      }
      if (row.kind === ContentReviewKind.UNIT_REVIEW) {
        const unit = unitsById.get(row.ownerId);
        return unit && { id: unit.id, title: unit.title, context: '', live: Boolean(unit.reviewVersionId) };
      }
      if (row.kind === ContentReviewKind.PLACEMENT) return { id: PLACEMENT_REVIEW_ID, title: '', context: '', live: Boolean(placement) };
      if (row.kind === ContentReviewKind.MOCK_TEST) {
        const mockTest = mocksById.get(row.ownerId);
        return mockTest && { id: mockTest.id, title: mockTest.title, context: '', live: Boolean(mockTest.publishedVersionId) };
      }
      if (row.kind === ContentReviewKind.SW_TEST) {
        const swTest = swTestsById.get(row.ownerId);
        return swTest && { id: swTest.id, title: swTest.title, context: '', live: Boolean(swTest.publishedVersionId) };
      }
      const exercise = exercisesById.get(row.ownerId);
      return exercise && { id: exercise.id, title: exercise.title, context: '', live: Boolean(exercise.publishedVersionId) };
    };
    return describe;
  }
}
