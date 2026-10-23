import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { placementContentSchema } from '../src/content/content.schemas.js';
import { admin, createMemoryRepository, manager, publishableContent, student } from './memory-repository.js';

async function harness() {
  const repository = createMemoryRepository();
  const uploads = [];
  const removed = [];
  const storage = {
    async upload(input) {
      uploads.push(input);
      return { id: `stored-${uploads.length}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `https://media.test/${input.fileName}`, storage: 'imagekit' };
    },
    async delete(asset) { removed.push(asset.fileName); },
  };
  const service = new ContentService(repository, storage);
  const upload = async (kind, fileName, mimeType) =>
    (await service.uploadMedia(manager, { kind, fileName, mimeType, data: Buffer.from([1]), section: 'placement' })).media.id;
  const audioId = await upload('audio', 'a.mp3', 'audio/mpeg');
  const imageId = await upload('image', 'p.png', 'image/png');
  const content = (change = (value) => value) =>
    placementContentSchema.parse(change({ test: publishableContent({ audioId, imageId }).test }));
  return { service, repository, uploads, removed, upload, audioId, imageId, content };
}

test('only a Content Manager edits the placement test', async () => {
  const { service, content } = await harness();
  for (const actor of [student, admin]) {
    await assert.rejects(() => service.getPlacement(actor), { code: 26, status: 403 });
    await assert.rejects(() => service.savePlacementDraft(actor, content()), { code: 26 });
    await assert.rejects(() => service.publishPlacement(actor), { code: 26 });
  }
  assert.deepEqual(await service.getPlacement(manager), { media: {}, draft: null, published: null });
});

test('placement files go to the placement folder', async () => {
  const { uploads } = await harness();
  assert.deepEqual(uploads.map((input) => input.folder), ['audio/placement', 'image/placement']);
});

test('the placement test follows the seven-part publishing rules', async () => {
  const { service, content } = await harness();
  await assert.rejects(() => service.publishPlacement(manager), { code: 41, status: 409 });
  await service.savePlacementDraft(manager, placementContentSchema.parse({}));
  await assert.rejects(() => service.publishPlacement(manager), (error) => {
    assert.equal(error.code, 42);
    const paths = error.data.issues.map((issue) => issue.path);
    for (const path of ['test.part1.audioMediaId', 'test.part1.questions', 'test.part6.passage', 'test.part7.questions'])
      assert.ok(paths.includes(path), path);
    assert.equal(paths.some((path) => path.startsWith('vocabulary') || path.startsWith('fillIn')), false);
    return true;
  });

  const saved = await service.savePlacementDraft(manager, content());
  assert.equal(saved.draft.versionNumber, 1);
  assert.match(saved.draft.content.test.part5.questions[0].id, /^[0-9a-f-]{36}$/);
  assert.equal('vocabulary' in saved.draft.content, false);
  const published = await service.publishPlacement(manager);
  assert.equal(published.draft, null);
  assert.equal(published.published.versionNumber, 1);
  assert.equal(Object.keys(published.media).length, 2);
});

test('learning-service reads the published paper with answers; edits create a new version', async () => {
  const { service, repository, content, audioId } = await harness();
  await assert.rejects(() => service.getPlacementPaper(), { code: 40, status: 404 });
  await service.savePlacementDraft(manager, content());
  await assert.rejects(() => service.getPlacementPaper(), { code: 40 });
  const first = (await service.publishPlacement(manager)).published;

  const paper = await service.getPlacementPaper();
  assert.equal(paper.versionId, first.versionId);
  assert.equal(paper.publishedUnitCount, 0);
  assert.equal(paper.test.part5.questions[0].options.filter((option) => option.isCorrect).length, 1);
  assert.deepEqual(paper.media[audioId], { kind: 'audio', fileName: 'a.mp3', url: 'https://media.test/a.mp3' });

  const edited = await service.savePlacementDraft(manager, content((value) => {
    value.test.part5.questions[0].prompt = 'Fixed question';
    return value;
  }));
  assert.equal(edited.draft.versionNumber, 2);
  assert.equal((await service.getPlacementPaper()).versionNumber, 1);
  const second = (await service.publishPlacement(manager)).published;
  assert.equal(second.versionNumber, 2);
  assert.equal((await service.getPlacementPaper()).test.part5.questions[0].prompt, 'Fixed question');
  assert.notEqual((await service.getPlacementPaper({ versionId: first.versionId })).test.part5.questions[0].prompt, 'Fixed question');
  await assert.rejects(() => service.getPlacementPaper({ versionId: '00000000-0000-4000-8000-000000000000' }), { code: 40 });

  repository.tables.units.push({ id: 'u1', status: 'PUBLISHED', position: 1 }, { id: 'u2', status: 'DRAFT', position: 2 });
  assert.equal((await service.getPlacementPaper()).publishedUnitCount, 1);
});

test('placement files are kept while a saved version uses them', async () => {
  const { service, removed, upload, content, audioId } = await harness();
  await service.savePlacementDraft(manager, content());
  assert.deepEqual(await service.deleteMedia(manager, audioId), { deleted: false });
  const replacement = await upload('audio', 'new.mp3', 'audio/mpeg');
  await service.savePlacementDraft(manager, content((value) => {
    value.test.part3.audioMediaId = replacement;
    return value;
  }));
  await service.savePlacementDraft(manager, content());
  assert.deepEqual(removed, ['new.mp3']);
  await service.publishPlacement(manager);
  assert.deepEqual(await service.deleteMedia(manager, audioId), { deleted: false });
});

test('learning-service reads the published curriculum and a lesson paper', async () => {
  const { service, audioId, imageId } = await harness();
  const lessonContent = () => publishableContent({ audioId, imageId });
  const { unit } = await service.createUnit(manager, { title: 'Unit A', description: 'About A' });
  const draftUnit = (await service.createUnit(manager, { title: 'Unit B', description: '' })).unit;
  const publish = async (unitId, title) => {
    const { lesson } = await service.createLesson(manager, unitId, { title });
    await service.saveLessonDraft(manager, lesson.id, lessonContent());
    await service.publishLesson(manager, lesson.id);
    return lesson;
  };
  const first = await publish(unit.id, 'L1');
  const second = await publish(unit.id, 'L2');
  const draftOnly = (await service.createLesson(manager, unit.id, { title: 'Draft' })).lesson;
  const hidden = await publish(draftUnit.id, 'Hidden');
  await service.updateLesson(manager, second.id, { position: 1 });
  await service.publishUnit(manager, unit.id);

  assert.deepEqual(await service.getCurriculum(), {
    units: [{ id: unit.id, title: 'Unit A', description: 'About A', reviewVersionId: null, lessons: [{ id: second.id, title: 'L2' }, { id: first.id, title: 'L1' }] }],
  });

  const paper = await service.getLessonPaper(first.id);
  assert.deepEqual(paper.lesson, { id: first.id, title: 'L1', unitId: unit.id, unitTitle: 'Unit A' });
  assert.equal(paper.versionNumber, 1);
  assert.equal(paper.content.fillIn.answers.length, 2);
  assert.equal(paper.content.test.part5.questions[0].options.some((option) => option.isCorrect), true);
  assert.equal(paper.media[audioId].url, 'https://media.test/a.mp3');

  await service.saveLessonDraft(manager, first.id, { ...lessonContent(), fillIn: { passage: 'A ___ only.', answers: ['ticket'] } });
  await service.publishLesson(manager, first.id);
  assert.equal((await service.getLessonPaper(first.id)).versionNumber, 2);
  assert.equal((await service.getLessonPaper(first.id, { versionId: paper.versionId })).content.fillIn.answers.length, 2);

  for (const id of [draftOnly.id, hidden.id, '00000000-0000-4000-8000-000000000000'])
    await assert.rejects(() => service.getLessonPaper(id), { code: 40, status: 404 });
  const other = await service.getLessonPaper(second.id);
  await assert.rejects(() => service.getLessonPaper(first.id, { versionId: other.versionId }), { code: 40 });
});

