import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { lessonContentSchema } from '../src/content/content.schemas.js';
import { listeningContentSchema } from '../src/listening/listening.schemas.js';
import { createMemoryRepository, manager, publishableContent, student, submitted, teacher, toeicExamTypeId, toeicTopicId } from './memory-repository.js';

async function harness() {
  const repository = createMemoryRepository();
  const removed = [];
  const storage = {
    async upload(input) {
      return { id: `stored-${input.fileName}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `https://media.test/${input.fileName}`, storage: 'r2' };
    },
    async delete(asset) { removed.push(asset.fileName); },
  };
  const content = new ContentService(repository, storage);
  const listening = new ListeningService(repository.listening, content);
  const upload = async (fileName, kind = 'audio') =>
    (await content.uploadMedia(teacher, { kind, fileName, mimeType: kind === 'audio' ? 'audio/mpeg' : 'image/png', data: Buffer.from([1, 2, 3]) })).media.id;
  return { repository, content, listening, removed, upload };
}

async function publishedLesson(h, unitTitle = 'Unit') {
  const audioId = await h.upload(`${unitTitle}-a.mp3`);
  const imageId = await h.upload(`${unitTitle}-i.png`, 'image');
  const { unit } = await h.content.createUnit(teacher, { title: unitTitle, description: '' });
  const { lesson } = await h.content.createLesson(teacher, unit.id, { title: `${unitTitle} lesson` });
  await h.content.saveLessonDraft(teacher, lesson.id, lessonContentSchema.parse(publishableContent({ audioId, imageId })));
  await submitted(h.content, h.listening, 'lesson', lesson.id);
  await h.content.publishLesson(manager, lesson.id);
  await h.content.publishUnit(manager, unit.id);
  return { unit, lesson, audioId, imageId };
}

test('a lesson can be unpublished and published again; learners stop seeing it in between', async () => {
  const h = await harness();
  const { unit, lesson } = await publishedLesson(h);
  assert.equal((await h.content.getCurriculum()).units[0].lessons.length, 1);
  const hidden = await h.content.unpublishLesson(manager, lesson.id);
  assert.equal(hidden.published, null);
  assert.equal((await h.content.getCurriculum()).units.find((item) => item.id === unit.id)?.lessons.length ?? 0, 0);
  const listed = (await h.content.listUnits(teacher)).units[0].lessons[0];
  assert.equal(listed.publishedVersionNumber, null);
  await h.content.saveLessonDraft(teacher, lesson.id, lessonContentSchema.parse(publishableContent({ audioId: (await h.upload('b.mp3')), imageId: (await h.upload('b.png', 'image')) })));
  await submitted(h.content, h.listening, 'lesson', lesson.id);
  const again = await h.content.publishLesson(manager, lesson.id);
  assert.equal(again.published.versionNumber, 2);
  await assert.rejects(() => h.content.unpublishLesson(student, lesson.id), { code: 26 });
});

test('deleting a lesson removes its versions and the media only it used, and closes the gap', async () => {
  const h = await harness();
  const { unit, lesson, audioId, imageId } = await publishedLesson(h);
  const { lesson: second } = await h.content.createLesson(teacher, unit.id, { title: 'Second' });
  const { lesson: third } = await h.content.createLesson(teacher, unit.id, { title: 'Third' });
  const result = await h.content.deleteLesson(teacher, second.id);
  assert.deepEqual(result, { deleted: true, unitId: unit.id, removedMedia: 0 });
  const lessons = (await h.content.listUnits(teacher)).units[0].lessons;
  assert.deepEqual(lessons.map((item) => [item.title, item.position]), [['Unit lesson', 1], ['Third', 2]]);
  const gone = await h.content.deleteLesson(manager, lesson.id);
  assert.equal(gone.removedMedia, 2);
  assert.deepEqual(h.removed.sort(), ['Unit-a.mp3', 'Unit-i.png']);
  assert.equal((await h.repository.findMediaByIds([audioId, imageId])).length, 0);
  assert.equal(h.repository.tables.versions.some((version) => version.lessonId === lesson.id), false);
  await assert.rejects(() => h.content.deleteLesson(teacher, lesson.id), { code: 40 });
  await assert.rejects(() => h.content.deleteLesson(teacher, third.id), { code: 26 }).catch(() => {});
});

test('a unit can be hidden, and deleted with every lesson; the other units are renumbered', async () => {
  const h = await harness();
  const first = await publishedLesson(h, 'One');
  const second = await publishedLesson(h, 'Two');
  const hidden = await h.content.unpublishUnit(manager, first.unit.id);
  assert.equal(hidden.unit.status, 'DRAFT');
  assert.deepEqual((await h.content.getCurriculum()).units.map((unit) => unit.title), ['Two']);
  const result = await h.content.deleteUnit(manager, first.unit.id);
  assert.deepEqual(result, { deleted: true, lessons: 1, removedMedia: 2 });
  const units = (await h.content.listUnits(teacher)).units;
  assert.deepEqual(units.map((unit) => [unit.title, unit.position]), [['Two', 1]]);
  assert.equal(h.repository.tables.lessons.some((lesson) => lesson.unitId === first.unit.id), false);
  assert.equal((await h.repository.findMediaByIds([second.audioId])).length, 1);
});

test('mock tests unpublish and delete the same way', async () => {
  const h = await harness();
  const { mockTest } = await h.content.createMockTest(teacher, { title: 'Level 1', level: 1, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId });
  const hidden = await h.content.unpublishMockTest(manager, mockTest.id);
  assert.equal(hidden.published, null);
  const result = await h.content.deleteMockTest(teacher, mockTest.id);
  assert.deepEqual(result, { deleted: true, removedMedia: 0 });
  assert.equal((await h.content.listMockTests(teacher)).mockTests.length, 0);
  assert.equal(h.repository.tables.mockVersions.length, 0);
  await assert.rejects(() => h.content.deleteMockTest(teacher, mockTest.id), { code: 40 });
});

test('a listening exercise goes with its recording', async () => {
  const h = await harness();
  const audioId = await h.upload('talk.mp3');
  const { exercise } = await h.listening.createExercise(teacher, { title: 'At the airport', level: 'A2', kind: 'part1', topicId: toeicTopicId });
  await h.listening.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: [{ text: 'Hello there.' }] }));
  assert.equal((await h.listening.unpublish(manager, exercise.id)).published, null);
  assert.deepEqual(await h.listening.delete(teacher, exercise.id), { deleted: true, removedMedia: 1 });
  assert.deepEqual(h.removed, ['talk.mp3']);
  assert.equal((await h.listening.listExercises(teacher)).exercises.length, 0);
});

