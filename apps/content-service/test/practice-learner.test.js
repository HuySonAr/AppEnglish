import test from 'node:test';
import { readAloudSentences } from '@appenglish/content-contracts';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { PracticeService } from '../src/practice/practice.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
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
  const listening = new ListeningService(repository.listening, content);
  return { repository, uploads, deleted, listening, service: new PracticeService(repository.practice, content, { listening }) };
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
  assert.deepEqual(listed.prompts.map((item) => [item.id, item.title, item.level, item.versionNumber]), [[id, 'Train times', 'basic', 1]]);
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
  await service.createMachineAudio(teacher, { text: 'Slowly, please.', speed: 'slow' });
  assert.deepEqual(asked, [
    ['The train leaves at nine.', { accents: ['uk'], speed: { wordsPerMinute: 145, sentencePauseSeconds: 0.45 }, timeoutMs: 120000 }],
    ['Slowly, please.', { accents: ['uk'], speed: { wordsPerMinute: 130, sentencePauseSeconds: 0.8 }, timeoutMs: 120000 }],
  ]);
  assert.equal(media.kind, 'audio');
  assert.equal(media.fileName, 'read-aloud-uk-normal.mp3');
  assert.equal(media.url, 'https://media.test/1/read-aloud-uk-normal.mp3');
  assert.equal(repository.tables.media.length, 2);
  assert.throws(() => practiceMachineAudioSchema.parse({ text: 'x'.repeat(1001) }));
  assert.equal(practiceMachineAudioSchema.parse({ text: 'Hi' }).speed, 'normal');
  assert.throws(() => practiceMachineAudioSchema.parse({ text: 'Hi', speed: 'fast' }));
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

test('a teacher times each read-aloud sentence with Auto-time from the model audio', async () => {
  const { service, repository, listening } = harness();
  const { prompt } = await service.createPrompt(teacher, { kind: 'read_aloud' });
  const audioId = '11111111-1111-4111-8111-111111111111';
  repository.tables.media.push({ id: audioId, kind: 'audio', fileName: 'a.mp3', url: 'https://media.test/a.mp3', storage: 'r2' });
  const sentences = [
    { id: '22222222-2222-4222-8222-222222222222', text: 'The gate opens at 8 a.m.', translation: 'Cổng mở lúc 8 giờ sáng.', start: null, end: null },
    { id: '33333333-3333-4333-8333-333333333333', text: 'Thank you.', translation: '', start: null, end: null },
  ];
  await assert.rejects(() => service.requestAutoTime(teacher, prompt.id), { data: { reason: 'NO_AUDIO' } });
  await service.saveDraft(teacher, prompt.id, { content: { ...readAloud, text: 'The gate opens at 8 a.m.\nThank you.', audioMediaId: audioId, sentences } });
  await assert.rejects(() => service.requestAutoTime(student, prompt.id), { code: 26 });
  const { job } = await service.requestAutoTime(teacher, prompt.id);
  assert.equal(job.status, 'QUEUED');
  const event = repository.tables.contentEvents.at(-1);
  assert.deepEqual(event.payload.lines, sentences.map(({ id, text }) => ({ id, text })));
  assert.equal(event.payload.audioUrl, 'https://media.test/a.mp3');
  await listening.applyAutoTimeResult({ jobId: job.id, status: 'DONE', lines: [{ id: sentences[0].id, start: 0.2, end: 2.1, matched: 1 }, { id: sentences[1].id, start: 2.6, end: 3.4, matched: 1 }] });
  const done = (await service.getAutoTime(teacher, prompt.id)).job;
  assert.deepEqual([done.status, done.lines.map((line) => [line.start, line.end])], ['DONE', [[0.2, 2.1], [2.6, 3.4]]]);
  assert.equal((await listening.listNotifications(teacher)).notifications.some((item) => item.kind === 'SPEECH_JOB'), false);
  assert.deepEqual(readAloudSentences('The gate opens at 8 a.m. and closes at 9 p.m.\nThank you. Bye!'), ['The gate opens at 8 a.m. and closes at 9 p.m.', 'Thank you.', 'Bye!']);
});

test('picture and question prompts time their sample reading with Auto-time; picture instructions are optional', async () => {
  const { service, repository, listening } = harness();
  const audioId = '44444444-4444-4444-8444-444444444444';
  const imageId = '55555555-5555-4555-8555-555555555556';
  repository.tables.media.push({ id: audioId, kind: 'audio', fileName: 's.mp3', url: 'https://media.test/s.mp3', storage: 'r2' });
  repository.tables.media.push({ id: imageId, kind: 'image', fileName: 'p.png', url: 'https://media.test/p.png', storage: 'r2' });
  const sentence = { id: '66666666-6666-4666-8666-666666666666', text: 'A man is reading.', translation: 'Một người đàn ông đang đọc.', start: null, end: null };
  const picture = (await service.createPrompt(teacher, { kind: 'open_speaking' })).prompt;
  await service.saveDraft(teacher, picture.id, {
    content: { title: 'Park', topic: 'Daily life', etsTask: 'describe_picture', instructions: '', imageMediaId: imageId, sampleAnswer: 'A man is reading.', sampleAudioMediaId: audioId, sampleSentences: [sentence] },
  });
  assert.equal((await service.submitPrompt(teacher, picture.id)).prompt.status, 'PENDING_REVIEW');
  await assert.rejects(() => service.requestAutoTime(teacher, picture.id, { target: 'text' }), { data: { reason: 'NO_LINES' } });
  await service.withdrawPrompt(teacher, picture.id);
  const { job } = await service.requestAutoTime(teacher, picture.id, { target: 'sample' });
  assert.deepEqual(repository.tables.contentEvents.at(-1).payload.lines, [{ id: sentence.id, text: sentence.text }]);
  await listening.applyAutoTimeResult({ jobId: job.id, status: 'DONE', lines: [{ id: sentence.id, start: 0.1, end: 1.5, matched: 1 }] });
  assert.deepEqual((await service.getAutoTime(teacher, picture.id)).job.lines.map((line) => [line.start, line.end]), [[0.1, 1.5]]);
  await service.submitPrompt(teacher, picture.id);
  await service.approvePrompt(manager, picture.id);
  assert.equal((await service.listPublished()).prompts.find((item) => item.id === picture.id).imageUrl, 'https://media.test/p.png');

  const set = (await service.createPrompt(teacher, { kind: 'open_speaking' })).prompt;
  const question = (text) => ({ text, sampleAnswer: 'Twice a year.', audioMediaId: null, sampleAudioMediaId: audioId, sampleSentences: [{ ...sentence, text: 'Twice a year.' }] });
  await service.saveDraft(teacher, set.id, { content: { title: 'Travel', topic: 'Travel', etsTask: 'respond_questions', context: 'A survey about travel.', questions: [question('How often?'), question('Who with?'), question('Where?')] } });
  await service.requestAutoTime(teacher, set.id, { target: 'question', index: 2 });
  assert.deepEqual(repository.tables.contentEvents.at(-1).payload.lines, [{ id: sentence.id, text: 'Twice a year.' }]);
  const { media } = await service.getPrompt(teacher, set.id);
  assert.equal(media[audioId].url, 'https://media.test/s.mp3');
});
