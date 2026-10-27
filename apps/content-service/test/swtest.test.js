import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ContentService } from '../src/content/content.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { ContentReviewService } from '../src/review/review.service.js';
import { SwTestService } from '../src/swtest/swtest.service.js';
import { swTestContentSchema } from '../src/swtest/swtest.schemas.js';
import { createMemoryRepository, manager, student, teacher } from './memory-repository.js';

function memorySwTests() {
  const tests = [];
  const versions = [];
  const copy = (row) => (row ? structuredClone(row) : null);
  const save = (list, row) => {
    const stored = { id: row.id || randomUUID(), createdAt: row.createdAt || new Date(), ...structuredClone(row) };
    const index = list.findIndex((item) => item.id === stored.id);
    if (index >= 0) list[index] = stored;
    else list.push(stored);
    return copy(stored);
  };
  const working = (version) => ['DRAFT', 'PENDING_REVIEW', 'RETURNED'].includes(version.status);
  return {
    tests,
    versions,
    async listTests() { return tests.map(copy); },
    async findTest(id) { return copy(tests.find((row) => row.id === id)); },
    async saveTest(row) { return save(tests, row); },
    async listVersionSummaries() { return versions.map(({ id, swTestId, versionNumber, status }) => ({ id, swTestId, versionNumber, status })); },
    async findDraft(swTestId) { return copy(versions.find((row) => row.swTestId === swTestId && working(row))); },
    async findVersion(id) { return copy(versions.find((row) => row.id === id)); },
    async listWorkingVersions() { return versions.filter(working).map(({ content, ...row }) => ({ ...copy(row), kind: 'swTest', ownerId: row.swTestId })); },
    async listReviewActivity(since) { return versions.filter((row) => row.status === 'PENDING_REVIEW' || (row.reviewedAt && new Date(row.reviewedAt) > since)).map(({ content, ...row }) => ({ ...copy(row), kind: 'swTest', ownerId: row.swTestId })); },
    async maxVersionNumber(swTestId) { return Math.max(0, ...versions.filter((row) => row.swTestId === swTestId).map((row) => row.versionNumber)); },
    async saveVersion(row) { return save(versions, row); },
    async publishVersion(testRow, version) { save(versions, version); save(tests, testRow); },
    async deleteTestWithVersions(id) {
      tests.splice(0, tests.length, ...tests.filter((row) => row.id !== id));
      versions.splice(0, versions.length, ...versions.filter((row) => row.swTestId !== id));
    },
  };
}

async function harness() {
  const repository = createMemoryRepository();
  const storage = {
    async upload(input) {
      return { id: `stored-${input.fileName}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `https://media.test/${input.fileName}`, storage: 'r2' };
    },
    async delete() {},
  };
  const content = new ContentService(repository, storage);
  const listening = new ListeningService(repository.listening, content);
  const swTests = new SwTestService(memorySwTests(), content);
  const review = new ContentReviewService(content, listening, { swTestService: swTests });
  const upload = async (kind, fileName) => (await content.uploadMedia(teacher, { kind, fileName, mimeType: kind === 'audio' ? 'audio/mpeg' : 'image/png', data: Buffer.from([1]), section: 'practice' })).media.id;
  return { content, swTests, review, audio: await upload('audio', 'q.mp3'), image: await upload('image', 'p.png') };
}

const fullContent = ({ audio, image }) => {
  const asked = (text) => ({ text, audioMediaId: audio });
  return swTestContentSchema.parse({
    speaking: {
      readAloud: [{ text: 'Welcome to the Blue Valley Inn.' }, { text: 'Thank you for calling.' }],
      pictures: [{ imageMediaId: image }, { imageMediaId: image }],
      respondQuestions: { context: 'A firm is asking about television.', questions: [asked('How often?'), asked('What kinds?'), asked('Describe one.')] },
      respondInfo: { info: '| Time | Event |\n| 9:00 | Welcome |', questions: [asked('When does it start?'), asked('How much?'), asked('What happens in the morning?')] },
      opinion: { text: 'Is a low salary with long holidays a good job?' },
    },
    writing: {
      pictureSentences: Array.from({ length: 5 }, () => ({ imageMediaId: image, keywords: ['airport', 'so'] })),
      emails: [{ email: 'Welcome to Dale City.', instructions: 'Make two requests.' }, { email: 'Your order is late.', instructions: 'Ask two questions.' }],
      essay: { question: 'What is the best way to find a job?' },
    },
  });
};

test('a teacher writes a Speaking and Writing test; it needs the full ETS layout before review (D196)', async () => {
  const h = await harness();
  await assert.rejects(() => h.swTests.createTest(manager, { title: 'S&W 1' }), { code: 26 });
  const created = await h.swTests.createTest(teacher, { title: 'S&W 1' });
  const id = created.swTest.id;
  assert.deepEqual([created.draft.status, created.draft.content.speaking.readAloud], ['DRAFT', []]);
  await assert.rejects(() => h.review.submit(teacher, { kind: 'swTest', id }), (error) => {
    const paths = error.data.issues.map((issue) => issue.path);
    return error.code === 42 && ['speaking.readAloud', 'speaking.respondInfo.questions', 'writing.pictureSentences', 'writing.essay.question'].every((path) => paths.includes(path));
  });
  const missingAudio = fullContent(h);
  missingAudio.speaking.respondInfo.questions[1].audioMediaId = null;
  await h.swTests.saveDraft(teacher, id, missingAudio);
  await assert.rejects(() => h.review.submit(teacher, { kind: 'swTest', id }), (error) => error.data.issues.map((issue) => issue.path).join() === 'speaking.respondInfo.questions[1].audioMediaId');
  await assert.rejects(() => h.swTests.saveDraft(manager, id, fullContent(h)), { code: 26 });
  await h.swTests.saveDraft(teacher, id, fullContent(h));
  assert.equal((await h.review.submit(teacher, { kind: 'swTest', id })).status, 'PENDING_REVIEW');
  assert.equal((await h.review.listQueue(manager)).items.find((item) => item.kind === 'swTest').title, 'S&W 1');
  await h.review.approve(manager, { kind: 'swTest', id });
  const paper = await h.swTests.paper(id);
  assert.deepEqual([paper.content.speaking.readAloud.length, paper.content.writing.pictureSentences.length, paper.media[h.audio].kind], [2, 5, 'audio']);
  assert.deepEqual((await h.swTests.listPublished()).swTests.map((row) => row.title), ['S&W 1']);
  await assert.rejects(() => h.swTests.delete(teacher, id), (error) => error.data.reason === 'PUBLISHED_BEFORE');
  await assert.rejects(() => h.swTests.listTests(student), { code: 26 });
  assert.equal((await h.swTests.delete(manager, id)).deleted, true);
});
