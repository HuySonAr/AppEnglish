import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentVersionKind } from '@appenglish/content-contracts';
import { ContentService } from '../src/content/content.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { ContentVersionService } from '../src/versions/version.service.js';
import { lessonContentSchema, mockContentSchema, unitReviewContentSchema } from '../src/content/content.schemas.js';
import { listeningContentSchema } from '../src/listening/listening.schemas.js';
import { createMemoryRepository, manager, publishableContent, student, submitted, teacher, toeicExamTypeId, toeicTopicId } from './memory-repository.js';
import { publishableReview } from './review-helpers.js';

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
  const versions = new ContentVersionService(repository, content, listening);
  const upload = async (fileName, kind = 'audio') =>
    (await content.uploadMedia(teacher, { kind, fileName, mimeType: kind === 'audio' ? 'audio/mpeg' : 'image/png', data: Buffer.from([1, 2, 3]) })).media.id;
  return { repository, content, listening, versions, upload };
}

test('a lesson taken down keeps its content as the draft, and its versions can be read and restored', async () => {
  const h = await harness();
  const audioId = await h.upload('a.mp3');
  const imageId = await h.upload('i.png', 'image');
  const { unit } = await h.content.createUnit(teacher, { title: 'Unit', description: '' });
  const { lesson } = await h.content.createLesson(teacher, unit.id, { title: 'Contracts' });
  const first = lessonContentSchema.parse(publishableContent({ audioId, imageId }));
  await h.content.saveLessonDraft(teacher, lesson.id, first);
  await submitted(h.content, h.listening, 'lesson', lesson.id);
  await h.content.publishLesson(manager, lesson.id);
  const second = structuredClone(first);
  second.vocabulary[0].word = 'contract';
  await h.content.saveLessonDraft(teacher, lesson.id, second);
  await submitted(h.content, h.listening, 'lesson', lesson.id);
  await h.content.publishLesson(manager, lesson.id);

  const kind = ContentVersionKind.LESSON;
  await assert.rejects(() => h.versions.listVersions(student, { kind, id: lesson.id }), { code: 26 });
  await assert.rejects(() => h.versions.listVersions(teacher, { kind, id: unit.id }), { code: 40 });
  const listed = await h.versions.listVersions(teacher, { kind, id: lesson.id });
  assert.deepEqual(listed.versions.map((version) => [version.versionNumber, version.status, version.current]), [[2, 'PUBLISHED', true], [1, 'PUBLISHED', false]]);
  assert.equal('content' in listed.versions[0], false);
  const v1 = listed.versions[1];
  const read = await h.versions.getVersion(teacher, { kind, id: lesson.id, versionId: v1.id });
  assert.equal(read.version.content.vocabulary[0].word, 'ticket');
  const { lesson: other } = await h.content.createLesson(teacher, unit.id, { title: 'Other' });
  await assert.rejects(() => h.versions.getVersion(teacher, { kind, id: other.id, versionId: v1.id }), { code: 40 });

  const hidden = await h.content.unpublishLesson(manager, lesson.id);
  assert.equal(hidden.published, null);
  assert.equal(hidden.draft.versionNumber, 3);
  assert.equal(hidden.draft.content.vocabulary[0].word, 'contract');
  assert.equal((await h.content.unpublishLesson(manager, lesson.id)).draft.versionNumber, 3);
  assert.deepEqual((await h.versions.listVersions(teacher, { kind, id: lesson.id })).versions.map((version) => `${version.versionNumber}${version.status[0]}${version.current ? '*' : ''}`), ['3D', '2P', '1P']);

  const restored = await h.versions.restoreVersion(teacher, { kind, id: lesson.id, versionId: v1.id });
  assert.equal(restored.restoredFrom.versionNumber, 1);
  assert.equal(restored.draft.versionNumber, 3);
  assert.equal(restored.draft.content.vocabulary[0].word, 'ticket');
  const draftId = (await h.versions.listVersions(teacher, { kind, id: lesson.id })).versions[0].id;
  await assert.rejects(() => h.versions.restoreVersion(teacher, { kind, id: lesson.id, versionId: draftId }), { code: 41 });
  await submitted(h.content, h.listening, 'lesson', lesson.id);
  const published = await h.content.publishLesson(manager, lesson.id);
  assert.equal(published.published.versionNumber, 3);
  assert.equal(h.repository.tables.versions.filter((version) => version.lessonId === lesson.id).length, 3);

  await assert.rejects(() => h.versions.discardDraft(teacher, { kind, id: lesson.id }), { code: 41 });
  const extraAudio = await h.upload('extra.mp3');
  const fourth = structuredClone(first);
  fourth.vocabulary[0].audioUkMediaId = extraAudio;
  await h.content.saveLessonDraft(teacher, lesson.id, fourth);
  assert.equal((await h.repository.findMediaByIds([extraAudio])).length, 1);
  const discarded = await h.versions.discardDraft(teacher, { kind, id: lesson.id });
  assert.deepEqual(discarded, { discarded: discarded.discarded, removedMedia: 1 });
  assert.equal(discarded.discarded.versionNumber, 4);
  assert.equal((await h.repository.findMediaByIds([extraAudio])).length, 0, 'the file only the draft used is gone');
  assert.equal((await h.repository.findMediaByIds([audioId])).length, 1, 'files the published versions use stay');
  assert.deepEqual((await h.versions.listVersions(teacher, { kind, id: lesson.id })).versions.map((version) => version.versionNumber), [3, 2, 1]);
  assert.equal((await h.content.getLesson(teacher, lesson.id)).draft, null);

  const current = (await h.versions.listVersions(teacher, { kind, id: lesson.id })).versions.find((version) => version.current);
  await assert.rejects(() => h.versions.deleteVersion(manager, { kind, id: lesson.id, versionId: current.id }), (error) => error.code === 41 && error.data.reason === 'CURRENT');
  const oldAudio = await h.upload('old-only.mp3');
  const fifth = structuredClone(first);
  fifth.vocabulary[0].audioUkMediaId = oldAudio;
  await h.content.saveLessonDraft(teacher, lesson.id, fifth);
  await submitted(h.content, h.listening, 'lesson', lesson.id);
  await h.content.publishLesson(manager, lesson.id);
  const old = (await h.versions.listVersions(teacher, { kind, id: lesson.id })).versions.find((version) => version.versionNumber === 3);
  const removed = await h.versions.deleteVersion(manager, { kind, id: lesson.id, versionId: old.id });
  assert.deepEqual(removed, { deleted: { versionId: old.id, versionNumber: 3 }, removedMedia: 0 }, 'version 3 shares every file with 1 and 2');
  await h.content.unpublishLesson(manager, lesson.id);
  const taken = (await h.versions.listVersions(teacher, { kind, id: lesson.id })).versions.find((version) => version.versionNumber === 4);
  assert.equal((await h.versions.discardDraft(teacher, { kind, id: lesson.id })).removedMedia, 0, 'version 4 still uses the file');
  const removedOld = await h.versions.deleteVersion(manager, { kind, id: lesson.id, versionId: taken.id });
  assert.equal(removedOld.removedMedia, 1, 'the file only version 4 used is gone');
  assert.equal((await h.repository.findMediaByIds([oldAudio])).length, 0);
  assert.deepEqual((await h.versions.listVersions(teacher, { kind, id: lesson.id })).versions.map((version) => version.versionNumber), [2, 1]);
  await assert.rejects(() => h.versions.deleteVersion(manager, { kind, id: lesson.id, versionId: taken.id }), { code: 40 });
});