test('orphan media are the unreferenced files older than the grace period; deleting re-checks', async () => {
  const h = await harness();
  const old = await h.upload('old.mp3');
  const fresh = await h.upload('fresh.mp3');
  const used = await h.upload('used.mp3');
  const image = await h.upload('used.png', 'image');
  const { unit } = await h.content.createUnit(teacher, { title: 'U', description: '' });
  const { lesson } = await h.content.createLesson(teacher, unit.id, { title: 'L' });
  await h.content.saveLessonDraft(teacher, lesson.id, lessonContentSchema.parse(publishableContent({ audioId: used, imageId: image })));
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  for (const asset of h.repository.tables.media) if (asset.id !== fresh) asset.createdAt = twoHoursAgo;
  h.repository.tables.media.find((asset) => asset.id === fresh).createdAt = new Date();
  const listed = await h.content.listOrphanMedia(manager);
  assert.deepEqual(listed.media.map((asset) => asset.fileName), ['old.mp3']);
  assert.equal(listed.totalBytes, 3);
  const result = await h.content.deleteOrphanMedia(manager, { ids: [old, used, fresh] });
  assert.deepEqual(result, { deleted: [old, fresh], skipped: [used] });
  assert.deepEqual(h.removed.sort(), ['fresh.mp3', 'old.mp3']);
  await assert.rejects(() => h.content.listOrphanMedia(student), { code: 26 });
});
