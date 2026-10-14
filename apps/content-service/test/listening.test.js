import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { listeningContentSchema, listeningIssues } from '../src/listening/listening.schemas.js';
import { LISTENING_TOEIC_KINDS, LISTENING_SONG_KIND } from '@appenglish/content-contracts';
import { admin, createMemoryRepository, manager, student, toeicTopicId } from './memory-repository.js';

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
    (await content.uploadMedia(manager, { kind, fileName, mimeType, data: Buffer.from([1]), section: 'listening' })).media.id;
  return { repository, service, uploads, deleted, upload };
}

const kind = (key) => LISTENING_TOEIC_KINDS.find((item) => item.key === key);
const sentence = (text, start = null, end = null, speaker = '') => ({ text, start, end, speaker });

test('topics: every role lists them, an Admin or a Content Manager adds and renames them', async () => {
  const { service } = await harness();
  assert.deepEqual((await service.listTopics()).topics, [{ id: toeicTopicId, code: 'toeic', name: 'TOEIC', format: 'toeic', hasEditor: true }]);
  await assert.rejects(() => service.createTopic(student, { name: 'Songs' }), { code: 26, status: 403 });
  const songs = (await service.createTopic(admin, { name: 'Songs' })).topic;
  assert.deepEqual([songs.code, songs.hasEditor], ['songs', false]);
  const travel = (await service.createTopic(manager, { name: 'Daily life' })).topic;
  await assert.rejects(() => service.createTopic(manager, { name: 'SONGS' }), { code: 46, status: 409, data: { reason: 'NAME_TAKEN' } });
  await assert.rejects(() => service.updateTopic(admin, travel.id, { name: 'toeic' }), { code: 46 });
  assert.equal((await service.updateTopic(admin, travel.id, { name: 'Travel' })).topic.name, 'Travel');
  // Exercises are written only for a topic with an editor.
  await assert.rejects(
    () => service.createExercise(manager, { topicId: songs.id, title: 'Song 1', level: 'A2', kind: 'part1' }),
    { code: 46, data: { reason: 'NO_EDITOR' } },
  );
});

test('a Content Manager writes, saves and publishes a TOEIC dictation exercise', async () => {
  const { service, upload, uploads, deleted, repository } = await harness();
  const input = { topicId: toeicTopicId, title: 'At the airport', level: 'B1', kind: 'part3' };
  for (const actor of [student, admin]) {
    await assert.rejects(() => service.listExercises(actor), { code: 26 });
    await assert.rejects(() => service.createExercise(actor, input), { code: 26 });
  }
  const created = await service.createExercise(manager, input);
  assert.deepEqual(created.exercise.topic, { id: toeicTopicId, code: 'toeic', name: 'TOEIC' });
  assert.deepEqual(created.draft, { versionNumber: 1, content: { audioMediaId: null, segments: [] } });
  const id = created.exercise.id;

  // An empty draft cannot be published.
  await assert.rejects(() => service.publish(manager, id), (error) => {
    assert.equal(error.code, 42);
    assert.deepEqual(error.data.issues.map((issue) => issue.path), ['audioMediaId', 'segments']);
    return true;
  });

  const audioId = await upload('audio', 'airport.mp3', 'audio/mpeg');
  assert.equal(uploads[0].folder, 'audio/listening');
  const untimed = listeningContentSchema.parse({ audioMediaId: audioId, segments: [sentence('Where is gate 5?', null, null, 'Man')] });
  const saved = await service.saveDraft(manager, id, untimed);
  assert.ok(saved.draft.content.segments[0].id);
  assert.equal(saved.media[audioId].url, 'https://media.test/airport.mp3');
  // Parts 3 and 4: every sentence needs its place in the recording.
  await assert.rejects(() => service.publish(manager, id), (error) => {
    assert.deepEqual(error.data.issues, [{ path: 'segments[0].start', message: 'Start and end in the recording are required' }]);
    return true;
  });
  const timed = { ...saved.draft.content, segments: [{ ...saved.draft.content.segments[0], start: 0.5, end: 2.4 }, sentence("It's next to the café.", 2.6, 4.1, 'Woman')] };
  await service.saveDraft(manager, id, listeningContentSchema.parse(timed));
  const published = await service.publish(manager, id);
  assert.deepEqual([published.draft, published.published.versionNumber, published.published.content.segments.length], [null, 1, 2]);

  const list = (await service.listExercises(manager)).exercises;
  assert.deepEqual(list.map((item) => [item.title, item.level, item.kind, item.publishedVersionNumber, item.hasDraft]), [['At the airport', 'B1', 'part3', 1, false]]);
  // Title and level change at once; the kind does not.
  assert.equal((await service.updateExercise(manager, id, { level: 'B2' })).exercise.level, 'B2');

  // A new draft that drops the recording deletes the file, unless the
  // published version still uses it.
  const newAudio = await upload('audio', 'airport-2.mp3', 'audio/mpeg');
  await service.saveDraft(manager, id, listeningContentSchema.parse({ ...timed, audioMediaId: newAudio }));
  const third = await upload('audio', 'airport-3.mp3', 'audio/mpeg');
  const again = await service.saveDraft(manager, id, listeningContentSchema.parse({ ...timed, audioMediaId: third }));
  assert.equal(again.draft.versionNumber, 2);
  assert.deepEqual(deleted, [newAudio]);
  assert.ok(repository.tables.media.some((asset) => asset.id === audioId));
  await assert.rejects(() => service.getExercise(manager, '99999999-9999-4999-8999-999999999999'), { code: 40, status: 404 });
});

