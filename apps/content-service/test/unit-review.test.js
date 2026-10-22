import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIT_REVIEW_QUESTION_COUNT } from '@appenglish/content-contracts';
import { ContentService } from '../src/content/content.service.js';
import { lessonContentSchema, unitReviewContentSchema, unitReviewIssues } from '../src/content/content.schemas.js';
import { createMemoryRepository, manager, publishableContent, student } from './memory-repository.js';
import { publishableReview } from './review-helpers.js';

// A unit review (D121): 20 Part 5 questions and 2 Part 6 passages of 5.

async function harness() {
  const repository = createMemoryRepository();
  const storage = {
    async upload(input) {
      return { id: `stored-${input.fileName}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `https://media.test/${input.fileName}`, storage: 'r2' };
    },
    async delete() {},
  };
  const service = new ContentService(repository, storage);
  const { unit } = await service.createUnit(manager, { title: 'General Business', description: '' });
  return { repository, service, unit };
}

// A unit with one published lesson, so it can be published itself.
async function publishedUnit(h) {
  const audioId = (await h.service.uploadMedia(manager, { kind: 'audio', fileName: 'a.mp3', mimeType: 'audio/mpeg', data: Buffer.from([1]) })).media.id;
  const imageId = (await h.service.uploadMedia(manager, { kind: 'image', fileName: 'i.png', mimeType: 'image/png', data: Buffer.from([1]) })).media.id;
  const { lesson } = await h.service.createLesson(manager, h.unit.id, { title: 'Contracts' });
  await h.service.saveLessonDraft(manager, lesson.id, lessonContentSchema.parse(publishableContent({ audioId, imageId })));
  await h.service.publishLesson(manager, lesson.id);
  await h.service.publishUnit(manager, h.unit.id);
}

test('the publishing rules of a unit review name every gap', () => {
  const empty = unitReviewIssues(unitReviewContentSchema.parse({}));
  assert.deepEqual(empty.map((issue) => issue.path), ['test.part5.questions', 'test.part6.groups']);
  const review = unitReviewContentSchema.parse(publishableReview());
  assert.deepEqual(unitReviewIssues(review), []);
  // A passage with the wrong number of blanks or questions, a question without text.
  review.test.part6.groups[0].passage = 'Only ___ two ___.';
  review.test.part6.questions.pop();
  review.test.part5.questions[0].prompt = '';
  review.test.part5.questions[1].options[2].text = 'Option 1';
  const paths = unitReviewIssues(review).map((issue) => `${issue.path}: ${issue.message}`);
  assert.ok(paths.includes('test.part6.groups[0].passage: The passage needs exactly 3 blanks (___)'), paths.join('\n'));
  assert.ok(paths.includes('test.part6.groups[2]: The passage needs exactly 3 questions'));
  assert.ok(paths.includes('test.part5.questions[0].prompt: Required'));
  assert.ok(paths.includes('test.part5.questions[1].options: Options must be different'));
});

test('a Content Manager writes, publishes, republishes and unpublishes the review of a unit', async () => {
  const h = await harness();
  await assert.rejects(() => h.service.getUnitReview(student, h.unit.id), { code: 26 });
  const empty = await h.service.getUnitReview(manager, h.unit.id);
  assert.deepEqual(empty, { unit: empty.unit, questionCount: UNIT_REVIEW_QUESTION_COUNT, draft: null, published: null });
  await assert.rejects(() => h.service.publishUnitReview(manager, h.unit.id), { code: 41 });

  const saved = await h.service.saveUnitReviewDraft(manager, h.unit.id, unitReviewContentSchema.parse({ test: { part5: { questions: [{ prompt: 'x' }] } } }));
  assert.equal(saved.draft.versionNumber, 1);
  assert.ok(saved.draft.content.test.part5.questions[0].id, 'ids are assigned');
  await assert.rejects(() => h.service.publishUnitReview(manager, h.unit.id), (error) => error.code === 42 && error.data.issues.length > 0);

  await h.service.saveUnitReviewDraft(manager, h.unit.id, unitReviewContentSchema.parse(publishableReview()));
  const published = await h.service.publishUnitReview(manager, h.unit.id);
  assert.equal(published.published.versionNumber, 1);
  assert.equal(published.draft, null);
  const listed = (await h.service.listUnits(manager)).units[0];
  assert.deepEqual(listed.review, { publishedVersionNumber: 1, hasDraft: false });
  // Learners get the review only through a published unit.
  await assert.rejects(() => h.service.getUnitReviewPaper(h.unit.id), { code: 40 });
  await publishedUnit(h);
  const paper = await h.service.getUnitReviewPaper(h.unit.id);
  assert.equal(paper.versionNumber, 1);
  assert.equal(paper.test.part5.questions.length + paper.test.part6.questions.length, UNIT_REVIEW_QUESTION_COUNT);
  assert.equal(UNIT_REVIEW_QUESTION_COUNT, 19);
  assert.equal((await h.service.getCurriculum()).units[0].reviewVersionId, paper.versionId);

  // Editing again creates version 2; the published one stays until republished.
  const again = await h.service.saveUnitReviewDraft(manager, h.unit.id, unitReviewContentSchema.parse(publishableReview()));
  assert.equal(again.draft.versionNumber, 2);
  assert.equal(again.published.versionNumber, 1);
  assert.equal((await h.service.publishUnitReview(manager, h.unit.id)).published.versionNumber, 2);
  assert.equal((await h.service.getUnitReviewPaper(h.unit.id, { versionId: paper.versionId })).versionNumber, 1);

  const hidden = await h.service.unpublishUnitReview(manager, h.unit.id);
  assert.equal(hidden.published, null);
  // Without a draft, the version taken down becomes the draft (D122).
  assert.equal(hidden.draft.versionNumber, 3);
  assert.equal((await h.service.getCurriculum()).units[0].reviewVersionId, null);
  await assert.rejects(() => h.service.getUnitReviewPaper(h.unit.id), { code: 40 });
  assert.equal(h.repository.tables.reviewVersions.length, 3, 'versions are kept');

  // Deleting the unit removes its review versions.
  await h.service.deleteUnit(manager, h.unit.id);
  assert.equal(h.repository.tables.reviewVersions.length, 0);
});
