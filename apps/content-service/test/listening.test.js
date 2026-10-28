import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { listeningContentSchema, listeningExerciseCreateSchema, listeningIssues, listeningTopicCreateSchema } from '../src/listening/listening.schemas.js';
import { LISTENING_TOEIC_KINDS, LISTENING_SONG_KIND, listeningKind } from '@appenglish/content-contracts';
import { admin, createMemoryRepository, manager, student, submitted, teacher, toeicTopicId } from './memory-repository.js';

async function harness() {
  const repository = createMemoryRepository();
  const uploads = [];
  const deleted = [];
  const storage = {
    async upload(input) {
      uploads.push(input);
      return { id: `stored-${uploads.length}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `https://media.test/${input.fileName}`, storage: 'r2' };
    },
    async delete(asset) {
      deleted.push(asset.id);
    },
  };
  const content = new ContentService(repository, storage);
  const service = new ListeningService(repository.listening, content);
  const upload = async (kind, fileName, mimeType) =>
    (await content.uploadMedia(teacher, { kind, fileName, mimeType, data: Buffer.from([1]), section: 'listening' })).media.id;
  return { repository, service, uploads, deleted, upload };
}

const kind = (key) => LISTENING_TOEIC_KINDS.find((item) => item.key === key);
const sentence = (text, start = null, end = null, speaker = '') => ({ text, start, end, speaker });

test('topics: every role lists them, an Admin or a Content Manager adds and renames them', async () => {
  const { service } = await harness();
  assert.deepEqual((await service.listTopics()).topics, [{ id: toeicTopicId, code: 'toeic', name: 'TOEIC', format: 'toeic', level: null, hasEditor: true }]);
  await assert.rejects(() => service.createTopic(student, { name: 'Songs' }), { code: 26, status: 403 });
  const songs = (await service.createTopic(admin, { name: 'Songs' })).topic;
  assert.deepEqual([songs.code, songs.hasEditor], ['songs', false]);
  const travel = (await service.createTopic(manager, { name: 'Daily life' })).topic;
  await assert.rejects(() => service.createTopic(manager, { name: 'SONGS' }), { code: 46, status: 409, data: { reason: 'NAME_TAKEN' } });
  await assert.rejects(() => service.updateTopic(admin, travel.id, { name: 'toeic' }), { code: 46 });
  assert.equal((await service.updateTopic(admin, travel.id, { name: 'Travel' })).topic.name, 'Travel');
  await assert.rejects(() => service.createTopic(teacher, { name: 'Test 1', format: 'toeic' }), { code: 26 });
  const test1 = (await service.createTopic(manager, { name: 'Test 1', format: 'toeic', level: 'basic' })).topic;
  assert.equal(test1.level, 'basic');
  assert.equal((await service.updateTopic(manager, test1.id, { level: 'advanced' })).topic.level, 'advanced');
  assert.equal((await service.updateTopic(manager, test1.id, { name: 'Test one' })).topic.level, 'advanced');
  assert.throws(() => listeningTopicCreateSchema.parse({ name: 'X', level: 'B1' }));
  assert.equal(listeningExerciseCreateSchema.parse({ topicId: toeicTopicId, title: 'T', kind: 'part1' }).level, 'B1');
  await assert.rejects(
    () => service.createExercise(teacher, { topicId: songs.id, title: 'Song 1', level: 'A2', kind: 'part1' }),
    { code: 46, data: { reason: 'NO_EDITOR' } },
  );
});

test('a teacher writes and saves a TOEIC dictation exercise and a Content Manager publishes it', async () => {
  const { service, upload, uploads, deleted, repository } = await harness();
  const input = { topicId: toeicTopicId, title: 'At the airport', level: 'B1', kind: 'part3' };
  for (const actor of [student, admin]) {
    await assert.rejects(() => service.listExercises(actor), { code: 26 });
    await assert.rejects(() => service.createExercise(actor, input), { code: 26 });
  }
  await assert.rejects(() => service.createExercise(manager, input), { code: 26 });
  const created = await service.createExercise(teacher, input);
  assert.deepEqual(created.exercise.topic, { id: toeicTopicId, code: 'toeic', name: 'TOEIC' });
  assert.deepEqual(created.draft, { versionNumber: 1, content: { audioMediaId: null, segments: [], source: { name: '', url: '' } }, status: 'DRAFT', reviewNote: null, editedBy: teacher.id, submittedAt: null, reviewedAt: null });
  const id = created.exercise.id;

  await assert.rejects(() => submitted(service.contentService, service, 'listeningExercise', id), (error) => {
    assert.equal(error.code, 42);
    assert.deepEqual(error.data.issues.map((issue) => issue.path), ['audioMediaId', 'segments']);
    return true;
  });

  const audioId = await upload('audio', 'airport.mp3', 'audio/mpeg');
  assert.equal(uploads[0].folder, 'audio/listening');
  const untimed = listeningContentSchema.parse({ audioMediaId: audioId, segments: [sentence('Where is gate 5?', null, null, 'Man')] });
  const saved = await service.saveDraft(teacher, id, untimed);
  assert.ok(saved.draft.content.segments[0].id);
  assert.equal(saved.media[audioId].url, 'https://media.test/airport.mp3');
  await assert.rejects(() => submitted(service.contentService, service, 'listeningExercise', id), (error) => {
    assert.deepEqual(error.data.issues, [{ path: 'segments[0].start', message: 'Start and end in the recording are required' }]);
    return true;
  });
  const timed = { ...saved.draft.content, segments: [{ ...saved.draft.content.segments[0], start: 0.5, end: 2.4 }, sentence("It's next to the café.", 2.6, 4.1, 'Woman')] };
  await service.saveDraft(teacher, id, listeningContentSchema.parse(timed));
  await submitted(service.contentService, service, 'listeningExercise', id);
  const published = await service.publish(manager, id);
  assert.deepEqual([published.draft, published.published.versionNumber, published.published.content.segments.length], [null, 1, 2]);

  const list = (await service.listExercises(teacher)).exercises;
  assert.deepEqual(list.map((item) => [item.title, item.level, item.kind, item.publishedVersionNumber, item.hasDraft, item.draftStatus]), [['At the airport', 'B1', 'part3', 1, false, null]]);
  assert.equal((await service.updateExercise(teacher, id, { level: 'B2' })).exercise.level, 'B2');

  const newAudio = await upload('audio', 'airport-2.mp3', 'audio/mpeg');
  await service.saveDraft(teacher, id, listeningContentSchema.parse({ ...timed, audioMediaId: newAudio }));
  const third = await upload('audio', 'airport-3.mp3', 'audio/mpeg');
  const again = await service.saveDraft(teacher, id, listeningContentSchema.parse({ ...timed, audioMediaId: third }));
  assert.equal(again.draft.versionNumber, 2);
  assert.deepEqual(deleted, [newAudio]);
  assert.ok(repository.tables.media.some((asset) => asset.id === audioId));
  await assert.rejects(() => service.getExercise(teacher, '99999999-9999-4999-8999-999999999999'), { code: 40, status: 404 });
});

test('publishing rules of the four TOEIC parts', () => {
  const audioId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const media = new Map([[audioId, { kind: 'audio' }]]);
  const issues = (key, segments) =>
    listeningIssues(listeningContentSchema.parse({ audioMediaId: audioId, segments }), kind(key), media).map((issue) => `${issue.path}: ${issue.message}`);
  const four = ['A man is reading.', 'A man is running.', 'A man is cooking.', 'A man is sleeping.'].map((text) => sentence(text));
  assert.deepEqual(issues('part1', four), []);
  assert.deepEqual(issues('part2', four.slice(0, 3)), ['segments: Part 2 has exactly 4 sentences to write down']);
  assert.deepEqual(issues('part1', [...four.slice(0, 3), sentence('')]), ['segments[3].text: Required']);
  assert.deepEqual(issues('part1', [sentence('One', 1, null), ...four.slice(1)]), ['segments[0].start: Give both the start and the end']);
  assert.deepEqual(issues('part4', [sentence('First.', 0, 2), sentence('Second.', 2, 5)]), []);
  assert.deepEqual(issues('part4', [sentence('First.', 3, 2)]), ['segments[0].end: The end must come after the start']);
  assert.deepEqual(issues('part4', [sentence('First.', 4, 6), sentence('Second.', 1, 3)]), ['segments[1].start: Sentences must follow the order of the recording']);
  assert.deepEqual(
    listeningIssues(listeningContentSchema.parse({ audioMediaId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', segments: four }), kind('part1'), media).map((issue) => issue.path),
    ['audioMediaId'],
  );
});

test('learning-service reads the published exercises and one paper', async () => {
  const { service, upload } = await harness();
  const draftOnly = await service.createExercise(teacher, { topicId: toeicTopicId, title: 'Draft only', level: 'A1', kind: 'part4' });
  const { exercise } = await service.createExercise(teacher, { topicId: toeicTopicId, title: 'Photo', level: 'A2', kind: 'part1' });
  const audioId = await upload('audio', 'photo.mp3', 'audio/mpeg');
  const four = ['One.', 'Two.', 'Three.', 'Four.'].map((text) => sentence(text));
  await service.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: four }));
  await submitted(service.contentService, service, 'listeningExercise', exercise.id);
  const { published } = await service.publish(manager, exercise.id);
  const list = await service.listPublished();
  assert.deepEqual(list.exercises.map((item) => [item.title, item.segmentCount, item.topic.name]), [['Photo', 4, 'TOEIC']]);
  assert.equal(list.topics.length, 1);
  const paper = await service.getPaper(exercise.id);
  assert.deepEqual([paper.versionId, paper.content.segments[1].text, paper.media[audioId].url], [published.versionId, 'Two.', 'https://media.test/photo.mp3']);
  await assert.rejects(() => service.getPaper(draftOnly.exercise.id), { code: 40, status: 404 });
});

test('a topic gets a format, and songs are written with [blanks] (D88)', async () => {
  const { service, upload } = await harness();
  const songs = (await service.createTopic(admin, { name: 'Songs', format: 'song' })).topic;
  assert.deepEqual([songs.format, songs.hasEditor], ['song', true]);
  const later = (await service.createTopic(manager, { name: 'News' })).topic;
  assert.deepEqual([later.format, later.hasEditor], [null, false]);
  assert.equal((await service.updateTopic(manager, later.id, { format: 'toeic' })).topic.hasEditor, true);
  await assert.rejects(() => service.createExercise(teacher, { topicId: songs.id, title: 'X', level: 'A2', kind: 'part1' }), { code: 46, data: { reason: 'KIND_MISMATCH' } });
  await assert.rejects(() => service.createExercise(teacher, { topicId: toeicTopicId, title: 'X', level: 'A2', kind: 'song' }), { code: 46, data: { reason: 'KIND_MISMATCH' } });
  const { exercise } = await service.createExercise(teacher, { topicId: songs.id, title: 'Home', level: 'A2', kind: 'song' });
  await assert.rejects(() => service.updateTopic(admin, songs.id, { format: 'toeic' }), { code: 46, data: { reason: 'HAS_EXERCISES' } });
  assert.equal((await service.updateTopic(admin, songs.id, { name: 'Music', format: 'song' })).topic.name, 'Music');
  await assert.rejects(() => service.deleteTopic(admin, songs.id), { code: 46, data: { reason: 'HAS_EXERCISES', exerciseCount: 1 } });
  await assert.rejects(() => service.deleteTopic({ id: songs.id, role: 'STUDENT' }, later.id));
  assert.deepEqual((await service.deleteTopic(manager, later.id)).deleted, { id: later.id });
  assert.equal((await service.listTopics()).topics.some((topic) => topic.id === later.id), false);
  await assert.rejects(() => service.deleteTopic(manager, later.id), { code: 40 });

  const audioId = await upload('audio', 'home.mp3', 'audio/mpeg');
  const lines = [sentence('I [walked] across an [empty] land', 0, 3), sentence('I knew the pathway like the back of my hand', 3, 7)];
  await service.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: lines }));
  await submitted(service.contentService, service, 'listeningExercise', exercise.id);
  await service.publish(manager, exercise.id);
  const listed = (await service.listPublished()).exercises.find((item) => item.id === exercise.id);
  assert.deepEqual([listed.kind, listed.segmentCount, listed.blankCount], ['song', 2, 2]);
});

