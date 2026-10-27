import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { ContentReviewService } from '../src/review/review.service.js';
import { ContentVersionService } from '../src/versions/version.service.js';
import { lessonContentSchema, mockContentSchema, placementContentSchema, unitReviewContentSchema } from '../src/content/content.schemas.js';
import { listeningContentSchema } from '../src/listening/listening.schemas.js';
import { createMemoryRepository, manager, otherTeacher, publishableContent, student, teacher, toeicExamTypeId, toeicTopicId } from './memory-repository.js';
import { publishableMock, publishableReview } from './review-helpers.js';

async function harness() {
  const repository = createMemoryRepository();
  const storage = {
    async upload(input) {
      return { id: `stored-${input.fileName}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `https://media.test/${input.fileName}`, storage: 'r2' };
    },
    async delete() {},
  };
  const content = new ContentService(repository, storage);
  const listening = new ListeningService(repository.listening, content);
  const review = new ContentReviewService(content, listening);
  const versions = new ContentVersionService(repository, content, listening);
  const upload = async (fileName, kind = 'audio') =>
    (await content.uploadMedia(teacher, { kind, fileName, mimeType: kind === 'audio' ? 'audio/mpeg' : 'image/png', data: Buffer.from([1]) })).media.id;
  const audioId = await upload('a.mp3');
  const imageId = await upload('i.png', 'image');
  const lessonContent = () => lessonContentSchema.parse(publishableContent({ audioId, imageId }));
  const { unit } = await content.createUnit(teacher, { title: 'Travel', description: '' });
  const newLesson = async (title = 'Tickets') => (await content.createLesson(teacher, unit.id, { title })).lesson;
  return { repository, content, listening, review, versions, upload, audioId, imageId, lessonContent, unit, newLesson };
}

const lessonKind = (id) => ({ kind: 'lesson', id });
const fourLines = () => listeningContentSchema.parse({ segments: ['One.', 'Two.', 'Three.', 'Four.'].map((text) => ({ text })) });

test('submitting checks the publishing rules and locks the draft until it is withdrawn', async () => {
  const h = await harness();
  const lesson = await h.newLesson();
  await assert.rejects(() => h.review.submit(teacher, lessonKind(lesson.id)), (error) => {
    assert.equal(error.code, 42);
    assert.ok(error.data.issues.some((issue) => issue.path === 'fillIn.passage'));
    return true;
  });
  assert.equal((await h.content.getLesson(teacher, lesson.id)).draft.status, 'DRAFT');
  await assert.rejects(() => h.review.submit(manager, lessonKind(lesson.id)), { code: 26 });
  await assert.rejects(() => h.review.submit(teacher, lessonKind('00000000-0000-4000-8000-000000000000')), { code: 40 });

  await h.content.saveLessonDraft(teacher, lesson.id, h.lessonContent());
  const sent = await h.review.submit(teacher, lessonKind(lesson.id));
  assert.deepEqual([sent.kind, sent.id, sent.versionNumber, sent.status, sent.reviewNote], ['lesson', lesson.id, 1, 'PENDING_REVIEW', null]);
  assert.ok(sent.submittedAt);
  await assert.rejects(() => h.review.submit(teacher, lessonKind(lesson.id)), { code: 41, data: { reason: 'PENDING_REVIEW' } });
  await assert.rejects(() => h.content.saveLessonDraft(teacher, lesson.id, h.lessonContent()), { code: 41, data: { reason: 'PENDING_REVIEW' } });
  await assert.rejects(() => h.versions.discardDraft(teacher, { kind: 'lesson', id: lesson.id }), { code: 41, data: { reason: 'PENDING_REVIEW' } });
  const listed = (await h.content.listUnits(manager)).units[0].lessons[0];
  assert.deepEqual([listed.hasDraft, listed.draftStatus], [true, 'PENDING_REVIEW']);

  await assert.rejects(() => h.review.withdraw(manager, lessonKind(lesson.id)), { code: 26 });
  assert.equal((await h.review.withdraw(teacher, lessonKind(lesson.id))).status, 'DRAFT');
  await assert.rejects(() => h.review.withdraw(teacher, lessonKind(lesson.id)), { code: 41, data: { reason: 'NOT_IN_REVIEW' } });
  await assert.rejects(() => h.content.publishLesson(manager, lesson.id), { code: 41, data: { reason: 'NOT_IN_REVIEW' } });
  assert.equal((await h.content.saveLessonDraft(teacher, lesson.id, h.lessonContent())).draft.status, 'DRAFT');
});

test('a Content Manager returns a draft with a note that stays visible while the teacher fixes it', async () => {
  const h = await harness();
  const lesson = await h.newLesson();
  await h.content.saveLessonDraft(teacher, lesson.id, h.lessonContent());
  await assert.rejects(() => h.review.returnForChanges(manager, { ...lessonKind(lesson.id), note: 'Too early.' }), { code: 41, data: { reason: 'NOT_IN_REVIEW' } });
  await h.review.submit(teacher, lessonKind(lesson.id));
  await assert.rejects(() => h.review.returnForChanges(teacher, { ...lessonKind(lesson.id), note: 'Mine.' }), { code: 26 });

  const returned = await h.review.returnForChanges(manager, { ...lessonKind(lesson.id), note: 'Fix the part 5 explanations.' });
  assert.deepEqual([returned.status, returned.reviewNote], ['RETURNED', 'Fix the part 5 explanations.']);
  assert.ok(returned.reviewedAt);
  await assert.rejects(() => h.content.publishLesson(manager, lesson.id), { code: 41, data: { reason: 'NOT_IN_REVIEW' } });
  let view = await h.content.getLesson(manager, lesson.id);
  assert.deepEqual([view.draft.status, view.draft.reviewNote], ['RETURNED', 'Fix the part 5 explanations.']);

  const fixed = await h.content.saveLessonDraft(teacher, lesson.id, h.lessonContent());
  assert.deepEqual([fixed.draft.status, fixed.draft.reviewNote, fixed.draft.versionNumber], ['DRAFT', 'Fix the part 5 explanations.', 1]);
  view = await h.content.getLesson(manager, lesson.id);
  assert.deepEqual([view.draft.status, view.draft.reviewNote], ['DRAFT', 'Fix the part 5 explanations.']);
  assert.equal((await h.review.submit(teacher, lessonKind(lesson.id))).reviewNote, null);
});

test('approving publishes the version and records the Content Manager', async () => {
  const h = await harness();
  const lesson = await h.newLesson();
  await h.content.saveLessonDraft(teacher, lesson.id, h.lessonContent());
  await assert.rejects(() => h.review.approve(manager, lessonKind(lesson.id)), { code: 41, data: { reason: 'NOT_IN_REVIEW' } });
  await h.review.submit(teacher, lessonKind(lesson.id));
  await assert.rejects(() => h.review.approve(teacher, lessonKind(lesson.id)), { code: 26 });
  await assert.rejects(() => h.content.publishLesson(teacher, lesson.id), { code: 26 });

  assert.deepEqual(await h.review.approve(manager, lessonKind(lesson.id)), { kind: 'lesson', id: lesson.id, status: 'PUBLISHED' });
  const view = await h.content.getLesson(teacher, lesson.id);
  assert.equal(view.draft, null);
  assert.equal(view.published.versionNumber, 1);
  const stored = await h.repository.findVersion(view.published.versionId);
  assert.deepEqual([stored.status, stored.publishedBy, stored.reviewedBy, stored.submittedBy, stored.createdBy], ['PUBLISHED', manager.id, manager.id, teacher.id, teacher.id]);
  assert.ok(stored.publishedAt && stored.reviewedAt);
  await assert.rejects(() => h.review.approve(manager, lessonKind(lesson.id)), { code: 41 });
});

test('teachers cannot publish, unpublish or reorder, and Content Managers cannot write', async () => {
  const h = await harness();
  const lesson = await h.newLesson();
  const { mockTest } = await h.content.createMockTest(teacher, { title: 'Mock', level: 1, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId });
  const { exercise } = await h.listening.createExercise(teacher, { title: 'Photo', level: 'A2', kind: 'part1', topicId: toeicTopicId });
  for (const call of [
    () => h.content.publishUnit(teacher, h.unit.id),
    () => h.content.unpublishUnit(teacher, h.unit.id),
    () => h.content.unpublishLesson(teacher, lesson.id),
    () => h.content.publishUnitReview(teacher, h.unit.id),
    () => h.content.unpublishUnitReview(teacher, h.unit.id),
    () => h.content.publishPlacement(teacher),
    () => h.content.publishMockTest(teacher, mockTest.id),
    () => h.content.unpublishMockTest(teacher, mockTest.id),
    () => h.listening.publish(teacher, exercise.id),
    () => h.listening.unpublish(teacher, exercise.id),
    () => h.content.updateUnit(teacher, h.unit.id, { position: 1 }),
    () => h.content.updateLesson(teacher, lesson.id, { position: 1 }),
    () => h.content.deleteOrphanMedia(teacher, { ids: [] }),
    () => h.review.returnForChanges(teacher, { ...lessonKind(lesson.id), note: 'x' }),
  ]) await assert.rejects(call, { code: 26 });
  for (const call of [
    () => h.content.createUnit(manager, { title: 'U', description: '' }),
    () => h.content.updateUnit(manager, h.unit.id, { description: 'x' }),
    () => h.content.createLesson(manager, h.unit.id, { title: 'L' }),
    () => h.content.saveLessonDraft(manager, lesson.id, h.lessonContent()),
    () => h.content.saveUnitReviewDraft(manager, h.unit.id, unitReviewContentSchema.parse({})),
    () => h.content.savePlacementDraft(manager, placementContentSchema.parse({})),
    () => h.content.createMockTest(manager, { title: 'M', level: 1, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId }),
    () => h.content.saveMockTestDraft(manager, mockTest.id, mockContentSchema.parse({})),
    () => h.listening.createExercise(manager, { title: 'X', level: 'A2', kind: 'part1', topicId: toeicTopicId }),
    () => h.listening.saveDraft(manager, exercise.id, fourLines()),
    () => h.listening.requestAutoTime(manager, exercise.id),
    () => h.versions.discardDraft(manager, { kind: 'lesson', id: lesson.id }),
    () => h.review.submit(manager, lessonKind(lesson.id)),
  ]) await assert.rejects(call, { code: 26 });
  for (const call of [() => h.review.listQueue(student), () => h.content.getLesson(student, lesson.id), () => h.content.deleteLesson(student, lesson.id)])
    await assert.rejects(call, (error) => error.code === 26 || error.code === 40);
});

test('a teacher deletes only what was never published; a Content Manager deletes anything', async () => {
  const h = await harness();
  const fresh = await h.newLesson('Fresh');
  assert.equal((await h.content.deleteLesson(teacher, fresh.id)).deleted, true);
  const live = await h.newLesson('Live');
  await h.content.saveLessonDraft(teacher, live.id, h.lessonContent());
  await h.review.submit(teacher, lessonKind(live.id));
  await h.review.approve(manager, lessonKind(live.id));
  await h.content.unpublishLesson(manager, live.id);
  await assert.rejects(() => h.content.deleteLesson(teacher, live.id), { code: 41, data: { reason: 'PUBLISHED_BEFORE' } });
  await assert.rejects(() => h.content.deleteUnit(teacher, h.unit.id), { code: 41, data: { reason: 'PUBLISHED_BEFORE' } });
  assert.equal((await h.content.deleteLesson(manager, live.id)).deleted, true);

  const audioId = await h.upload('b.mp3');
  const imageId = await h.upload('b.png', 'image');
  const mock = async (title) => (await h.content.createMockTest(teacher, { title, level: 1, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId })).mockTest;
  const draftMock = await mock('Draft');
  assert.equal((await h.content.deleteMockTest(teacher, draftMock.id)).deleted, true);
  const liveMock = await mock('Live');
  await h.content.saveMockTestDraft(teacher, liveMock.id, mockContentSchema.parse(publishableMock({ audioId, imageId })));
  await h.review.submit(teacher, { kind: 'mockTest', id: liveMock.id });
  await h.review.approve(manager, { kind: 'mockTest', id: liveMock.id });
  await assert.rejects(() => h.content.deleteMockTest(teacher, liveMock.id), { code: 41, data: { reason: 'PUBLISHED_BEFORE' } });
  assert.equal((await h.content.deleteMockTest(manager, liveMock.id)).deleted, true);

  const exercise = async (title) => (await h.listening.createExercise(teacher, { title, level: 'A2', kind: 'part1', topicId: toeicTopicId })).exercise;
  const draftExercise = await exercise('Draft');
  assert.equal((await h.listening.delete(teacher, draftExercise.id)).deleted, true);
  const liveExercise = await exercise('Live');
  await h.listening.saveDraft(teacher, liveExercise.id, listeningContentSchema.parse({ ...fourLines(), audioMediaId: await h.upload('c.mp3') }));
  await h.review.submit(teacher, { kind: 'listeningExercise', id: liveExercise.id });
  await h.review.approve(manager, { kind: 'listeningExercise', id: liveExercise.id });
  await assert.rejects(() => h.listening.delete(teacher, liveExercise.id), { code: 41, data: { reason: 'PUBLISHED_BEFORE' } });
  assert.equal((await h.listening.delete(manager, liveExercise.id)).deleted, true);
  assert.equal((await h.content.deleteUnit(teacher, h.unit.id)).deleted, true);
});

test('the review queue lists the working drafts of every kind with their state', async () => {
  const h = await harness();
  const lesson = await h.newLesson();
  await h.content.saveLessonDraft(teacher, lesson.id, h.lessonContent());
  await h.review.submit(teacher, lessonKind(lesson.id));
  await h.content.saveUnitReviewDraft(teacher, h.unit.id, unitReviewContentSchema.parse(publishableReview()));
  await h.review.submit(teacher, { kind: 'unitReview', id: h.unit.id });
  await h.review.returnForChanges(manager, { kind: 'unitReview', id: h.unit.id, note: 'Shorter passages.' });
  await h.content.savePlacementDraft(teacher, placementContentSchema.parse({ test: publishableContent({ audioId: h.audioId, imageId: h.imageId }).test }));
  await assert.rejects(() => h.review.submit(teacher, { kind: 'placement', id: '00000000-0000-4000-8000-000000000000' }), { code: 41 });
  await h.review.submit(teacher, { kind: 'placement', id: 'main' });
  const { mockTest } = await h.content.createMockTest(teacher, { title: 'Mock 1', level: 1, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId });
  await h.listening.createExercise(teacher, { title: 'Photo', level: 'A2', kind: 'part1', topicId: toeicTopicId });

  const { items } = await h.review.listQueue(manager);
  assert.deepEqual((await h.review.listQueue(teacher)).items.length, items.length);
  const byKind = Object.fromEntries(items.map((item) => [item.kind, item]));
  assert.deepEqual(Object.keys(byKind).sort(), ['lesson', 'listeningExercise', 'mockTest', 'placement', 'unitReview']);
  assert.deepEqual([byKind.lesson.id, byKind.lesson.title, byKind.lesson.context, byKind.lesson.status, byKind.lesson.live, byKind.lesson.submittedBy], [lesson.id, 'Tickets', 'Travel', 'PENDING_REVIEW', false, teacher.id]);
  assert.deepEqual([byKind.unitReview.id, byKind.unitReview.title, byKind.unitReview.status, byKind.unitReview.reviewNote, byKind.unitReview.reviewedBy], [h.unit.id, 'Travel', 'RETURNED', 'Shorter passages.', manager.id]);
  assert.deepEqual([byKind.placement.id, byKind.placement.status, byKind.placement.versionNumber], ['main', 'PENDING_REVIEW', 1]);
  assert.deepEqual([byKind.mockTest.id, byKind.mockTest.title, byKind.mockTest.status, byKind.mockTest.editedBy, byKind.mockTest.submittedAt], [mockTest.id, 'Mock 1', 'DRAFT', teacher.id, null]);
  assert.equal(byKind.listeningExercise.title, 'Photo');
  assert.ok(byKind.lesson.versionId);

  await h.review.approve(manager, { kind: 'placement', id: 'main' });
  await h.review.approve(manager, lessonKind(lesson.id));
  const after = (await h.review.listQueue(manager)).items.map((item) => item.kind).sort();
  assert.deepEqual(after, ['listeningExercise', 'mockTest', 'unitReview']);
  assert.ok((await h.content.getPlacementPaper()).versionId);
});

test('another teacher can carry on a draft started by a colleague', async () => {
  const h = await harness();
  const lesson = await h.newLesson();
  assert.equal((await h.content.getLesson(manager, lesson.id)).draft.editedBy, teacher.id);
  const saved = await h.content.saveLessonDraft(otherTeacher, lesson.id, h.lessonContent());
  assert.equal(saved.draft.editedBy, otherTeacher.id);
  assert.equal(saved.draft.versionNumber, 1);
  const sent = await h.review.submit(otherTeacher, lessonKind(lesson.id));
  assert.equal(sent.status, 'PENDING_REVIEW');
  assert.equal((await h.review.withdraw(teacher, lessonKind(lesson.id))).status, 'DRAFT');
  const [item] = (await h.review.listQueue(manager)).items;
  assert.deepEqual([item.editedBy, item.submittedBy], [otherTeacher.id, otherTeacher.id]);
});

test('the bell tells a Content Manager what waits and a teacher what came back (D191)', async () => {
  const h = await harness();
  h.listening.useReviewNotices(h.review);
  const sent = await h.newLesson('Sent');
  await h.content.saveLessonDraft(teacher, sent.id, h.lessonContent());
  await h.review.submit(teacher, lessonKind(sent.id));
  const back = await h.newLesson('Back');
  await h.content.saveLessonDraft(otherTeacher, back.id, h.lessonContent());
  await h.review.submit(otherTeacher, lessonKind(back.id));

  const waiting = await h.listening.listNotifications(manager);
  assert.deepEqual(waiting.notifications.map((item) => [item.kind, item.data.title, item.data.byId]).sort(), [['REVIEW_PENDING', 'Back', otherTeacher.id], ['REVIEW_PENDING', 'Sent', teacher.id]]);
  assert.equal(waiting.unread, 2);
  assert.deepEqual(await h.listening.markNotificationsRead(manager, { ids: [waiting.notifications[0].id] }), { unread: 1 });

  await h.content.publishLesson(manager, sent.id);
  await h.review.returnForChanges(manager, { ...lessonKind(back.id), note: 'Fix part 5.' });
  assert.equal((await h.listening.listNotifications(manager)).notifications.length, 0);

  const mine = await h.listening.listNotifications(teacher);
  assert.deepEqual(mine.notifications.map((item) => [item.kind, item.data.title, item.data.outcome]), [['REVIEW_DONE', 'Sent', 'approved']]);
  const theirs = await h.listening.listNotifications(otherTeacher);
  assert.deepEqual(theirs.notifications.map((item) => [item.data.title, item.data.outcome, item.data.note]), [['Back', 'returned', 'Fix part 5.']]);
  assert.deepEqual(await h.listening.markNotificationsRead(otherTeacher, {}), { unread: 0 });
  await assert.rejects(() => h.listening.listNotifications(student), { code: 26 });
});

