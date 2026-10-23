import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { CourseService } from '../src/course/course.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { courseItemCreateSchema } from '../src/course/course.schemas.js';
import { admin, createMemoryRepository, manager, student } from './memory-repository.js';

async function harness() {
  const repository = createMemoryRepository();
  const deleted = [];
  const storage = {
    async upload(input) {
      return { id: 's', kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: 1, url: `https://media.test/${input.fileName}`, storage: 'r2' };
    },
    async delete(asset) {
      deleted.push(asset.fileName);
    },
  };
  const content = new ContentService(repository, storage);
  const published = [];
  const broker = { ready: true, publish: (message) => (published.push(message), true) };
  const listening = new ListeningService(repository.listening, content, { broker });
  const service = new CourseService(repository.course, content, listening);
  const upload = async (fileName) =>
    (await content.uploadMedia(manager, { kind: 'audio', fileName, mimeType: 'audio/mpeg', data: Buffer.from([1]), section: 'listening' })).media.id;
  return { service, repository, content, listening, upload, deleted, published };
}

const LINES = ['Can I help you?', 'Yes, a coffee please.', 'Small or large?', 'Large, please.'];
const timedSegments = () =>
  LINES.map((text, index) => ({
    speaker: index % 2 ? 'Woman' : 'Man',
    text,
    start: index * 2,
    end: index * 2 + 1.5,
    translation: `Câu ${index + 1}`,
    gap: index === 1 ? 'Yes, a [coffee] please.' : '',
  }));

const question = (prompt, correct = 0) => ({
  skill: 'detail',
  prompt,
  options: ['A coffee', 'A tea', 'A cake'].map((text, index) => ({ text, isCorrect: index === correct })),
  explanation: 'She asks for a coffee.',
});

async function completeTopic(h, overrides = {}) {
  const words = await Promise.all(['coffee', 'large', 'small', 'help'].map(async (word) => ({ word, phonetic: `/${word}/`, meaning: `nghĩa ${word}`, audioMediaId: await h.upload(`${word}.mp3`) })));
  return {
    audioMediaId: await h.upload('shop.mp3'),
    segments: timedSegments(),
    vocabulary: words,
    questions: [question('What does she buy?')],
    ordering: { enabled: true, prompt: 'Put the ideas in order', items: ['He offers help', 'She asks for coffee', 'She chooses a size'].map((text) => ({ text })) },
    ...overrides,
  };
}