test('publishing rules of a song', () => {
  const audioId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const media = new Map([[audioId, { kind: 'audio' }]]);
  const issues = (segments) =>
    listeningIssues(listeningContentSchema.parse({ audioMediaId: audioId, segments }), LISTENING_SONG_KIND, media).map((issue) => `${issue.path}: ${issue.message}`);
  assert.deepEqual(issues([sentence('No blank at all', 0, 2), sentence('One [blank] here', 2, 4)]), []);
  assert.deepEqual(issues([sentence('Untimed line')]), ['segments[0].start: Start and end in the recording are required']);
  assert.deepEqual(issues([sentence('An empty [ ] blank', 0, 2)]), ['segments[0].text: A blank [ ] needs the word inside']);
  assert.deepEqual(issues([sentence('An [open blank', 0, 2)]), ['segments[0].text: A bracket is not closed: write a blank as [word]']);
});

test('auto-time sends the saved lines to speech-service and keeps its answer (D97)', async () => {
  const { repository, upload } = await harness();
  const content = new ContentService(repository, { async upload(input) { return { id: 's', kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: 1, url: `https://media.test/${input.fileName}`, storage: 'r2' }; }, async delete() {} });
  const sent = [];
  const broker = { ready: false, publish: (message) => sent.push(message) > 0 };
  let clock = new Date();
  const service = new ListeningService(repository.listening, content, { broker, now: () => clock });
  const { exercise } = await service.createExercise(teacher, { topicId: toeicTopicId, title: 'Talk', level: 'B1', kind: 'part4' });
  await assert.rejects(() => service.requestAutoTime(teacher, exercise.id), { code: 41, data: { reason: 'NO_AUDIO' } });
  const audioId = (await content.uploadMedia(teacher, { kind: 'audio', fileName: 't.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]), section: 'listening' })).media.id;
  await service.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: [] }));
  await assert.rejects(() => service.requestAutoTime(teacher, exercise.id), { code: 41, data: { reason: 'NO_LINES' } });
  const saved = await service.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: [sentence('Attention, passengers.'), sentence('The train is late.')] }));
  const [first, second] = saved.draft.content.segments;
  await assert.rejects(() => service.requestAutoTime(student, exercise.id), { code: 26 });

  const { job } = await service.requestAutoTime(teacher, exercise.id);
  assert.deepEqual([job.task, job.status, job.lineCount, job.lines], ['align', 'QUEUED', 2, []]);
  assert.deepEqual(repository.tables.contentEvents.map((event) => event.payload), [{ jobId: job.id, task: 'align', audioUrl: 'https://media.test/t.mp3', language: 'en', kind: 'part4', lines: [{ id: first.id, text: 'Attention, passengers.' }, { id: second.id, text: 'The train is late.' }] }]);
  assert.equal((await service.requestAutoTime(teacher, exercise.id)).job.id, job.id);
  assert.equal(repository.tables.contentEvents.length, 1);
  assert.equal(repository.tables.contentEvents[0].type, 'speech.job.requested');

  await service.onAutoTimeResult({ jobId: job.id, status: 'RUNNING' });
  assert.equal((await service.getAutoTime(teacher, exercise.id)).job.status, 'RUNNING');
  await service.onAutoTimeResult({ jobId: job.id, status: 'DONE', lines: 'nope' });
  await service.onAutoTimeResult({
    jobId: job.id,
    status: 'DONE',
    lines: [{ id: first.id, start: 0.4, end: 1.9, matched: 1 }, { id: second.id, start: 2.1, end: 3.5, matched: 0.75 }, { id: '99999999-9999-4999-8999-999999999999', start: 0, end: 1, matched: 1 }],
  });
  const done = (await service.getAutoTime(teacher, exercise.id)).job;
  assert.deepEqual([done.status, done.lines.map((line) => [line.start, line.end, line.matched])], ['DONE', [[0.4, 1.9, 1], [2.1, 3.5, 0.75]]]);
  await service.onAutoTimeResult({ jobId: job.id, status: 'FAILED', error: 'late' });
  assert.equal((await service.getAutoTime(teacher, exercise.id)).job.status, 'DONE');

  const second2 = (await service.requestAutoTime(teacher, exercise.id)).job;
  clock = new Date(Date.now() + 31 * 60 * 1000);
  const late = (await service.getAutoTime(teacher, exercise.id)).job;
  assert.deepEqual([late.id, late.status], [second2.id, 'FAILED']);
  assert.notEqual((await service.requestAutoTime(teacher, exercise.id)).job.id, second2.id);
});