test('publishing rules of the four TOEIC parts', () => {
  const audioId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const media = new Map([[audioId, { kind: 'audio' }]]);
  const issues = (key, segments) =>
    listeningIssues(listeningContentSchema.parse({ audioMediaId: audioId, segments }), kind(key), media).map((issue) => `${issue.path}: ${issue.message}`);
  const four = ['A man is reading.', 'A man is running.', 'A man is cooking.', 'A man is sleeping.'].map((text) => sentence(text));
  // Parts 1 and 2: four sentences, times optional.
  assert.deepEqual(issues('part1', four), []);
  assert.deepEqual(issues('part2', four.slice(0, 3)), ['segments: Part 2 has exactly 4 sentences to write down']);
  assert.deepEqual(issues('part1', [...four.slice(0, 3), sentence('')]), ['segments[3].text: Required']);
  assert.deepEqual(issues('part1', [sentence('One', 1, null), ...four.slice(1)]), ['segments[0].start: Give both the start and the end']);
  // Parts 3 and 4: any number of sentences, each timed, in order.
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
  const draftOnly = await service.createExercise(manager, { topicId: toeicTopicId, title: 'Draft only', level: 'A1', kind: 'part4' });
  const { exercise } = await service.createExercise(manager, { topicId: toeicTopicId, title: 'Photo', level: 'A2', kind: 'part1' });
  const audioId = await upload('audio', 'photo.mp3', 'audio/mpeg');
  const four = ['One.', 'Two.', 'Three.', 'Four.'].map((text) => sentence(text));
  await service.saveDraft(manager, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: four }));
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
  // A song topic only has songs, a TOEIC topic only parts.
  await assert.rejects(() => service.createExercise(manager, { topicId: songs.id, title: 'X', level: 'A2', kind: 'part1' }), { code: 46, data: { reason: 'KIND_MISMATCH' } });
  await assert.rejects(() => service.createExercise(manager, { topicId: toeicTopicId, title: 'X', level: 'A2', kind: 'song' }), { code: 46, data: { reason: 'KIND_MISMATCH' } });
  const { exercise } = await service.createExercise(manager, { topicId: songs.id, title: 'Home', level: 'A2', kind: 'song' });
  // The format is fixed once the topic has exercises; renaming still works.
  await assert.rejects(() => service.updateTopic(admin, songs.id, { format: 'toeic' }), { code: 46, data: { reason: 'HAS_EXERCISES' } });
  assert.equal((await service.updateTopic(admin, songs.id, { name: 'Music', format: 'song' })).topic.name, 'Music');

  const audioId = await upload('audio', 'home.mp3', 'audio/mpeg');
  const lines = [sentence('I [walked] across an [empty] land', 0, 3), sentence('I knew the pathway like the back of my hand', 3, 7)];
  await service.saveDraft(manager, exercise.id, listeningContentSchema.parse({ audioMediaId: audioId, segments: lines }));
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
