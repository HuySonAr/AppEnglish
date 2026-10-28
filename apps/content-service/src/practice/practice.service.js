import { AccountRole } from '@appenglish/auth-contracts';
import { Accent, MediaSection, PracticePromptKind, PracticePromptStatus as Status, SpeechTask, VOICE_SPEEDS, VoiceSpeed, practiceLevelOf } from '@appenglish/content-contracts';
import { contentErrors } from '../content/content.errors.js';
import { practiceContentSchemas, practiceIssues, practiceMediaIds } from './practice.schemas.js';

const MACHINE_AUDIO_TIMEOUT_MS = 55_000;
const withLevel = (content) => (content ? { ...content, level: practiceLevelOf(content.level) } : content);

const OPEN_EDIT = new Set([Status.DRAFT, Status.RETURNED]);
const EVER_PUBLISHED = new Set([Status.PUBLISHED, Status.ARCHIVED, Status.UNPUBLISHED]);
const iso = (value) => (value ? new Date(value).toISOString() : null);
const RECORDING_EXTENSIONS = { 'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav' };

export class PracticeService {
  constructor(repository, contentService, { now = () => new Date(), listening = null } = {}) {
    this.repository = repository;
    this.contentService = contentService;
    this.now = now;
    this.listening = listening;
  }

  isTeacher(actor) {
    return actor.role === AccountRole.TEACHER;
  }

  isReviewer(actor) {
    return actor.role === AccountRole.CONTENT_MANAGER;
  }

  assertTeacher(actor) {
    if (!this.isTeacher(actor)) throw contentErrors.forbiddenRole();
  }

  assertReviewer(actor) {
    if (!this.isReviewer(actor)) throw contentErrors.forbiddenRole();
  }

  async load(actor, promptId) {
    if (!this.isTeacher(actor) && !this.isReviewer(actor)) throw contentErrors.forbiddenRole();
    const prompt = await this.repository.findPrompt(promptId);
    if (!prompt) throw contentErrors.practicePromptNotFound();
    const versions = await this.repository.listVersions([prompt.id]);
    if (this.isTeacher(actor) && prompt.authorId !== actor.id) throw contentErrors.practicePromptNotFound();
    if (this.isReviewer(actor) && versions.every((version) => version.status === Status.DRAFT)) throw contentErrors.practicePromptNotFound();
    return { prompt, versions, latest: versions.at(-1), published: versions.find((version) => version.id === prompt.publishedVersionId) || null };
  }

  versionView(version) {
    return version
      ? {
          id: version.id,
          versionNumber: version.versionNumber,
          status: version.status,
          content: withLevel(version.content),
          reviewNote: version.reviewNote || null,
          submittedAt: iso(version.submittedAt),
          reviewedAt: iso(version.reviewedAt),
          updatedAt: iso(version.updatedAt),
        }
      : null;
  }

  summaryOf(prompt, versions) {
    const latest = versions.at(-1);
    const published = versions.find((version) => version.id === prompt.publishedVersionId) || null;
    const shown = latest?.content || {};
    return {
      id: prompt.id,
      kind: prompt.kind,
      authorId: prompt.authorId,
      title: shown.title || '',
      etsTask: shown.etsTask || null,
      level: practiceLevelOf(shown.level),
      topic: shown.topic || '',
      status: latest?.status || Status.DRAFT,
      versionNumber: latest?.versionNumber || 1,
      publishedVersionNumber: published?.versionNumber || null,
      everPublished: versions.some((version) => EVER_PUBLISHED.has(version.status)),
      submittedAt: iso(latest?.submittedAt),
      updatedAt: iso(latest?.updatedAt || prompt.updatedAt),
    };
  }

  async detail(state) {
    const ids = [...new Set([...practiceMediaIds(state.latest?.content), ...practiceMediaIds(state.published?.content)])];
    const media = ids.length ? await this.contentService.repository.findMediaByIds(ids) : [];
    return {
      prompt: this.summaryOf(state.prompt, state.versions),
      latest: this.versionView(state.latest),
      published: this.versionView(state.published),
      media: Object.fromEntries(media.map((asset) => [asset.id, { kind: asset.kind, fileName: asset.fileName, url: asset.storage === 'local' ? null : asset.url }])),
    };
  }

  async listPrompts(actor) {
    if (!this.isTeacher(actor) && !this.isReviewer(actor)) throw contentErrors.forbiddenRole();
    const prompts = await this.repository.listPrompts(this.isTeacher(actor) ? { authorId: actor.id } : {});
    const versions = await this.repository.listVersions(prompts.map((prompt) => prompt.id));
    const summaries = prompts.map((prompt) => this.summaryOf(prompt, versions.filter((version) => version.promptId === prompt.id)));
    return { prompts: this.isReviewer(actor) ? summaries.filter((summary) => summary.status !== Status.DRAFT || summary.publishedVersionNumber) : summaries };
  }