test('transcribe asks for the lines of the recording alone and keeps the lines heard (D98)', async () => {
  const { repository } = await harness();
  const content = new ContentService(repository, { async upload(input) { return { id: 's', kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: 1, url: `https://media.test/${input.fileName}`, storage: 'r2' }; }, async delete() {} });
  const sent = [];
  const service = new ListeningService(repository.listening, content, { broker: { ready: true, publish: (message) => sent.push(message) > 0 } });
  const songs = (await service.createTopic(admin, { name: 'Songs', format: 'song' })).topic;
  const { exercise } = await service.createExercise(teacher, { topicId: songs.id, title: 'Home', level: 'A2', kind: 'song' });
  const audioId = (await content.uploadMedia(teacher, { kind: 'audio', fileName: 's.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]), section: 'listening' })).media.id;
  await service.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: [] }));
  const { job } = await service.requestTranscribe(teacher, exercise.id);
  assert.deepEqual([job.task, job.status, job.lineCount], ['transcribe', 'QUEUED', 0]);
  assert.deepEqual(repository.tables.contentEvents.map((event) => event.payload), [{ jobId: job.id, task: 'transcribe', audioUrl: 'https://media.test/s.mp3', language: 'en', kind: 'song', lines: [] }]);
  assert.equal((await service.requestAutoTime(teacher, exercise.id).catch((error) => error)).code, 41);

  await service.onAutoTimeResult({
    jobId: job.id,
    status: 'DONE',
    lines: [{ text: ' Love in your eyes ', start: 10.8, end: 13.2 }, { text: '   ', start: 14, end: 15 }, { text: 'Sitting silent by my side', start: 13.8, end: 16.6 }],
  });
  const done = (await service.getAutoTime(teacher, exercise.id)).job;
  assert.deepEqual([done.task, done.status, done.lineCount, done.lines], ['transcribe', 'DONE', 2, [{ text: 'Love in your eyes', start: 10.8, end: 13.2 }, { text: 'Sitting silent by my side', start: 13.8, end: 16.6 }]]);
});

