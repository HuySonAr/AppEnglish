import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { PracticeService } from '../src/practice/practice.service.js';
import { learnerRecordingsSchema, practiceMachineAudioSchema } from '../src/practice/practice.schemas.js';
import { createMemoryRepository, manager, student } from './memory-repository.js';
import { validateMediaUpload } from '../src/media/media.validator.js';

const teacher = { id: '55555555-5555-4555-8555-555555555555', role: 'TEACHER' };

function harness(pronunciationSource) {
  const repository = createMemoryRepository();
  const uploads = [];
  const deleted = [];
  const storage = {
    async upload(input) {
      validateMediaUpload(input);
      uploads.push(input);
      return { id: `appenglish/${input.folder}/${uploads.length}-${input.fileName}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `https://media.test/${uploads.length}/${input.fileName}`, storage: 'r2' };
    },
    async delete(asset) {
      if (asset.storageId === 'broken') throw new Error('gone');
      deleted.push(asset.storageId);
    },
  };
  const content = new ContentService(repository, storage, pronunciationSource);
  return { repository, uploads, deleted, service: new PracticeService(repository.practice, content) };
}

const readAloud = { title: 'Train times', level: 'A2', topic: 'Travel', text: 'The train leaves at nine.', audioMediaId: null };

async function publish(service, content = readAloud) {
  const { prompt } = await service.createPrompt(teacher, { kind: 'read_aloud' });
  await service.saveDraft(teacher, prompt.id, { content });
  await service.submitPrompt(teacher, prompt.id);
  await service.approvePrompt(manager, prompt.id);
  return prompt.id;
}

test('learners only get published prompts, as their published version (F12)', async () => {
  const { service } = harness();
  const id = await publish(service);
  const { prompt: draft } = await service.createPrompt(teacher, { kind: 'read_aloud' });
  const listed = await service.listPublished();
  assert.deepEqual(listed.prompts.map((item) => [item.id, item.title, item.level, item.versionNumber]), [[id, 'Train times', 'A2', 1]]);
  await service.saveDraft(teacher, id, { content: { ...readAloud, title: 'Train times v2' } });
  const paper = await service.paper(id);
  assert.equal(paper.prompt.content.title, 'Train times');
  assert.equal(paper.prompt.kind, 'read_aloud');
  await assert.rejects(() => service.paper(draft.id), { code: 40 });
  await service.unpublishPrompt(manager, id);
  assert.deepEqual((await service.listPublished()).prompts, []);
  await assert.rejects(() => service.paper(id), { code: 40 });
});

test('recordings are stored under learner-recordings and deleted by storage id', async () => {
  const { service, uploads, deleted } = harness();
  const stored = await service.storeRecording({ mimeType: 'audio/webm;codecs=opus', data: new Uint8Array([1, 2, 3]) });
  assert.equal(uploads[0].folder, 'learner-recordings');
  assert.equal(uploads[0].kind, 'recording');
  assert.equal(uploads[0].fileName, 'recording.webm');
  assert.deepEqual(stored.recording, { storage: 'r2', storageId: 'appenglish/learner-recordings/1-recording.webm', url: 'https://media.test/1/recording.webm', mimeType: 'audio/webm', sizeBytes: 3 });
  await assert.rejects(() => service.storeRecording({ mimeType: 'text/plain', data: new Uint8Array([1]) }), { code: 43 });
  const result = await service.deleteRecordings({ recordings: [{ storage: 'r2', storageId: 'a' }, { storage: 'r2', storageId: 'broken' }] });
  assert.deepEqual(result, { deleted: ['a'], failed: ['broken'] });
  assert.deepEqual(deleted, ['a']);
  assert.throws(() => learnerRecordingsSchema.parse({ recordings: [{ storage: 'ftp', storageId: 'a' }] }));
});

test('a teacher makes the model audio of a read-aloud text with the British machine voice', async () => {
  const asked = [];
  const { service, repository } = harness({
    async lookup(text, options) {
      asked.push([text, options]);
      return { found: true, phonetic: '', audio: { uk: Buffer.from([9, 9]), us: null } };
    },
    async download(reference) {
      return reference;
    },
  });
  await assert.rejects(() => service.createMachineAudio(student, { text: 'Hello' }), { code: 26 });
  await assert.rejects(() => service.createMachineAudio(manager, { text: 'Hello' }), { code: 26 });
  const { media } = await service.createMachineAudio(teacher, { text: 'The train leaves at nine.' });
  assert.deepEqual(asked, [['The train leaves at nine.', { accents: ['uk'] }]]);
  assert.equal(media.kind, 'audio');
  assert.equal(media.fileName, 'read-aloud-uk.mp3');
  assert.equal(media.url, 'https://media.test/1/read-aloud-uk.mp3');
  assert.equal(repository.tables.media.length, 1);
  assert.throws(() => practiceMachineAudioSchema.parse({ text: 'x'.repeat(501) }));
});

test('machine audio reports an unavailable voice', async () => {
  const { service } = harness({
    async lookup() {
      const error = new Error('down');
      error.name = 'PronunciationUnavailableError';
      throw error;
    },
  });
  await assert.rejects(() => service.createMachineAudio(teacher, { text: 'Hello' }), { status: 503 });
});