  async createPrompt(actor, { kind }) {
    this.assertTeacher(actor);
    const content = practiceContentSchemas[kind].parse({});
    const { prompt } = await this.repository.createPromptWithVersion({ kind, authorId: actor.id, publishedVersionId: null }, (saved) => ({
      promptId: saved.id,
      versionNumber: 1,
      status: Status.DRAFT,
      content,
      createdBy: actor.id,
    }));
    return this.detail(await this.load(actor, prompt.id));
  }

  async getPrompt(actor, promptId) {
    return this.detail(await this.load(actor, promptId));
  }

  async saveDraft(actor, promptId, { content }) {
    this.assertTeacher(actor);
    const state = await this.load(actor, promptId);
    const parsed = practiceContentSchemas[state.prompt.kind].parse(content);
    if (state.latest.status === Status.PENDING_REVIEW)
      throw contentErrors.practicePromptState('PENDING_REVIEW', 'Withdraw the prompt from review before editing it');
    if (OPEN_EDIT.has(state.latest.status)) {
      await this.repository.saveVersion({ ...state.latest, content: parsed, status: Status.DRAFT, reviewNote: state.latest.reviewNote });
    } else {
      await this.repository.saveVersion({ promptId, versionNumber: state.latest.versionNumber + 1, status: Status.DRAFT, content: parsed, createdBy: actor.id });
    }
    return this.detail(await this.load(actor, promptId));
  }

  async submitPrompt(actor, promptId) {
    this.assertTeacher(actor);
    const state = await this.load(actor, promptId);
    if (!OPEN_EDIT.has(state.latest.status)) throw contentErrors.practicePromptState('NOTHING_TO_SUBMIT', 'There is no draft to send for review');
    const issues = practiceIssues(state.prompt.kind, state.latest.content);
    if (issues.length) throw contentErrors.notPublishable(issues);
    await this.repository.saveVersion({ ...state.latest, status: Status.PENDING_REVIEW, submittedAt: this.now(), reviewNote: null });
    return this.detail(await this.load(actor, promptId));
  }

  async withdrawPrompt(actor, promptId) {
    this.assertTeacher(actor);
    const state = await this.load(actor, promptId);
    if (state.latest.status !== Status.PENDING_REVIEW) throw contentErrors.practicePromptState('NOT_IN_REVIEW', 'The prompt is not waiting for review');
    await this.repository.saveVersion({ ...state.latest, status: Status.DRAFT, submittedAt: null });
    return this.detail(await this.load(actor, promptId));
  }

  async approvePrompt(actor, promptId) {
    this.assertReviewer(actor);
    const state = await this.load(actor, promptId);
    if (state.latest.status !== Status.PENDING_REVIEW) throw contentErrors.practicePromptState('NOT_IN_REVIEW', 'The prompt is not waiting for review');
    const at = this.now();
    const previous = state.published ? { ...state.published, status: Status.ARCHIVED } : null;
    await this.repository.publishVersion(
      { ...state.prompt, publishedVersionId: state.latest.id },
      { ...state.latest, status: Status.PUBLISHED, reviewedBy: actor.id, reviewedAt: at, reviewNote: null },
      previous,
    );
    return this.detail(await this.load(actor, promptId));
  }

  async returnPrompt(actor, promptId, { note }) {
    this.assertReviewer(actor);
    const state = await this.load(actor, promptId);
    if (state.latest.status !== Status.PENDING_REVIEW) throw contentErrors.practicePromptState('NOT_IN_REVIEW', 'The prompt is not waiting for review');
    await this.repository.saveVersion({ ...state.latest, status: Status.RETURNED, reviewNote: note, reviewedBy: actor.id, reviewedAt: this.now() });
    return this.detail(await this.load(actor, promptId));
  }

  async unpublishPrompt(actor, promptId) {
    this.assertReviewer(actor);
    const state = await this.load(actor, promptId);
    if (!state.published) throw contentErrors.practicePromptState('NOT_PUBLISHED', 'The prompt is not published');
    await this.repository.publishVersion({ ...state.prompt, publishedVersionId: null }, { ...state.published, status: Status.UNPUBLISHED, reviewedBy: actor.id, reviewedAt: this.now() }, null);
    return this.detail(await this.load(actor, promptId));
  }

  async deletePrompt(actor, promptId) {
    const state = await this.load(actor, promptId);
    const wasPublished = state.versions.some((version) => EVER_PUBLISHED.has(version.status));
    if (this.isReviewer(actor)) {
      if (!wasPublished) throw contentErrors.forbiddenRole();
      if (state.published) throw contentErrors.practicePromptState('PUBLISHED', 'Unpublish the prompt before deleting it');
    } else {
      if (wasPublished) throw contentErrors.practicePromptState('WAS_PUBLISHED', 'Only a content manager can delete a prompt learners have seen');
      if (state.latest.status === Status.PENDING_REVIEW) throw contentErrors.practicePromptState('PENDING_REVIEW', 'Withdraw the prompt from review before deleting it');
    }
    const mediaIds = state.versions.flatMap((version) => practiceMediaIds(version.content));
    await this.repository.deletePrompt(promptId);
    const removed = await this.contentService.removeUnusedMedia(mediaIds);
    return { deleted: { id: promptId }, removedMedia: removed.length };
  }