test('talks and news (D155): conversation and talk kinds, and a credited source', () => {
  assert.deepEqual(listeningKind('talk'), { key: 'talk', number: null, title: 'Talk', segmentCount: null, timed: true, labels: null });
  assert.equal(listeningKind('conversation').speakers, true);
  const sourced = listeningContentSchema.parse({ source: { name: 'VOA Learning English', url: 'https://learningenglish.voanews.com/a/7000000.html' } });
  assert.deepEqual(sourced.source, { name: 'VOA Learning English', url: 'https://learningenglish.voanews.com/a/7000000.html' });
  assert.throws(() => listeningContentSchema.parse({ source: { name: 'x', url: 'not a link' } }));
});


test('a teacher is told when a speech job of theirs finishes or fails (D163)', async () => {
  const { repository } = await harness();
  const content = new ContentService(repository, { async upload(input) { return { id: 's', kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: 1, url: `https://media.test/${input.fileName}`, storage: 'r2' }; }, async delete() {} });
  const service = new ListeningService(repository.listening, content, { broker: { ready: true, publish: () => true } });
  const songs = (await service.createTopic(admin, { name: 'Songs', format: 'song' })).topic;
  const { exercise } = await service.createExercise(teacher, { topicId: songs.id, title: 'Home', level: 'A2', kind: 'song' });
  const audioId = (await content.uploadMedia(teacher, { kind: 'audio', fileName: 's.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]), section: 'listening' })).media.id;
  await service.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: [] }));
  const { job } = await service.requestTranscribe(teacher, exercise.id);
  assert.deepEqual((await service.listNotifications(teacher)).notifications, []);
  await assert.rejects(() => service.listNotifications(student), { code: 26 });

  await service.onAutoTimeResult({ jobId: job.id, status: 'FAILED', error: 'No speech found' });
  const listed = await service.listNotifications(teacher);
  assert.equal(listed.unread, 1);
  assert.deepEqual(listed.notifications.map((item) => [item.kind, item.data.task, item.data.status, item.data.error, item.data.owner, item.read]), [
    ['SPEECH_JOB', 'transcribe', 'FAILED', 'No speech found', { type: 'exercise', id: exercise.id, title: 'Home' }, false],
  ]);
  assert.deepEqual(await service.markNotificationsRead(teacher, {}), { unread: 0 });
  assert.equal((await service.listNotifications(teacher)).notifications[0].read, true);
});

