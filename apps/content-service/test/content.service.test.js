import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { lessonContentSchema } from '../src/content/content.schemas.js';
import { MediaValidationError } from '../src/media/media.errors.js';
import { admin, createMemoryRepository, manager, publishableContent, student } from './memory-repository.js';

async function harness() {
  const repository = createMemoryRepository();
  const uploads = [];
  const removed = [];
  const storage = {
    async delete(asset) {
      if (asset.fileName === 'stuck.mp3') throw new Error('storage offline');
      removed.push(asset.storageId);
    },
    async upload(input) {
      if (input.mimeType !== 'audio/mpeg' && input.kind === 'audio')
        throw new MediaValidationError('MEDIA_MIME_TYPE_NOT_ALLOWED', 'Media MIME type is not allowed');
      uploads.push(input);
      return { id: `stored-${uploads.length}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: 'http://localhost:3002/media/file', storage: 'local' };
    },
  };
  const service = new ContentService(repository, storage);
  const audioId = (await service.uploadMedia(manager, { kind: 'audio', fileName: 'a.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1, 2, 3]) })).media.id;
  const imageId = (await service.uploadMedia(manager, { kind: 'image', fileName: 'a.png', mimeType: 'image/png', data: Buffer.from([1, 2]) })).media.id;
  const content = (change = (value) => value) =>
    lessonContentSchema.parse(change(publishableContent({ audioId, imageId })));
  return { service, repository, uploads, removed, audioId, imageId, content };
}

async function publishedLesson({ service, content }, unitId, title = 'Lesson') {
  const { lesson } = await service.createLesson(manager, unitId, { title });
  await service.saveLessonDraft(manager, lesson.id, content());
  await service.publishLesson(manager, lesson.id);
  return lesson;
}

async function issuePaths(service, lessonId) {
  let paths = [];
  await assert.rejects(() => service.publishLesson(manager, lessonId), (error) => {
    assert.equal(error.code, 42);
    assert.equal(error.status, 409);
    paths = error.data.issues.map((issue) => issue.path);
    return true;
  });
  return paths;
}

test('only a Content Manager can manage content', async () => {
  const { service } = await harness();
  for (const actor of [student, admin]) {
    await assert.rejects(() => service.createUnit(actor, { title: 'Unit', description: '' }), { code: 26, status: 403 });
    await assert.rejects(() => service.uploadMedia(actor, { kind: 'audio', fileName: 'a.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]) }), { code: 26 });
  }
  const { unit } = await service.createUnit(manager, { title: 'Unit', description: '' });
  for (const call of [
    () => service.updateUnit(student, unit.id, { title: 'X' }),
    () => service.publishUnit(student, unit.id),
    () => service.createLesson(student, unit.id, { title: 'L' }),
  ]) await assert.rejects(call, { code: 26 });
});

test('units and lessons are appended in order and can be moved', async () => {
  const { service } = await harness();
  const a = (await service.createUnit(manager, { title: 'A', description: '' })).unit;
  const b = (await service.createUnit(manager, { title: 'B', description: '' })).unit;
  const c = (await service.createUnit(manager, { title: 'C', description: '' })).unit;
  assert.deepEqual([a.position, b.position, c.position], [1, 2, 3]);
  await service.updateUnit(manager, c.id, { position: 1 });
  let { units } = await service.listUnits(manager);
  assert.deepEqual(units.map((unit) => [unit.title, unit.position]), [['C', 1], ['A', 2], ['B', 3]]);
  await service.updateUnit(manager, c.id, { position: 99, title: 'C2' });
  ({ units } = await service.listUnits(manager));
  assert.deepEqual(units.map((unit) => unit.title), ['A', 'B', 'C2']);

  const first = (await service.createLesson(manager, a.id, { title: 'L1' })).lesson;
  const second = (await service.createLesson(manager, a.id, { title: 'L2' })).lesson;
  assert.deepEqual([first.position, second.position], [1, 2]);
  await service.updateLesson(manager, second.id, { position: 1 });
  ({ units } = await service.listUnits(manager));
  assert.deepEqual(units[0].lessons.map((lesson) => lesson.title), ['L2', 'L1']);
  await assert.rejects(() => service.updateUnit(manager, '00000000-0000-4000-8000-000000000000', { title: 'x' }), { code: 40, status: 404 });
});

test('a new lesson starts with an empty seven-part draft and drafts may be incomplete', async () => {
  const { service } = await harness();
  const { unit } = await service.createUnit(manager, { title: 'Unit', description: '' });
  const created = await service.createLesson(manager, unit.id, { title: 'Lesson' });
  assert.equal(created.draft.versionNumber, 1);
  assert.deepEqual(created.draft.content.vocabulary, []);
  assert.deepEqual(created.draft.content.fillIn, { passage: '', answers: [] });
  assert.deepEqual(Object.keys(created.draft.content.test), ['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7']);
  assert.equal(created.published, null);

  const saved = await service.saveLessonDraft(manager, created.lesson.id, lessonContentSchema.parse({ vocabulary: [{ word: 'ticket' }] }));
  assert.match(saved.draft.content.vocabulary[0].id, /^[0-9a-f-]{36}$/);
  const paths = await issuePaths(service, created.lesson.id);
  for (const path of [
    'vocabulary[0].partOfSpeech', 'vocabulary[0].meaning', 'vocabulary[0].example',
    'fillIn.passage', 'test.part1.questions', 'test.part1.audioMediaId', 'test.part2.transcript', 'test.part3.audioMediaId', 'test.part3.transcript',
    'test.part6.passage', 'test.part7.questions',
  ]) assert.ok(paths.includes(path), path);
  // Phonetic, pronunciation audio and the example translation are optional (D51).
  for (const path of ['vocabulary[0].phonetic', 'vocabulary[0].exampleMeaning', 'vocabulary[0].audioUkMediaId', 'vocabulary[0].audioUsMediaId'])
    assert.equal(paths.includes(path), false, path);
});

test('a complete lesson has 23 questions and publishes', async () => {
  const context = await harness();
  const { service, content } = context;
  const total = Object.values(content().test).reduce((sum, part) => sum + part.questions.length, 0);
  assert.equal(total, 23);
  const { unit } = await service.createUnit(manager, { title: 'Unit', description: '' });
  const lesson = await publishedLesson(context, unit.id);
  const view = await service.getLesson(manager, lesson.id);
  assert.equal(view.published.versionNumber, 1);
  assert.equal(view.draft, null);
  assert.equal(view.published.content.test.part2.questions[0].options.length, 3);
  // The editor gets the files the content uses; local files have no URL.
  assert.deepEqual(Object.keys(view.media).sort(), [context.audioId, context.imageId].sort());
  assert.deepEqual(view.media[context.audioId], { kind: 'audio', fileName: 'a.mp3', url: null });
  context.repository.tables.media.find((asset) => asset.id === context.imageId).storage = 'imagekit';
  assert.equal((await service.getLesson(manager, lesson.id)).media[context.imageId].url, 'http://localhost:3002/media/file');
  assert.equal('media' in (await service.getLesson(manager, (await service.createLesson(manager, unit.id, { title: 'Empty' })).lesson.id)), true);
});

test('vocabulary and fill-in publishing rules', async () => {
  const { service, content, imageId } = await harness();
  const { unit } = await service.createUnit(manager, { title: 'Unit', description: '' });
  const { lesson } = await service.createLesson(manager, unit.id, { title: 'Lesson' });
  await service.saveLessonDraft(manager, lesson.id, content((value) => {
    value.vocabulary[0].partOfSpeech = 'thing';
    value.vocabulary[0].audioUkMediaId = imageId;
    value.vocabulary[0].audioUsMediaId = '00000000-0000-4000-8000-000000000000';
    value.vocabulary.push({ ...value.vocabulary[1], word: 'PLATFORM' });
    value.fillIn = { passage: 'One ___ and two ___ and three ___.', answers: ['ticket', 'station'] };
    return value;
  }));
  const paths = await issuePaths(service, lesson.id);
  for (const path of ['vocabulary[0].partOfSpeech', 'vocabulary[0].audioUkMediaId', 'vocabulary[0].audioUsMediaId', 'vocabulary', 'fillIn.answers', 'fillIn.answers[1]'])
    assert.ok(paths.includes(path), path);

  // The same word is allowed with a different part of speech.
  await service.saveLessonDraft(manager, lesson.id, content((value) => {
    value.vocabulary.push({ ...value.vocabulary[0], partOfSpeech: 'verb', meaning: 'phạt vé' });
    value.fillIn = { passage: 'No blank here.', answers: [] };
    return value;
  }));
  assert.deepEqual(await issuePaths(service, lesson.id), ['fillIn.passage']);
});

test('lesson test publishing rules per part', async () => {
  const { service, content, imageId, audioId } = await harness();
  const { unit } = await service.createUnit(manager, { title: 'Unit', description: '' });
  const { lesson } = await service.createLesson(manager, unit.id, { title: 'Lesson' });
  await service.saveLessonDraft(manager, lesson.id, content((value) => {
    const { part1, part2, part3, part4, part5, part6, part7 } = value.test;
    part1.questions[0].imageMediaId = audioId;
    part1.audioMediaId = null;
    part1.questions[0].options.pop();
    part2.questions[0].options.push({ ...part2.questions[0].options[0], isCorrect: false });
    part2.transcript = '';
    part2.questions[1].options.forEach((option) => { option.isCorrect = false; });
    part3.audioMediaId = imageId;
    part3.questions.pop();
    part4.transcript = '';
    part4.questions[0].prompt = '';
    part4.questions[1].options.forEach((option) => { option.isCorrect = true; });
    part5.questions[0].options.forEach((option) => { option.text = 'Same'; });
    part5.questions[1].options[0].text = '';
    part5.questions[2].explanation = '';
    part6.passage = 'Only ___ two ___ blanks.';
    part7.passage = '';
    part7.imageMediaId = audioId;
    part7.questions.push({ ...part7.questions[0] });
    return value;
  }));
  const paths = await issuePaths(service, lesson.id);
  for (const path of [
    'test.part1.questions[0].imageMediaId', 'test.part1.audioMediaId', 'test.part1.questions[0].options',
    'test.part2.questions[0].options', 'test.part2.transcript', 'test.part2.questions[1].options',
    'test.part3.audioMediaId', 'test.part3.questions',
    'test.part4.transcript', 'test.part4.questions[0].prompt', 'test.part4.questions[1].options',
    'test.part5.questions[0].options', 'test.part5.questions[1].options', 'test.part5.questions[2].explanation',
    'test.part6.passage', 'test.part7.passage', 'test.part7.imageMediaId', 'test.part7.questions',
  ]) assert.ok(paths.includes(path), path);

  // Part 7 may carry an optional image of the document.
  await service.saveLessonDraft(manager, lesson.id, content((value) => {
    value.test.part7.imageMediaId = imageId;
    return value;
  }));
  assert.equal((await service.publishLesson(manager, lesson.id)).published.versionNumber, 1);
});

test('a published version is immutable and edits create the next version', async () => {
  const context = await harness();
  const { service, repository } = context;
  const { unit } = await service.createUnit(manager, { title: 'Unit', description: '' });
  const lesson = await publishedLesson(context, unit.id);
  const v1 = (await service.getLesson(manager, lesson.id)).published;
  await assert.rejects(() => service.publishLesson(manager, lesson.id), { code: 41, status: 409 });

  // Editing starts from the published content and keeps item ids stable.
  const edited = structuredClone(v1.content);
  edited.vocabulary[0].meaning = 'vé tàu';
  const draft = await service.saveLessonDraft(manager, lesson.id, lessonContentSchema.parse(edited));
  assert.equal(draft.draft.versionNumber, 2);
  assert.equal(draft.draft.content.vocabulary[0].id, v1.content.vocabulary[0].id);
  assert.equal(draft.draft.content.test.part5.questions[0].options[0].id, v1.content.test.part5.questions[0].options[0].id);
  assert.equal(draft.published.content.vocabulary[0].meaning, 'vé');

  const v2 = (await service.publishLesson(manager, lesson.id)).published;
  assert.equal(v2.versionNumber, 2);
  assert.notEqual(v2.versionId, v1.versionId);
  const stored = await repository.findVersion(v1.versionId);
  assert.equal(stored.status, 'PUBLISHED');
  assert.equal(stored.content.vocabulary[0].meaning, 'vé');
  const { units } = await service.listUnits(manager);
  assert.deepEqual(units[0].lessons[0], { id: lesson.id, title: 'Lesson', position: 1, publishedVersionNumber: 2, hasDraft: false });
});

test('a unit needs a published lesson and learners only see published content', async () => {
  const context = await harness();
  const { service } = context;
  const { unit } = await service.createUnit(manager, { title: 'Unit', description: '' });
  const draftOnly = (await service.createLesson(manager, unit.id, { title: 'Draft only' })).lesson;
  // Draft lessons do not count.
  await assert.rejects(() => service.publishUnit(manager, unit.id), (error) => {
    assert.equal(error.code, 42);
    assert.match(error.data.issues[0].message, /at least 1 published lesson; it has 0/);
    return true;
  });
  const lessons = [];
  for (let index = 1; index <= 4; index++) lessons.push(await publishedLesson(context, unit.id, `L${index}`));
  // Published lessons of an unpublished unit stay hidden from learners.
  assert.deepEqual((await service.listUnits(student)).units, []);
  await assert.rejects(() => service.getLesson(student, lessons[0].id), { code: 40, status: 404 });

  lessons.push(await publishedLesson(context, unit.id, 'L5'));
  assert.equal((await service.publishUnit(manager, unit.id)).unit.status, 'PUBLISHED');
  assert.equal((await service.publishUnit(manager, unit.id)).unit.status, 'PUBLISHED');

  const { units } = await service.listUnits(student);
  assert.equal(units.length, 1);
  assert.deepEqual(units[0].lessons.map((lesson) => lesson.title), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual(Object.keys(units[0].lessons[0]), ['id', 'title', 'position']);
  await assert.rejects(() => service.getLesson(student, draftOnly.id), { code: 40 });

  const view = await service.getLesson(admin, lessons[0].id);
  assert.equal(view.vocabulary.length, 2);
  assert.equal(view.vocabulary[0].phonetic, '/ˈtɪkɪt/');
  assert.equal(view.vocabulary[0].exampleMeaning, 'Tôi đã mua một vé.');
  assert.deepEqual(view.wordBank, ['ticket', 'platform']);
  assert.deepEqual(view.fillIn, { passage: 'She showed her ___ and walked to the ___.', blankCount: 2 });
  assert.deepEqual(view.test, { questionCount: 23 });
  const serialized = JSON.stringify(view);
  for (const secret of ['isCorrect', 'explanation', 'answers', 'transcript', 'Statement 1', 'Option 2', 'One ticket, please'])
    assert.equal(serialized.includes(secret), false, secret);
});

test('media upload stores the asset and maps storage validation errors', async () => {
  const { service, repository, uploads } = await harness();
  const before = repository.tables.media.length;
  const { media } = await service.uploadMedia(manager, { kind: 'audio', fileName: 'q.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1, 2, 3]) });
  assert.deepEqual(Object.keys(media), ['id', 'kind', 'fileName', 'mimeType', 'sizeBytes']);
  assert.equal(uploads.at(-1).sizeBytes, 3);
  const row = repository.tables.media.at(-1);
  assert.equal(row.storageId, `stored-${uploads.length}`);
  assert.equal(row.uploadedBy, manager.id);
  await assert.rejects(
    () => service.uploadMedia(manager, { kind: 'audio', fileName: 'q.mp3', mimeType: 'audio/wav', data: Buffer.from([1]) }),
    (error) => error.code === 43 && error.status === 400 && error.data.reason === 'MEDIA_MIME_TYPE_NOT_ALLOWED',
  );
  assert.equal(repository.tables.media.length, before + 1);

  // Files of a lesson go to its folder, vocabulary apart from the test.
  const { unit } = await service.createUnit(manager, { title: 'Unit', description: '' });
  await service.createLesson(manager, unit.id, { title: 'First' });
  const { lesson } = await service.createLesson(manager, unit.id, { title: 'Second' });
  const file = { kind: 'audio', fileName: 'q.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]) };
  await service.uploadMedia(manager, { ...file, lessonId: lesson.id, section: 'vocabulary' });
  assert.equal(uploads.at(-1).folder, 'audio/unit1-lesson2/vocabulary');
  await service.uploadMedia(manager, { ...file, kind: 'image', fileName: 'p.png', mimeType: 'image/png', lessonId: lesson.id });
  assert.equal(uploads.at(-1).folder, 'image/unit1-lesson2/test');
  await assert.rejects(() => service.uploadMedia(manager, { ...file, lessonId: '00000000-0000-4000-8000-000000000000' }), { code: 40 });
});

test('removing media deletes the stored file only when no saved version uses it', async () => {
  const { service, repository, removed, audioId, imageId, content } = await harness();
  const upload = async (fileName) =>
    (await service.uploadMedia(manager, { kind: 'audio', fileName, mimeType: 'audio/mpeg', data: Buffer.from([1]) })).media.id;
  const storageIdOf = (id) => repository.tables.media.find((asset) => asset.id === id)?.storageId;
  const { unit } = await service.createUnit(manager, { title: 'Unit', description: '' });
  const { lesson } = await service.createLesson(manager, unit.id, { title: 'Lesson' });

  // An upload that was never saved goes at once.
  const unsaved = await upload('unsaved.mp3');
  const unsavedStorageId = storageIdOf(unsaved);
  await assert.rejects(() => service.deleteMedia(student, unsaved), { code: 26 });
  assert.deepEqual(await service.deleteMedia(manager, unsaved), { deleted: true });
  assert.deepEqual(removed, [unsavedStorageId]);
  assert.equal(storageIdOf(unsaved), undefined);
  await assert.rejects(() => service.deleteMedia(manager, unsaved), { code: 40, status: 404 });

  // A file the saved draft uses stays until a save drops it.
  const british = await upload('uk.mp3');
  const britishStorageId = storageIdOf(british);
  await service.saveLessonDraft(manager, lesson.id, content((value) => {
    value.vocabulary[0].audioUkMediaId = british;
    return value;
  }));
  assert.deepEqual(await service.deleteMedia(manager, british), { deleted: false });
  await service.saveLessonDraft(manager, lesson.id, content());
  assert.deepEqual(removed, [unsavedStorageId, britishStorageId]);
  assert.equal(storageIdOf(british), undefined);

  // Published versions keep their files when a later draft drops them (D40).
  await service.publishLesson(manager, lesson.id);
  const replacement = await upload('new.mp3');
  await service.saveLessonDraft(manager, lesson.id, content((value) => {
    value.test.part3.audioMediaId = replacement;
    return value;
  }));
  await service.saveLessonDraft(manager, lesson.id, content((value) => {
    value.test.part1.questions[0].imageMediaId = null;
    return value;
  }));
  assert.equal(removed.length, 3);
  assert.equal(removed[2], 'stored-5');
  assert.ok(storageIdOf(audioId) && storageIdOf(imageId));

  // A storage failure keeps the row so it can be retried.
  const stuck = await upload('stuck.mp3');
  assert.deepEqual(await service.deleteMedia(manager, stuck), { deleted: false });
  assert.ok(storageIdOf(stuck));
});