  async requestAutoTime(actor, promptId) {
    this.assertTeacher(actor);
    const { prompt, latest } = await this.load(actor, promptId);
    if (prompt.kind !== PracticePromptKind.READ_ALOUD) throw contentErrors.autoTimeInvalid('NO_LINES', 'Only read-aloud prompts are timed');
    const content = latest?.content || {};
    return this.listening.queueSpeechJob(actor, {
      owner: { practicePromptId: promptId },
      task: SpeechTask.ALIGN,
      kind: prompt.kind,
      audioMediaId: content.audioMediaId,
      segments: (content.sentences || []).map((sentence) => ({ id: sentence.id, text: sentence.text })),
    });
  }

  async getAutoTime(actor, promptId) {
    await this.load(actor, promptId);
    return this.listening.latestSpeechJob({ practicePromptId: promptId });
  }

  async createMachineAudio(actor, { text, speed = VoiceSpeed.NORMAL }) {
    this.assertTeacher(actor);
    const source = this.contentService.pronunciationSource;
    let data;
    try {
      const entry = await source.lookup(text, { accents: [Accent.UK], speed: VOICE_SPEEDS[speed], timeoutMs: MACHINE_AUDIO_TIMEOUT_MS });
      if (!entry?.audio?.[Accent.UK]) throw contentErrors.pronunciationUnavailable();
      data = await source.download(entry.audio[Accent.UK]);
    } catch (error) {
      if (error?.name === 'PronunciationUnavailableError') throw contentErrors.pronunciationUnavailable();
      throw error;
    }
    const { media } = await this.contentService.uploadMedia(actor, { kind: 'audio', fileName: `read-aloud-uk-${speed}.mp3`, mimeType: 'audio/mpeg', data, section: MediaSection.PRACTICE });
    const [asset] = await this.contentService.repository.findMediaByIds([media.id]);
    return { media: { ...media, url: asset && asset.storage !== 'local' ? asset.url : null } };
  }

  async listPublished() {
    const prompts = (await this.repository.listPrompts({})).filter((prompt) => prompt.publishedVersionId);
    const versions = await this.repository.listVersions(prompts.map((prompt) => prompt.id));
    return {
      prompts: prompts
        .map((prompt) => {
          const version = versions.find((item) => item.id === prompt.publishedVersionId);
          if (!version) return null;
          return {
            id: prompt.id,
            kind: prompt.kind,
            versionId: version.id,
            versionNumber: version.versionNumber,
            title: version.content.title,
            etsTask: version.content.etsTask || null,
            level: practiceLevelOf(version.content.level),
            topic: version.content.topic,
            publishedAt: iso(version.reviewedAt),
          };
        })
        .filter(Boolean),
    };
  }

  async paper(promptId) {
    const prompt = await this.repository.findPrompt(promptId);
    if (!prompt?.publishedVersionId) throw contentErrors.practicePromptNotFound();
    const version = (await this.repository.listVersions([prompt.id])).find((item) => item.id === prompt.publishedVersionId);
    if (!version) throw contentErrors.practicePromptNotFound();
    const ids = practiceMediaIds(version.content);
    const media = ids.length ? await this.contentService.repository.findMediaByIds(ids) : [];
    return {
      prompt: {
        id: prompt.id,
        kind: prompt.kind,
        versionId: version.id,
        versionNumber: version.versionNumber,
        content: withLevel(version.content),
        media: Object.fromEntries(media.map((asset) => [asset.id, { kind: asset.kind, url: asset.url }])),
      },
    };
  }

  async storeRecording({ mimeType, data }) {
    const type = String(mimeType || '').split(';')[0].trim().toLowerCase();
    let stored;
    try {
      stored = await this.contentService.mediaStorage.upload({
        folder: 'learner-recordings',
        kind: 'recording',
        fileName: `recording${RECORDING_EXTENSIONS[type] || '.bin'}`,
        mimeType: type,
        sizeBytes: data.byteLength,
        data,
      });
    } catch (error) {
      if (error?.name === 'MediaValidationError') throw contentErrors.mediaInvalid(error.code, error.message);
      throw error;
    }
    return { recording: { storage: stored.storage, storageId: stored.id, url: stored.url, mimeType: type, sizeBytes: stored.sizeBytes } };
  }

  async deleteRecordings({ recordings }) {
    const deleted = [];
    const failed = [];
    for (const recording of recordings) {
      try {
        await this.contentService.mediaStorage.delete({ storage: recording.storage, storageId: recording.storageId });
        deleted.push(recording.storageId);
      } catch {
        failed.push(recording.storageId);
      }
    }
    return { deleted, failed };
  }
}
