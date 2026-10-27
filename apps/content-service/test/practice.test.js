import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { PracticeService } from '../src/practice/practice.service.js';
import { practiceReturnSchema } from '../src/practice/practice.schemas.js';
import { admin, createMemoryRepository, manager, student, teacher } from './memory-repository.js';
const otherTeacher = { id: '66666666-6666-4666-8666-666666666666', role: 'TEACHER' };

function harness() {
  const repository = createMemoryRepository();
  const deleted = [];
  const storage = {
    async upload(input) { return { id: `s-${input.fileName}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: 1, url: `https://media.test/${input.fileName}`, storage: 'r2' }; },
    async delete(asset) { deleted.push(asset.fileName); },
  };
  const content = new ContentService(repository, storage);
  return { repository, content, deleted, service: new PracticeService(repository.practice, content) };
}

const writing = (fields = {}) => ({
  title: 'Ask for a day off',
  level: 'A2',
  topic: 'Work',
  taskType: 'email',
  etsTask: 'respond_email',
  email: 'From: Ms Lee. We need everyone on Friday. Tell me if you cannot come.',
  instructions: 'Write an email to your manager asking for a day off.',
  imageMediaId: null,
  minWords: 5,
  maxWords: 60,
  sampleAnswer: 'Dear Ms Lee, could I take Friday off? I will finish my report on Thursday. Thank you, Anna.',
  keyPoints: ['the day', 'the reason', 'thanks'],
  ...fields,
});

test('a teacher writes a prompt, sends it for review, and a content manager publishes or returns it (D170)', async () => {
  const { service } = harness();
  for (const actor of [student, admin, manager]) await assert.rejects(() => service.createPrompt(actor, { kind: 'writing' }), { code: 26 });
  const created = await service.createPrompt(teacher, { kind: 'writing' });
  const id = created.prompt.id;
  assert.deepEqual([created.prompt.status, created.latest.versionNumber, created.latest.content.level], ['DRAFT', 1, 'A2']);
  await assert.rejects(() => service.getPrompt(otherTeacher, id), { code: 40 });
  await assert.rejects(() => service.getPrompt(manager, id), { code: 40 }, 'a draft never sent is private');
  await assert.rejects(() => service.submitPrompt(teacher, id), (error) => error.code === 42 && error.data.issues.some((issue) => issue.path === 'sampleAnswer'));

  await service.saveDraft(teacher, id, { content: writing() });
  const sent = await service.submitPrompt(teacher, id);
  assert.equal(sent.prompt.status, 'PENDING_REVIEW');
  await assert.rejects(() => service.saveDraft(teacher, id, { content: writing() }), { code: 41, data: { reason: 'PENDING_REVIEW' } });
  await assert.rejects(() => service.approvePrompt(teacher, id), { code: 26 });
  assert.deepEqual((await service.listPrompts(manager)).prompts.map((item) => [item.title, item.status]), [['Ask for a day off', 'PENDING_REVIEW']]);

  assert.equal(practiceReturnSchema.safeParse({ note: '  ' }).success, false);
  const returned = await service.returnPrompt(manager, id, { note: 'Say the date in the instructions.' });
  assert.deepEqual([returned.prompt.status, returned.latest.reviewNote], ['RETURNED', 'Say the date in the instructions.']);
  await service.saveDraft(teacher, id, { content: writing({ instructions: 'Write an email asking for Friday off.' }) });
  await service.submitPrompt(teacher, id);
  const published = await service.approvePrompt(manager, id);
  assert.deepEqual([published.prompt.status, published.prompt.publishedVersionNumber, published.published.content.instructions], ['PUBLISHED', 1, 'Write an email asking for Friday off.']);

  const fix = await service.saveDraft(teacher, id, { content: writing({ title: 'Ask for Friday off' }) });
  assert.deepEqual([fix.latest.versionNumber, fix.latest.status, fix.published.versionNumber, fix.published.content.title], [2, 'DRAFT', 1, 'Ask for a day off'], 'the published version stays until the fix is approved');
  await service.submitPrompt(teacher, id);
  const second = await service.approvePrompt(manager, id);
  assert.deepEqual([second.prompt.publishedVersionNumber, second.published.content.title], [2, 'Ask for Friday off']);

  const down = await service.unpublishPrompt(manager, id);
  assert.equal(down.published, null);
  await assert.rejects(() => service.deletePrompt(teacher, id), { code: 41, data: { reason: 'WAS_PUBLISHED' } });
});

test('read-aloud and open speaking prompts check their own fields; a never-published prompt can be deleted with its files', async () => {
  const { service, content, deleted } = harness();
  const read = await service.createPrompt(teacher, { kind: 'read_aloud' });
  await assert.rejects(() => service.submitPrompt(teacher, read.prompt.id), (error) => error.data.issues.map((issue) => issue.path).join() === 'title,topic,text');
  const audio = (await content.uploadMedia(teacher, { kind: 'audio', fileName: 'model.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]), section: 'practice' })).media.id;
  await assert.rejects(() => content.uploadMedia(manager, { kind: 'audio', fileName: 'x.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]), section: 'practice' }), { code: 26 });
  const saved = await service.saveDraft(teacher, read.prompt.id, { content: { title: 'At the station', level: 'A1', topic: 'Travel', text: 'The train leaves at nine.', audioMediaId: audio } });
  assert.equal(saved.media[audio].fileName, 'model.mp3');
  assert.equal((await service.submitPrompt(teacher, read.prompt.id)).prompt.status, 'PENDING_REVIEW');
  await service.withdrawPrompt(teacher, read.prompt.id);
  const removed = await service.deletePrompt(teacher, read.prompt.id);
  assert.deepEqual([removed.removedMedia, deleted], [1, ['model.mp3']]);

  const open = await service.createPrompt(teacher, { kind: 'open_speaking' });
  await assert.rejects(() => service.saveDraft(teacher, open.prompt.id, { content: { maxSeconds: 500 } }));
  await assert.rejects(() => service.submitPrompt(teacher, open.prompt.id), (error) => error.data.issues.map((issue) => issue.path).join() === 'title,topic,etsTask,instructions,sampleAnswer');
  assert.deepEqual((await service.listPrompts(teacher)).prompts.map((item) => item.kind), ['open_speaking']);
});

test('blank key points are dropped when a draft is saved', async () => {
  const { service } = harness();
  const { prompt } = await service.createPrompt(teacher, { kind: 'writing' });
  const saved = await service.saveDraft(teacher, prompt.id, { content: writing({ keyPoints: ['the day', '  ', ''] }) });
  assert.deepEqual(saved.latest.content.keyPoints, ['the day']);
});

test('ETS task types check their own fields (D195)', async () => {
  const { service, content } = harness();
  const image = (await content.uploadMedia(teacher, { kind: 'image', fileName: 'p.png', mimeType: 'image/png', data: Buffer.from([1]), section: 'practice' })).media.id;
  const paths = async (id) => {
    try {
      await service.submitPrompt(teacher, id);
      await service.withdrawPrompt(teacher, id);
      return [];
    } catch (error) {
      return error.data.issues.map((issue) => issue.path);
    }
  };
  const base = { title: 'Weekend', level: 'B1', topic: 'Life' };
  const set = (await service.createPrompt(teacher, { kind: 'open_speaking' })).prompt.id;
  await service.saveDraft(teacher, set, { content: { ...base, etsTask: 'respond_questions', questions: [{ text: 'How often do you travel?', sampleAnswer: 'Twice a year.' }] } });
  assert.deepEqual(await paths(set), ['context', 'questions']);
  const questions = ['How often?', 'With whom?', 'Describe a trip.'].map((text) => ({ text, sampleAnswer: 'An answer.' }));
  await service.saveDraft(teacher, set, { content: { ...base, etsTask: 'respond_questions', context: 'A travel company is calling you.', questions } });
  assert.deepEqual(await paths(set), []);
  const info = (await service.createPrompt(teacher, { kind: 'open_speaking' })).prompt.id;
  await service.saveDraft(teacher, info, { content: { ...base, etsTask: 'respond_info', questions: questions.map((question, index) => (index === 2 ? { ...question, sampleAnswer: '' } : question)) } });
  assert.deepEqual(await paths(info), ['info', 'questions[2].sampleAnswer']);
  const picture = (await service.createPrompt(teacher, { kind: 'open_speaking' })).prompt.id;
  await service.saveDraft(teacher, picture, { content: { ...base, etsTask: 'describe_picture', instructions: 'Describe it.', sampleAnswer: 'A man reads.' } });
  assert.deepEqual(await paths(picture), ['imageMediaId']);
  const sentence = (await service.createPrompt(teacher, { kind: 'writing' })).prompt.id;
  await service.saveDraft(teacher, sentence, { content: writing({ etsTask: 'picture_sentence', taskType: 'sentence', email: '', imageMediaId: image, keywords: ['station'], minWords: 1, maxWords: 40, sampleAnswer: 'He waits at the station because the train is late.' }) });
  assert.deepEqual(await paths(sentence), ['keywords']);
  await service.saveDraft(teacher, sentence, { content: writing({ etsTask: 'picture_sentence', taskType: 'sentence', email: '', imageMediaId: image, keywords: ['station', 'because'], minWords: 1, maxWords: 40, sampleAnswer: 'He waits at the station because the train is late.' }) });
  assert.deepEqual(await paths(sentence), []);
  const read = (await service.createPrompt(teacher, { kind: 'read_aloud' })).prompt.id;
  assert.equal((await service.saveDraft(teacher, read, { content: { ...base, text: 'Hello.' } })).latest.content.etsTask, 'read_aloud');
});

