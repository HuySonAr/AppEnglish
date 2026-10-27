import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { mockContentSchema, mockCreateSchema } from '../src/content/content.schemas.js';
import { fullMock, publishableMock } from './review-helpers.js';
import { admin, createMemoryRepository, manager, student, submitted, teacher, toeicExamTypeId } from './memory-repository.js';

async function harness() {
  const repository = createMemoryRepository();
  const uploads = [];
  const storage = {
    async upload(input) {
      uploads.push(input);
      return { id: `stored-${uploads.length}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `https://media.test/${input.fileName}`, storage: 'imagekit' };
    },
    async delete() {},
  };
  const service = new ContentService(repository, storage);
  const upload = async (kind, fileName, mimeType) =>
    (await service.uploadMedia(teacher, { kind, fileName, mimeType, data: Buffer.from([1]), section: 'mock' })).media.id;
  const audioId = await upload('audio', 'a.mp3', 'audio/mpeg');
  const imageId = await upload('image', 'p.png', 'image/png');
  const content = (change = (value) => value) => mockContentSchema.parse(change(publishableMock({ audioId, imageId })));
  return { service, repository, uploads, audioId, imageId, content };
}

test('teachers write mock tests and every staff member reads them', async () => {
  const { service } = await harness();
  const input = { title: 'Mock 1', level: 2, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId };
  const toeic = { id: toeicExamTypeId, code: 'toeic', name: 'TOEIC' };
  for (const actor of [student, admin]) {
    await assert.rejects(() => service.listMockTests(actor), { code: 26, status: 403 });
    await assert.rejects(() => service.createMockTest(actor, input), { code: 26 });
  }
  await assert.rejects(() => service.createMockTest(manager, input), { code: 26 });
  const created = await service.createMockTest(teacher, input);
  assert.deepEqual(created.mockTest, { id: created.mockTest.id, title: 'Mock 1', level: 2, durationMinutes: 120, format: 'practice', examType: toeic });
  assert.equal(created.draft.versionNumber, 1);
  assert.deepEqual(Object.keys(created.draft.content.test), ['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7']);
  assert.deepEqual((await service.listMockTests(teacher)).mockTests, [{ ...created.mockTest, createdAt: null, publishedVersionNumber: null, hasDraft: true, draftStatus: 'DRAFT' }]);
  assert.equal((await service.listMockTests(manager)).mockTests.length, 1);
  for (const actor of [student, admin]) await assert.rejects(() => service.getMockTest(actor, created.mockTest.id), { code: 26 });
  await assert.rejects(() => service.getMockTest(teacher, randomUUID()), { code: 40, status: 404 });

  await assert.rejects(() => service.updateMockTest(manager, created.mockTest.id, { level: 3 }), { code: 26 });
  const updated = await service.updateMockTest(teacher, created.mockTest.id, { level: 3, durationMinutes: 90 });
  assert.deepEqual(updated.mockTest, { ...created.mockTest, level: 3, durationMinutes: 90 });
});

test('a full test keeps 120 minutes and needs the ETS structure; a practice set does not (D193)', async () => {
  const { service, audioId, imageId } = await harness();
  const created = (await service.createMockTest(teacher, { title: 'Full', level: 2, examTypeId: toeicExamTypeId })).mockTest;
  assert.deepEqual([created.format, created.durationMinutes], ['full', 120]);
  assert.equal((await service.updateMockTest(teacher, created.id, { durationMinutes: 90 })).mockTest.durationMinutes, 120);
  const small = mockContentSchema.parse(publishableMock({ audioId, imageId }));
  await service.saveMockTestDraft(teacher, created.id, small);
  await assert.rejects(() => submitted(service, null, 'mockTest', created.id), (error) => {
    const paths = error.data.issues.map((issue) => issue.path);
    return error.code === 42 && ['test.part1.questions', 'test.part3.groups', 'test.part6.groups', 'test.part7.groups'].every((path) => paths.includes(path));
  });
  const practice = await service.updateMockTest(teacher, created.id, { format: 'practice', durationMinutes: 45 });
  assert.deepEqual([practice.mockTest.format, practice.mockTest.durationMinutes], ['practice', 45]);
  await submitted(service, null, 'mockTest', created.id);
  await service.publishMockTest(manager, created.id);
  await assert.rejects(() => service.updateMockTest(teacher, created.id, { format: 'full' }), (error) => error.data.reason === 'PUBLISHED_BEFORE');

  const full = (await service.createMockTest(teacher, { title: 'Full 2', level: 2, examTypeId: toeicExamTypeId })).mockTest;
  await service.saveMockTestDraft(teacher, full.id, mockContentSchema.parse(fullMock({ audioId, imageId })));
  await submitted(service, null, 'mockTest', full.id);
  assert.equal((await service.publishMockTest(manager, full.id)).published.versionNumber, 1);
  assert.equal(mockCreateSchema.safeParse({ title: 'P', level: 1, format: 'practice', examTypeId: toeicExamTypeId }).success, false);
  assert.equal(mockCreateSchema.parse({ title: 'F', level: 1, examTypeId: toeicExamTypeId }).format, 'full');
});

test('mock test files go to the mock folder', async () => {
  const { uploads } = await harness();
  assert.deepEqual(uploads.map((input) => input.folder), ['audio/mock', 'image/mock']);
});

test('mock tests follow their own publishing rules', async () => {
  const { service, content, audioId } = await harness();
  const { mockTest } = await service.createMockTest(teacher, { title: 'Mock', level: 1, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId });
  const paths = async () => {
    try {
      await submitted(service, null, 'mockTest', mockTest.id);
      await service.publishMockTest(manager, mockTest.id);
      return [];
    } catch (error) {
      assert.equal(error.code, 42);
      return error.data.issues.map((issue) => issue.path);
    }
  };
  for (const path of ['test.part1.questions', 'test.part3.groups', 'test.part4.questions', 'test.part5.questions', 'test.part6.groups', 'test.part7.questions'])
    assert.ok((await paths()).includes(path), path);

  await service.saveMockTestDraft(teacher, mockTest.id, content((value) => {
    const { part1, part2, part3, part4, part5, part6, part7 } = value.test;
    part1.questions[0].imageMediaId = audioId;
    part1.questions[1].audioMediaId = null;
    part2.questions[0].transcript = '';
    part3.groups[0].audioMediaId = null;
    part4.groups[0].transcript = '';
    part4.questions[0].groupId = null;
    part3.questions[0].prompt = '';
    part5.questions[0].options.forEach((option) => { option.text = 'Same'; });
    part5.questions[1].explanation = '';
    part6.groups[0].passage = 'Only ___ one blank.';
    part7.groups[0].passage = '';
    part7.questions[1].groupId = randomUUID();
    part7.groups.push({ id: randomUUID(), passage: 'Empty group' });
    return value;
  }));
  const found = await paths();
  for (const path of [
    'test.part1.questions[0].imageMediaId', 'test.part1.questions[1].audioMediaId', 'test.part2.questions[0].transcript',
    'test.part3.groups[0].audioMediaId', 'test.part4.groups[0].transcript', 'test.part4.groups[0]', 'test.part4.questions[0]',
    'test.part3.questions[0].prompt', 'test.part5.questions[0].options',
    'test.part5.questions[1].explanation', 'test.part6.groups[0].passage', 'test.part7.groups[0].passage',
    'test.part7.questions[1]', 'test.part7.groups[2]',
  ]) assert.ok(found.includes(path), path);
  assert.equal(found.some((path) => /^test\.part\d\.(audioMediaId|transcript)$/.test(path)), false);

  const saved = await service.saveMockTestDraft(teacher, mockTest.id, content());
  assert.match(saved.draft.content.test.part6.groups[0].id, /^[0-9a-f-]{36}$/);
  await submitted(service, null, 'mockTest', mockTest.id);
  const published = await service.publishMockTest(manager, mockTest.id);
  assert.equal(published.draft, null);
  assert.equal(published.published.versionNumber, 1);
  assert.equal(Object.keys(published.media).length, 2);
  assert.deepEqual((await service.listMockTests(teacher)).mockTests.map((item) => [item.publishedVersionNumber, item.hasDraft]), [[1, false]]);
});

test('conversations 11-13 and talks 9-10 need a graphic on one question', async () => {
  const { service, content, audioId, imageId } = await harness();
  const { mockTest } = await service.createMockTest(teacher, { title: 'Mock', level: 1, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId });
  const fill = (part, count) => {
    const [group] = part.groups;
    const [question] = part.questions;
    part.groups = Array.from({ length: count }, () => ({ ...group, id: randomUUID() }));
    part.questions = part.groups.flatMap((set) => Array.from({ length: 3 }, () => structuredClone({ ...question, groupId: set.id })));
  };
  const draft = (change) => service.saveMockTestDraft(teacher, mockTest.id, content((value) => {
    fill(value.test.part3, 13);
    fill(value.test.part4, 10);
    for (const set of [10, 11, 12]) value.test.part3.questions[set * 3 + 1].imageMediaId = imageId;
    for (const set of [8, 9]) value.test.part4.questions[set * 3 + 1].imageMediaId = imageId;
    change?.(value.test);
    return value;
  }));
  const paths = async () => {
    try {
      await submitted(service, null, 'mockTest', mockTest.id);
      await service.publishMockTest(manager, mockTest.id);
      return [];
    } catch (error) {
      return error.data.issues.map((issue) => issue.path);
    }
  };

  await draft(({ part3, part4 }) => {
    part3.questions[1].imageMediaId = imageId;
    part3.questions[10 * 3 + 1].imageMediaId = null;
    part3.questions[12 * 3].imageMediaId = imageId;
    part4.questions[9 * 3 + 1].imageMediaId = audioId;
  });
  assert.deepEqual((await paths()).sort(), [
    'test.part3.groups[0].imageMediaId', 'test.part3.groups[10].imageMediaId', 'test.part3.groups[12].imageMediaId',
    'test.part4.questions[28].imageMediaId',
  ]);

  await draft();
  assert.deepEqual(await paths(), []);

  await draft(({ part3, part5 }) => {
    part3.questions.splice(1, 0, structuredClone({ ...part3.questions[0], id: undefined }));
    part5.questions = Array.from({ length: 31 }, (_, index) => structuredClone({ ...part5.questions[0], prompt: `Q${index} ___` }));
  });
  assert.deepEqual((await paths()).sort(), ['test.part3.groups[0]', 'test.part3.questions', 'test.part5.questions']);
});

test('learning-service reads published mock tests and their papers', async () => {
  const { service, content, audioId } = await harness();
  const first = (await service.createMockTest(teacher, { title: 'Level 2 test', level: 2, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId })).mockTest;
  const draftOnly = (await service.createMockTest(teacher, { title: 'Draft', level: 1, durationMinutes: 60, format: 'practice', examTypeId: toeicExamTypeId })).mockTest;
  assert.deepEqual(await service.listPublishedMockTests(), { mockTests: [] });
  await assert.rejects(() => service.getMockPaper(first.id), { code: 40, status: 404 });

  await service.saveMockTestDraft(teacher, first.id, content());
  await submitted(service, null, 'mockTest', first.id);
  const version = (await service.publishMockTest(manager, first.id)).published;
  assert.deepEqual(await service.listPublishedMockTests(), {
    mockTests: [{ ...first, questionCount: 13, partCounts: { part1: 2, part2: 1, part3: 2, part4: 1, part5: 2, part6: 2, part7: 3 } }],
  });

  const paper = await service.getMockPaper(first.id);
  assert.deepEqual(paper.mockTest, first);
  assert.equal(paper.versionId, version.versionId);
  assert.equal(paper.test.part7.questions[1].groupId, paper.test.part7.groups[1].id);
  assert.equal(paper.test.part5.questions[0].options.filter((option) => option.isCorrect).length, 1);
  assert.equal(paper.media[audioId].url, 'https://media.test/a.mp3');

  await service.saveMockTestDraft(teacher, first.id, content((value) => {
    value.test.part5.questions.pop();
    return value;
  }));
  assert.equal((await service.getMockPaper(first.id)).versionNumber, 1);
  await submitted(service, null, 'mockTest', first.id);
  await service.publishMockTest(manager, first.id);
  assert.equal((await service.getMockPaper(first.id)).test.part5.questions.length, 1);
  assert.equal((await service.getMockPaper(first.id, { versionId: version.versionId })).test.part5.questions.length, 2);
  await assert.rejects(() => service.getMockPaper(draftOnly.id), { code: 40 });
  await assert.rejects(() => service.getMockPaper(first.id, { versionId: randomUUID() }), { code: 40 });
  assert.deepEqual(await service.deleteMedia(teacher, audioId), { deleted: false });
});

test('exam types: everyone lists them, an admin adds and renames, tests need a type with an editor', async () => {
  const { service } = await harness();
  const toeic = { id: toeicExamTypeId, code: 'toeic', name: 'TOEIC', format: 'toeic', hasEditor: true };
  assert.deepEqual(await service.listExamTypes(), { examTypes: [toeic] });
  for (const actor of [student, manager, teacher]) {
    await assert.rejects(() => service.createExamType(actor, { name: 'IELTS' }), { code: 26, status: 403 });
    await assert.rejects(() => service.updateExamType(actor, toeicExamTypeId, { name: 'X' }), { code: 26 });
  }

  const { examType } = await service.createExamType(admin, { name: 'HSK 1' });
  assert.deepEqual({ ...examType, id: null }, { id: null, code: 'hsk-1', name: 'HSK 1', format: null, hasEditor: false });
  for (const name of ['toeic', 'Toeic', 'HSK-1', 'hsk 1', '!!!'])
    await assert.rejects(() => service.createExamType(admin, { name }), (error) => error.code === 45 && error.status === 409 && error.data.reason === 'NAME_TAKEN', name);

  const renamed = await service.updateExamType(admin, examType.id, { name: 'HSK Level 1' });
  assert.deepEqual([renamed.examType.name, renamed.examType.code], ['HSK Level 1', 'hsk-1']);
  await assert.rejects(() => service.updateExamType(admin, examType.id, { name: 'TOEIC' }), { code: 45 });
  assert.equal((await service.updateExamType(admin, examType.id, { name: 'HSK Level 1' })).examType.name, 'HSK Level 1');
  await assert.rejects(() => service.updateExamType(admin, '00000000-0000-4000-8000-000000000000', { name: 'Y' }), { code: 40, status: 404 });

  const base = { title: 'Mock', level: 1, durationMinutes: 120 };
  await assert.rejects(() => service.createMockTest(teacher, { ...base, examTypeId: examType.id }), (error) => error.code === 45 && error.data.reason === 'NO_EDITOR');
  await assert.rejects(() => service.createMockTest(teacher, { ...base, examTypeId: '00000000-0000-4000-8000-000000000000' }), { code: 40 });
  const created = await service.createMockTest(teacher, { ...base, examTypeId: toeicExamTypeId });
  assert.deepEqual(created.mockTest.examType, { id: toeicExamTypeId, code: 'toeic', name: 'TOEIC' });
  assert.equal((await service.listMockTests(teacher)).mockTests[0].examType.name, 'TOEIC');
});

test('transcribe runs on one recording of a mock test and keeps the latest job of each recording (D161)', async () => {
  const { service, repository, audioId, content } = await harness();
  const sent = [];
  const listening = new ListeningService(repository.listening, service, { broker: { ready: true, publish: (message) => sent.push(message) > 0 } });
  const { mockTest } = await service.createMockTest(teacher, { title: 'Mock', level: 1, durationMinutes: 120, format: 'practice', examTypeId: toeicExamTypeId });
  await assert.rejects(() => listening.requestMockTranscribe(teacher, mockTest.id, { audioMediaId: audioId }), { code: 41 });
  await service.saveMockTestDraft(teacher, mockTest.id, content());
  await assert.rejects(() => listening.requestMockTranscribe(student, mockTest.id, { audioMediaId: audioId }), { code: 26 });
  await assert.rejects(() => listening.requestMockTranscribe(teacher, mockTest.id, { audioMediaId: randomUUID() }), { code: 41 });

  const { job } = await listening.requestMockTranscribe(teacher, mockTest.id, { audioMediaId: audioId });
  assert.deepEqual([job.task, job.status], ['transcribe', 'QUEUED']);
  assert.deepEqual(repository.tables.contentEvents.map((event) => event.payload), [{ jobId: job.id, task: 'transcribe', audioUrl: 'https://media.test/a.mp3', language: 'en', kind: 'part1', lines: [] }]);
  assert.equal((await listening.requestMockTranscribe(teacher, mockTest.id, { audioMediaId: audioId })).job.id, job.id);

  await listening.onAutoTimeResult({ jobId: job.id, status: 'DONE', lines: [{ text: ' A man is reading. ', start: 0, end: 2 }] });
  const { jobs } = await listening.listMockTranscribe(teacher, mockTest.id);
  assert.deepEqual(jobs.map((item) => [item.audioMediaId, item.status, item.lines.map((line) => line.text)]), [[audioId, 'DONE', ['A man is reading.']]]);
});