test('an admin is told when content is taken down and when speech jobs fail (D164)', async () => {
  const { repository } = await harness();
  const content = new ContentService(repository, { async upload(input) { return { id: 's', kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: 1, url: `https://media.test/${input.fileName}`, storage: 'r2' }; }, async delete() {} });
  const service = new ListeningService(repository.listening, content, { broker: { ready: true, publish: () => true } });
  const songs = (await service.createTopic(admin, { name: 'Songs', format: 'song' })).topic;
  const { exercise } = await service.createExercise(teacher, { topicId: songs.id, title: 'Home', level: 'A2', kind: 'song' });
  const audioId = (await content.uploadMedia(teacher, { kind: 'audio', fileName: 's.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]), section: 'listening' })).media.id;
  await service.saveDraft(teacher, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: [sentence('I [walked] home', 0, 2)] }));
  await submitted(service.contentService, service, 'listeningExercise', exercise.id);
  await service.publish(manager, exercise.id);
  await assert.rejects(() => service.listAdminNotifications(manager), { code: 26 });
  assert.deepEqual((await service.listAdminNotifications(admin)).notifications, []);

  await service.unpublish(manager, exercise.id);
  await service.unpublish(manager, exercise.id);
  const { job } = await service.requestTranscribe(teacher, exercise.id);
  await service.onAutoTimeResult({ jobId: job.id, status: 'FAILED', error: 'The speech service is down' });
  const listed = await service.listAdminNotifications(admin);
  assert.equal(listed.unread, 2);
  const byKind = Object.fromEntries(listed.notifications.map((item) => [item.kind, item]));
  assert.deepEqual(byKind.CONTENT_UNPUBLISHED.data, { type: 'exercise', id: exercise.id, title: 'Home', by: manager.id });
  assert.deepEqual([byKind.SPEECH_FAILURES.data.count, byKind.SPEECH_FAILURES.data.lastError], [1, 'The speech service is down']);

  assert.deepEqual(await service.markAdminNotificationsRead(admin, { ids: [byKind.CONTENT_UNPUBLISHED.id] }), { unread: 1 });
  assert.deepEqual(await service.markAdminNotificationsRead(admin, {}), { unread: 0 });
  assert.equal((await service.listAdminNotifications({ ...admin, id: '99999999-9999-4999-8999-999999999999' })).unread, 2);
});

test('a TOEIC topic holds tests; each exercise belongs to one test of its topic', async () => {
  const { service } = await harness();
  await assert.rejects(() => service.createTest(student, { topicId: toeicTopicId, name: 'Test 1' }), { code: 26 });
  const first = (await service.createTest(teacher, { topicId: toeicTopicId, name: 'Test 1' })).test;
  const second = (await service.createTest(manager, { topicId: toeicTopicId, name: 'Test 2' })).test;
  await assert.rejects(() => service.createTest(teacher, { topicId: toeicTopicId, name: 'test 1' }), { code: 46, data: { reason: 'NAME_TAKEN' } });
  const songs = (await service.createTopic(admin, { name: 'Songs', format: 'song' })).topic;
  await assert.rejects(() => service.createTest(teacher, { topicId: songs.id, name: 'Test 1' }), { data: { reason: 'NOT_TOEIC' } });
  assert.deepEqual((await service.listTests()).tests.map((test) => test.name), ['Test 1', 'Test 2']);

  const one = (await service.createExercise(teacher, { topicId: toeicTopicId, title: 'Exercise 1', kind: 'part1', testId: first.id })).exercise;
  const two = (await service.createExercise(teacher, { topicId: toeicTopicId, title: 'Exercise 2', kind: 'part1', testId: first.id })).exercise;
  assert.deepEqual([one.test, two.test.name], [{ id: first.id, name: 'Test 1' }, 'Test 1']);
  const moved = await service.updateExercise(teacher, two.id, { testId: second.id });
  assert.equal(moved.exercise.test.name, 'Test 2');
  await assert.rejects(() => service.updateExercise(teacher, two.id, { testId: '99999999-9999-4999-8999-999999999999' }), { data: { reason: 'NO_TEST' } });

  assert.equal((await service.updateTest(teacher, second.id, { name: 'Test two' })).test.name, 'Test two');
  await assert.rejects(() => service.deleteTest(teacher, second.id), { data: { reason: 'HAS_EXERCISES', exerciseCount: 1 } });
  const third = (await service.createTest(teacher, { topicId: toeicTopicId, name: 'Test 3' })).test;
  assert.deepEqual(await service.deleteTest(teacher, third.id), { deleted: { id: third.id } });
  const listed = (await service.listExercises(teacher)).exercises;
  assert.deepEqual(listed.map((exercise) => [exercise.title, exercise.test?.name]), [['Exercise 1', 'Test 1'], ['Exercise 2', 'Test two']]);
});