test('mock tests, listening exercises and unit reviews keep their content when taken down and list their versions', async () => {
  const h = await harness();
  const { mockTest } = await h.content.createMockTest(teacher, { title: 'Level 1', level: 1, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId });
  await h.content.saveMockTestDraft(teacher, mockTest.id, mockContentSchema.parse({ test: { part5: { questions: [{ prompt: 'x' }] } } }));
  const mockVersions = await h.versions.listVersions(teacher, { kind: ContentVersionKind.MOCK_TEST, id: mockTest.id });
  assert.deepEqual(mockVersions.versions.map((version) => [version.versionNumber, version.status]), [[1, 'DRAFT']]);

  const audioId = await h.upload('talk.mp3');
  const { exercise } = await h.listening.createExercise(teacher, { title: 'At the airport', level: 'A2', kind: 'part1', topicId: toeicTopicId });
  await h.listening.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: [{ text: 'One.' }, { text: 'Two.' }, { text: 'Three.' }, { text: 'Four.' }] }));
  await submitted(h.content, h.listening, 'listeningExercise', exercise.id);
  await h.listening.publish(manager, exercise.id);
  const hiddenExercise = await h.listening.unpublish(manager, exercise.id);
  assert.equal(hiddenExercise.draft.versionNumber, 2);
  assert.equal(hiddenExercise.draft.content.segments.length, 4);
  const exerciseVersions = await h.versions.listVersions(teacher, { kind: ContentVersionKind.LISTENING_EXERCISE, id: exercise.id });
  assert.deepEqual(exerciseVersions.versions.map((version) => `${version.versionNumber}${version.status[0]}`), ['2D', '1P']);
  const restoredExercise = await h.versions.restoreVersion(teacher, { kind: ContentVersionKind.LISTENING_EXERCISE, id: exercise.id, versionId: exerciseVersions.versions[1].id });
  assert.equal(restoredExercise.draft.content.segments[0].text, 'One.');

  const { unit } = await h.content.createUnit(teacher, { title: 'General Business', description: '' });
  await h.content.saveUnitReviewDraft(teacher, unit.id, unitReviewContentSchema.parse(publishableReview()));
  await submitted(h.content, h.listening, 'unitReview', unit.id);
  await h.content.publishUnitReview(manager, unit.id);
  const hiddenReview = await h.content.unpublishUnitReview(manager, unit.id);
  assert.equal(hiddenReview.draft.versionNumber, 2);
  assert.equal(hiddenReview.draft.content.test.part5.questions.length, 10);
  const reviewVersions = await h.versions.listVersions(teacher, { kind: ContentVersionKind.UNIT_REVIEW, id: unit.id });
  assert.deepEqual(reviewVersions.versions.map((version) => `${version.versionNumber}${version.status[0]}`), ['2D', '1P']);
  const readReview = await h.versions.getVersion(teacher, { kind: ContentVersionKind.UNIT_REVIEW, id: unit.id, versionId: reviewVersions.versions[1].id });
  assert.equal(readReview.version.content.test.part6.groups.length, 3);
});
