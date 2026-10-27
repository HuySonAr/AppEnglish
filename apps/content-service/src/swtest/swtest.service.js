import { LessonVersionStatus } from '@appenglish/content-contracts';
import { contentErrors } from '../content/content.errors.js';
import { swTestContentSchema, swTestIssues, swTestMediaIds } from './swtest.schemas.js';

const iso = (value) => (value ? new Date(value).toISOString() : null);

export class SwTestService {
  constructor(repository, contentService) {
    this.repository = repository;
    this.contentService = contentService;
  }

  testView(test) {
    return { id: test.id, title: test.title };
  }

  async findTestOrThrow(id) {
    const test = await this.repository.findTest(id);
    if (!test) throw contentErrors.swTestNotFound();
    return test;
  }

  async publishedVersion(test) {
    return test.publishedVersionId ? this.repository.findVersion(test.publishedVersionId) : null;
  }

  async mediaOf(versions) {
    const ids = versions.flatMap((version) => {
      const parsed = version ? swTestContentSchema.safeParse(version.content) : null;
      return parsed?.success ? swTestMediaIds(parsed.data) : [];
    });
    const assets = ids.length ? await this.contentService.repository.findMediaByIds([...new Set(ids)]) : [];
    return Object.fromEntries(assets.map((asset) => [asset.id, { kind: asset.kind, fileName: asset.fileName, url: asset.storage === 'local' ? null : asset.url }]));
  }

  async managedView(test, draft, published) {
    return {
      swTest: this.testView(test),
      media: await this.mediaOf([draft, published]),
      draft: this.contentService.draftView(draft),
      published: published ? { versionId: published.id, versionNumber: published.versionNumber, publishedAt: iso(published.publishedAt), content: published.content } : null,
    };
  }

  async listTests(actor) {
    this.contentService.assertStaff(actor);
    const [tests, versions] = await Promise.all([this.repository.listTests(), this.repository.listVersionSummaries()]);
    return {
      swTests: tests.map((test) => {
        const own = versions.filter((version) => version.swTestId === test.id);
        return {
          ...this.testView(test),
          createdAt: iso(test.createdAt),
          publishedVersionNumber: own.find((version) => version.id === test.publishedVersionId)?.versionNumber ?? null,
          hasDraft: own.some((version) => version.status !== LessonVersionStatus.PUBLISHED),
          draftStatus: this.contentService.draftStatus(own),
        };
      }),
    };
  }

  async createTest(actor, { title }) {
    this.contentService.assertTeacher(actor);
    const test = await this.repository.saveTest({ title, publishedVersionId: null, createdBy: actor.id });
    const draft = await this.repository.saveVersion(this.contentService.newDraft(actor, { swTestId: test.id, versionNumber: 1, content: swTestContentSchema.parse({}) }));
    return this.managedView(test, draft, null);
  }

  async updateTest(actor, id, { title }) {
    this.contentService.assertTeacher(actor);
    const test = await this.findTestOrThrow(id);
    test.title = title;
    await this.repository.saveTest(test);
    return { swTest: this.testView(test) };
  }

  async getTest(actor, id) {
    this.contentService.assertStaff(actor);
    const test = await this.findTestOrThrow(id);
    return this.managedView(test, await this.repository.findDraft(id), await this.publishedVersion(test));
  }

  async saveDraft(actor, id, content) {
    this.contentService.assertTeacher(actor);
    const test = await this.findTestOrThrow(id);
    let draft = await this.repository.findDraft(id);
    const previous = draft ? swTestContentSchema.safeParse(draft.content) : null;
    const previousMedia = previous?.success ? swTestMediaIds(previous.data) : [];
    if (draft) this.contentService.openDraft(draft, actor).content = content;
    else draft = this.contentService.newDraft(actor, { swTestId: id, versionNumber: (await this.repository.maxVersionNumber(id)) + 1, content });
    draft = await this.repository.saveVersion(draft);
    const kept = new Set(swTestMediaIds(swTestContentSchema.parse(draft.content)));
    await this.contentService.removeUnusedMedia(previousMedia.filter((mediaId) => !kept.has(mediaId)));
    return this.managedView(test, draft, await this.publishedVersion(test));
  }

  async draftIssues(draft) {
    draft.content = swTestContentSchema.parse(draft.content);
    return swTestIssues(draft.content, await this.contentService.mediaMapOf(swTestMediaIds(draft.content)));
  }

  async publish(actor, id) {
    this.contentService.assertManager(actor);
    const test = await this.findTestOrThrow(id);
    const draft = await this.repository.findDraft(id);
    this.contentService.assertInReview(draft);
    const issues = await this.draftIssues(draft);
    if (issues.length) throw contentErrors.notPublishable(issues);
    this.contentService.approve(draft, actor);
    test.publishedVersionId = draft.id;
    await this.repository.publishVersion(test, draft);
    return this.managedView(test, null, draft);
  }

  async unpublish(actor, id) {
    this.contentService.assertManager(actor);
    const test = await this.findTestOrThrow(id);
    const published = await this.publishedVersion(test);
    if (test.publishedVersionId) {
      test.publishedVersionId = null;
      await this.repository.saveTest(test);
      await this.contentService.noteUnpublished(actor, { type: 'swTest', id: test.id, title: test.title });
    }
    let draft = await this.repository.findDraft(id);
    if (!draft && published)
      draft = await this.repository.saveVersion(this.contentService.draftFrom(published, { swTestId: id, versionNumber: (await this.repository.maxVersionNumber(id)) + 1 }));
    return this.managedView(test, draft, null);
  }

  async delete(actor, id) {
    this.contentService.assertStaff(actor);
    await this.findTestOrThrow(id);
    const summaries = (await this.repository.listVersionSummaries()).filter((version) => version.swTestId === id);
    this.contentService.assertCanDelete(actor, summaries.some((version) => version.status === LessonVersionStatus.PUBLISHED));
    const mediaIds = [];
    for (const summary of summaries) {
      const version = await this.repository.findVersion(summary.id);
      const parsed = version ? swTestContentSchema.safeParse(version.content) : null;
      if (parsed?.success) mediaIds.push(...swTestMediaIds(parsed.data));
    }
    await this.repository.deleteTestWithVersions(id);
    const removedMedia = await this.contentService.removeUnusedMedia([...new Set(mediaIds)]);
    return { deleted: true, removedMedia: removedMedia.length };
  }

  async listPublished() {
    const tests = (await this.repository.listTests()).filter((test) => test.publishedVersionId);
    return { swTests: tests.map((test) => this.testView(test)) };
  }

  async paper(id, { versionId } = {}) {
    const test = await this.repository.findTest(id);
    if (!test?.publishedVersionId) throw contentErrors.swTestNotFound();
    const version = await this.repository.findVersion(versionId || test.publishedVersionId);
    if (version?.swTestId !== test.id || version.status !== LessonVersionStatus.PUBLISHED) throw contentErrors.swTestNotFound();
    return { swTest: this.testView(test), versionId: version.id, versionNumber: version.versionNumber, content: swTestContentSchema.parse(version.content), media: await this.mediaOf([version]) };
  }
}