test('levels A1–C2 hold topics in order and a level test for every level but the last', async () => {
  const { service } = await harness();
  await assert.rejects(() => service.listCourse(student), { code: 26 });
  await assert.rejects(() => service.listCourse(admin), { code: 26 });

  const first = await service.createItem(manager, courseItemCreateSchema.parse({ level: 'A1', type: 'topic', title: 'Greetings' }));
  const second = await service.createItem(manager, courseItemCreateSchema.parse({ level: 'A1', type: 'topic', title: 'Numbers' }));
  await service.createItem(manager, courseItemCreateSchema.parse({ level: 'A1', type: 'level_test', title: 'A1 test' }));
  await assert.rejects(() => service.createItem(manager, courseItemCreateSchema.parse({ level: 'A1', type: 'level_test', title: 'Again' })), { code: 41 });
  assert.throws(() => courseItemCreateSchema.parse({ level: 'C2', type: 'level_test', title: 'No' }), /last level/);
  assert.throws(() => courseItemCreateSchema.parse({ level: 'A1', type: 'unit', title: 'Old' }));
  assert.throws(() => courseItemCreateSchema.parse({ level: 'A1', type: 'topic', title: 'X', section: 'social_and_travel' }));

  const course = await service.listCourse(manager);
  assert.deepEqual(course.levels.map((level) => level.level), ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  assert.deepEqual(course.levels[0].topics.map((topic) => [topic.title, topic.position]), [['Greetings', 1], ['Numbers', 2]]);
  assert.equal(course.levels[0].levelTest.title, 'A1 test');
  assert.equal('placement' in course, false);

  await service.updateItem(manager, second.item.id, { position: 1 });
  assert.deepEqual((await service.listCourse(manager)).levels[0].topics.map((topic) => topic.title), ['Numbers', 'Greetings']);
  await service.delete(manager, second.item.id);
  assert.deepEqual((await service.listCourse(manager)).levels[0].topics.map((topic) => [topic.title, topic.position]), [['Greetings', 1]]);
  assert.equal(first.draft.content.ordering.enabled, false);
});

test('a topic is published when its recording, words, questions, ordering and sentences are complete', async () => {
  const h = await harness();
  const { item } = await h.service.createItem(manager, courseItemCreateSchema.parse({ level: 'A2', type: 'topic', title: 'At the shop' }));
  await assert.rejects(() => h.service.publish(manager, item.id), (error) => {
    const paths = error.data.issues.map((issue) => issue.path);
    return ['audioMediaId', 'segments', 'vocabulary', 'questions'].every((path) => paths.includes(path));
  });

  const broken = await completeTopic(h, {
    vocabulary: (await completeTopic(h)).vocabulary.slice(0, 3).map((word, index) => (index === 0 ? { ...word, phonetic: '', audioMediaId: null } : word)),
    ordering: { enabled: true, prompt: '', items: [{ text: 'One' }, { text: 'one' }, { text: 'Two' }] },
    segments: timedSegments().map((segment, index) => ({
      ...segment,
      translation: index === 0 ? '' : 'x',
      gap: index === 1 ? 'Yes, a [coffee] please.' : index === 2 ? 'Small or [big]?' : index === 3 ? 'Large, please.' : '',
      start: index === 3 ? null : segment.start,
    })),
  });
  await h.service.saveDraft(manager, item.id, broken);
  await assert.rejects(() => h.service.publish(manager, item.id), (error) => {
    const messages = error.data.issues.map((issue) => `${issue.path}: ${issue.message}`);
    assert.ok(messages.includes('vocabulary: 4 to 6 words are needed'), messages.join('\n'));
    assert.ok(messages.includes('vocabulary[0].phonetic: Add the IPA'));
    assert.ok(messages.includes('vocabulary[0].audioMediaId: Add the pronunciation'));
    assert.ok(messages.includes('ordering.items: Items must be different'));
    assert.ok(messages.includes('segments[0].translation: Translate sentence 1'));
    assert.ok(messages.includes('segments[2].gap: Sentence 3 with its blanks must keep the words of the sentence'));
    assert.ok(messages.includes('segments[3].gap: Mark the words to write in sentence 4 with [brackets], or leave it empty'));
    assert.ok(messages.includes('segments[3].start: Sentence 4 needs its start and end (Auto-time)'));
    return true;
  });

  const ready = await completeTopic(h);
  const saved = await h.service.saveDraft(manager, item.id, ready);
  assert.ok(saved.draft.content.vocabulary.every((word) => word.id));
  assert.ok(saved.draft.content.ordering.items.every((idea) => idea.id));
  assert.ok(saved.draft.content.segments.every((segment) => segment.id));
  assert.equal(Object.keys(saved.media).length, 5);
  assert.deepEqual(saved.media[ready.audioMediaId], { kind: 'audio', fileName: 'shop.mp3', url: 'https://media.test/shop.mp3' });
  const published = await h.service.publish(manager, item.id);
  assert.equal(published.published.versionNumber, 1);
  const summary = (await h.service.listCourse(manager)).levels[1].topics[0];
  assert.deepEqual([summary.publishedVersionNumber, summary.questions, summary.words, summary.hasRecording, summary.ordering], [1, 1, 4, true, true]);
});

test('learning-service reads the published course and a topic with its answers and media', async () => {
  const h = await harness();
  const { item } = await h.service.createItem(manager, courseItemCreateSchema.parse({ level: 'A2', type: 'topic', title: 'At the shop' }));
  await h.service.saveDraft(manager, item.id, await completeTopic(h));
  await h.service.publish(manager, item.id);
  const test1 = await h.service.createItem(manager, courseItemCreateSchema.parse({ level: 'A2', type: 'level_test', title: 'A2 test' }));
  const section = { audioMediaId: null, transcript: '', questions: Array.from({ length: 8 }, (_, index) => question(`Q${index + 1}?`)) };
  await h.service.saveDraft(manager, test1.item.id, { sections: [section] });
  await assert.rejects(() => h.service.publish(manager, test1.item.id), (error) => {
    const paths = error.data.issues.map((issue) => issue.path);
    return paths.includes('sections[0].audioMediaId') && paths.includes('sections[0].transcript');
  });
  const testAudio = await h.upload('test.mp3');
  await h.service.saveDraft(manager, test1.item.id, { sections: [{ ...section, audioMediaId: testAudio, transcript: LINES.join('\n') }] });
  await h.service.publish(manager, test1.item.id);
  await h.service.createItem(manager, courseItemCreateSchema.parse({ level: 'A2', type: 'topic', title: 'Draft only' }));

  const course = await h.service.listPublished();
  const a2 = course.levels.find((level) => level.level === 'A2');
  assert.deepEqual(a2.topics.map((topic) => [topic.title, topic.questionCount]), [['At the shop', 1]]);
  assert.equal(a2.levelTest.questionCount, 8);
  assert.equal(course.levels.find((level) => level.level === 'C2').levelTest, null);

  const paper = await h.service.getPaper(item.id);
  assert.equal(paper.item.type, 'topic');
  assert.equal(paper.content.segments.length, 4);
  assert.equal(paper.media[paper.content.audioMediaId], 'https://media.test/shop.mp3');
  const testPaper = await h.service.getPaper(test1.item.id);
  assert.equal(testPaper.media[testAudio], 'https://media.test/test.mp3');
  assert.equal(paper.media[paper.content.vocabulary[0].audioMediaId], 'https://media.test/coffee.mp3');
  assert.equal(paper.content.questions[0].options.filter((option) => option.isCorrect).length, 1);
});

test('deleting a topic removes its recording, its pronunciations and its speech jobs', async () => {
  const h = await harness();
  const { item } = await h.service.createItem(manager, courseItemCreateSchema.parse({ level: 'B1', type: 'topic', title: 'Shop' }));
  await h.service.saveDraft(manager, item.id, await completeTopic(h));
  await h.service.requestAutoTime(manager, item.id);
  const result = await h.service.delete(manager, item.id);
  assert.equal(result.removedMedia, 5);
  assert.deepEqual(h.deleted.sort(), ['coffee.mp3', 'help.mp3', 'large.mp3', 'shop.mp3', 'small.mp3']);
  assert.ok(!(await h.repository.listening.findLatestTimingJob({ courseItemId: item.id })));
});

test('a recording replaced in a draft is removed from storage', async () => {
  const h = await harness();
  const { item } = await h.service.createItem(manager, courseItemCreateSchema.parse({ level: 'B1', type: 'topic', title: 'Shop' }));
  const first = await completeTopic(h);
  await h.service.saveDraft(manager, item.id, first);
  await h.service.saveDraft(manager, item.id, { ...first, audioMediaId: await h.upload('better.mp3') });
  assert.deepEqual(h.deleted, ['shop.mp3']);
});

test('auto-time and transcribe run on the topic recording (D147)', async () => {
  const h = await harness();
  const { item } = await h.service.createItem(manager, courseItemCreateSchema.parse({ level: 'A1', type: 'topic', title: 'Café' }));
  await assert.rejects(() => h.service.requestAutoTime(manager, item.id), { code: 41 });
  const content = await completeTopic(h, { segments: timedSegments().map((segment) => ({ ...segment, start: null, end: null })) });
  const saved = await h.service.saveDraft(manager, item.id, content);
  await assert.rejects(() => h.service.requestAutoTime(student, item.id), { code: 26 });

  const { job } = await h.service.requestAutoTime(manager, item.id);
  assert.equal(job.status, 'QUEUED');
  const sent = h.repository.tables.contentEvents.at(-1).payload;
  assert.deepEqual([sent.task, sent.kind, sent.audioUrl, sent.lines.length], ['align', 'part3', 'https://media.test/shop.mp3', 4]);
  assert.deepEqual(sent.lines[0], { id: saved.draft.content.segments[0].id, text: 'Can I help you?' });
  assert.equal((await h.service.requestAutoTime(manager, item.id)).job.id, job.id);

  await h.listening.onAutoTimeResult({ jobId: job.id, status: 'DONE', lines: sent.lines.map((line, index) => ({ id: line.id, start: index, end: index + 0.9, matched: 1 })) });
  const answer = (await h.service.getAutoTime(manager, item.id)).job;
  assert.deepEqual([answer.status, answer.lines.length, answer.lines[1].start], ['DONE', 4, 1]);

  const transcribe = await h.service.requestTranscribe(manager, item.id);
  assert.deepEqual([transcribe.job.task, h.repository.tables.contentEvents.at(-1).payload.lines], ['transcribe', []]);

  const levelTest = await h.service.createItem(manager, courseItemCreateSchema.parse({ level: 'A1', type: 'level_test', title: 'A1 test' }));
  await assert.rejects(() => h.service.requestAutoTime(manager, levelTest.item.id), { code: 41 });
});
