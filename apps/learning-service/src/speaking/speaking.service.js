import { randomUUID } from 'node:crypto';
import { AccountRole } from '@appenglish/auth-contracts';
import { PracticePromptKind } from '@appenglish/content-contracts';
import { currentRequestId } from '@appenglish/backend-common/observability';
import {
  LearningEventType,
  LearningQueue,
  openSpeakingScores,
  RECORDING_KEEP_DAYS,
  RECORDING_LIMITS,
  StudyActivity,
  SUBMISSION_HISTORY_SIZE,
  SubmissionStatus,
} from '@appenglish/learning-contracts';
import { noEvents, recordActivity } from '../events/learning-events.js';
import { placementErrors } from '../placement/placement.errors.js';
import { speakingErrors } from './speaking.errors.js';
import { openGradingSchema, openWhisperSchema, readAloudResultSchema } from './speaking.schemas.js';

const READY_KINDS = new Set([PracticePromptKind.READ_ALOUD, PracticePromptKind.OPEN_SPEAKING]);
const isOpen = (kind) => kind === PracticePromptKind.OPEN_SPEAKING;
const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (value) => (value ? new Date(value).toISOString() : null);
const mimeOf = (value) => String(value || '').split(';')[0].trim().toLowerCase();

export class SpeakingService {
  constructor(repository, contentClient, { now = () => new Date(), events = noEvents, keys = null, reviews = null } = {}) {
    this.repository = repository;
    this.contentClient = contentClient;
    this.now = now;
    this.events = events;
    this.keys = keys;
    this.reviews = reviews;
  }

  async keyOf(accountId) {
    return this.keys ? this.keys.findKey(accountId) : null;
  }

  assertStudent(actor) {
    if (actor.role !== AccountRole.STUDENT) throw placementErrors.forbiddenRole();
  }

  async paperOf(promptId) {
    const paper = await this.contentClient.getPracticePaper(promptId);
    if (!paper?.prompt || !READY_KINDS.has(paper.prompt.kind)) throw speakingErrors.promptNotFound();
    return paper.prompt;
  }

  learnerPrompt(prompt) {
    const { content, media = {} } = prompt;
    const common = { id: prompt.id, kind: prompt.kind, versionNumber: prompt.versionNumber, title: content.title, level: content.level, topic: content.topic };
    if (isOpen(prompt.kind))
      return {
        ...common,
        instructions: content.instructions,
        imageUrl: (content.imageMediaId && media[content.imageMediaId]?.url) || null,
        maxSeconds: Math.min(RECORDING_LIMITS.openSpeakingSeconds, content.maxSeconds || RECORDING_LIMITS.openSpeakingSeconds),
      };
    return {
      ...common,
      text: content.text,
      audioUrl: (content.audioMediaId && media[content.audioMediaId]?.url) || null,
      maxSeconds: RECORDING_LIMITS.readAloudSeconds,
    };
  }

  summary(submission) {
    return {
      id: submission.id,
      status: submission.status,
      total: submission.teacherReview?.scores?.total ?? submission.result?.scores?.total ?? null,
      reviewed: Boolean(submission.teacherReview),
      versionNumber: submission.prompt?.versionNumber ?? null,
      submittedAt: iso(submission.submittedAt),
    };
  }

  view(submission) {
    const kept = submission.recording && !submission.recordingDeletedAt;
    return {
      ...this.summary(submission),
      promptId: submission.promptId,
      kind: submission.kind,
      error: submission.error || null,
      scoredAt: iso(submission.scoredAt),
      recordingUrl: kept ? submission.recording.url : null,
      durationSeconds: submission.recording?.durationSeconds ?? null,
      stage: submission.status === SubmissionStatus.SCORING ? (submission.result?.stage === 'grading' ? 'grading' : 'listening') : null,
      prompt: isOpen(submission.kind)
        ? {
            title: submission.prompt.title,
            level: submission.prompt.level,
            instructions: submission.prompt.instructions,
          }
        : { title: submission.prompt.title, level: submission.prompt.level, text: submission.prompt.text },
      result: submission.result || null,
      teacherReview: submission.teacherReview || null,
    };
  }

  async withReview(submission) {
    return { ...this.view(submission), review: this.reviews ? await this.reviews.reviewFor(submission.id) : null };
  }

  async listPrompts(actor) {
    this.assertStudent(actor);
    const published = (await this.contentClient.listPublishedPracticePrompts())?.prompts || [];
    const stats = new Map((await this.repository.statsByPrompt(actor.id)).map((row) => [row.promptId, row]));
    return {
      prompts: published
        .filter((prompt) => READY_KINDS.has(prompt.kind))
        .map((prompt) => {
          const mine = stats.get(prompt.id);
          return {
            id: prompt.id,
            kind: prompt.kind,
            title: prompt.title,
            level: prompt.level,
            topic: prompt.topic,
            attempts: mine?.attempts || 0,
            bestTotal: mine?.bestTotal ?? null,
            lastSubmittedAt: iso(mine?.lastSubmittedAt),
          };
        }),
    };
  }

  async getPrompt(actor, promptId) {
    this.assertStudent(actor);
    const prompt = await this.paperOf(promptId);
    const history = await this.repository.listSubmissions(actor.id, promptId, SUBMISSION_HISTORY_SIZE);
    return { prompt: this.learnerPrompt(prompt), submissions: history.map((submission) => this.summary(submission)), hasKey: Boolean(await this.keyOf(actor.id)), reviewQuota: this.reviews ? await this.reviews.quotaOf(actor.id) : null };
  }

  checkRecording(mimeType, data, durationSeconds, maxSeconds) {
    if (!RECORDING_LIMITS.mimeTypes.includes(mimeType)) throw speakingErrors.recordingInvalid('TYPE', 'This audio format is not supported');
    if (!data?.byteLength) throw speakingErrors.recordingInvalid('EMPTY', 'The recording is empty');
    if (data.byteLength > RECORDING_LIMITS.maxBytes) throw speakingErrors.recordingInvalid('TOO_LARGE', 'The recording is too large');
    if (durationSeconds > maxSeconds + 1) throw speakingErrors.recordingInvalid('TOO_LONG', `Record at most ${maxSeconds} seconds`);
  }

  async submit(actor, promptId, { mimeType, data, durationSeconds }) {
    this.assertStudent(actor);
    const type = mimeOf(mimeType);
    const prompt = await this.paperOf(promptId);
    this.checkRecording(type, data, durationSeconds, this.learnerPrompt(prompt).maxSeconds);
    const { recording } = await this.contentClient.storeLearnerRecording(type, data);
    const at = this.now();
    const id = randomUUID();
    const view = this.learnerPrompt(prompt);
    const snapshot = { ...prompt.content, versionId: prompt.versionId, versionNumber: prompt.versionNumber, audioUrl: view.audioUrl || null, imageUrl: view.imageUrl || null, maxSeconds: view.maxSeconds };
    const saved = await this.repository.saveWithEvent(
      {
        id,
        accountId: actor.id,
        promptId: prompt.id,
        promptVersionId: prompt.versionId,
        kind: prompt.kind,
        prompt: snapshot,
        recording: { ...recording, durationSeconds: Math.round(durationSeconds * 10) / 10 },
        recordingDeletedAt: null,
        status: SubmissionStatus.SCORING,
        result: null,
        error: null,
        submittedAt: at,
        scoredAt: null,
      },
      {
        type: LearningEventType.SPEAKING_REQUESTED,
        queue: LearningQueue.SPEAKING_REQUESTS,
        payload: { submissionId: id, kind: prompt.kind, audioUrl: recording.url, text: isOpen(prompt.kind) ? '' : prompt.content.text },
        requestId: currentRequestId(),
        createdAt: at,
        publishedAt: null,
      },
    );
    this.events.flush?.().catch(() => {});
    await recordActivity(this.events, actor.id, StudyActivity.SPEAKING, at);
    return { submission: await this.withReview(saved) };
  }

  async getSubmission(actor, submissionId) {
    this.assertStudent(actor);
    const submission = await this.repository.findSubmission(submissionId);
    if (!submission || submission.accountId !== actor.id || !READY_KINDS.has(submission.kind)) throw speakingErrors.submissionNotFound();
    return { submission: await this.withReview(submission) };
  }

  async finish(submission, { status, result, error }) {
    const at = this.now();
    const finished = { ...submission, status, result, error: status === SubmissionStatus.DONE ? null : String(error || 'The recording could not be scored').slice(0, 500), scoredAt: at };
    await this.repository.saveWithEvent(finished, {
      type: LearningEventType.SPEAKING_SCORED,
      queue: null,
      payload: {
        accountId: submission.accountId,
        submissionId: submission.id,
        promptId: submission.promptId,
        kind: submission.kind,
        title: submission.prompt.title || '',
        status,
        total: result?.scores?.total ?? null,
        scoredAt: at.toISOString(),
      },
      requestId: currentRequestId(),
      createdAt: at,
      publishedAt: null,
    });
    this.events.flush?.().catch(() => {});
    return 'applied';
  }

  async applyResult(answer) {
    const submission = answer?.submissionId ? await this.repository.findSubmission(answer.submissionId) : null;
    if (!submission) return 'unknown';
    if (submission.status !== SubmissionStatus.SCORING || submission.result?.stage === 'grading') return 'duplicate';
    if (answer.status !== SubmissionStatus.DONE && answer.status !== SubmissionStatus.FAILED) return 'ignored';
    const schema = isOpen(submission.kind) ? openWhisperSchema : readAloudResultSchema;
    const parsed = answer.status === SubmissionStatus.DONE ? schema.safeParse(answer.result) : null;
    if (!parsed?.success) return this.finish(submission, { status: SubmissionStatus.FAILED, result: null, error: parsed ? 'The scoring result was not valid' : answer.error });
    if (!isOpen(submission.kind)) return this.finish(submission, { status: SubmissionStatus.DONE, result: parsed.data });
    const heard = { ...parsed.data, scores: openSpeakingScores(parsed.data.scores), gemini: null };
    const key = await this.keyOf(submission.accountId);
    if (!key || !heard.transcript.trim()) return this.finish(submission, { status: SubmissionStatus.DONE, result: heard });
    const at = this.now();
    const prompt = submission.prompt;
    await this.repository.saveWithEvent(
      { ...submission, result: { ...heard, stage: 'grading' } },
      {
        type: LearningEventType.SPEAKING_GRADING_REQUESTED,
        queue: LearningQueue.WRITING_REQUESTS,
        payload: {
          submissionId: submission.id,
          accountId: submission.accountId,
          prompt: { title: prompt.title, level: prompt.level, instructions: prompt.instructions, maxSeconds: prompt.maxSeconds, sampleAnswer: prompt.sampleAnswer, keyPoints: prompt.keyPoints || [] },
          answer: heard.transcript,
          durationSeconds: submission.recording?.durationSeconds ?? null,
          key: key.sealed,
          model: key.model || null,
          thinkingLevel: key.thinkingLevel || null,
        },
        requestId: currentRequestId(),
        createdAt: at,
        publishedAt: null,
      },
    );
    this.events.flush?.().catch(() => {});
    return 'applied';
  }

  async applyGrading(answer) {
    const submission = answer?.submissionId ? await this.repository.findSubmission(answer.submissionId) : null;
    if (!submission || !isOpen(submission.kind)) return 'unknown';
    if (submission.status !== SubmissionStatus.SCORING || submission.result?.stage !== 'grading') return 'duplicate';
    if (answer.status !== SubmissionStatus.DONE && answer.status !== SubmissionStatus.FAILED) return 'ignored';
    const { stage, ...heard } = submission.result;
    const parsed = answer.status === SubmissionStatus.DONE ? openGradingSchema.safeParse(answer.result) : null;
    if (!parsed?.success) return this.finish(submission, { status: SubmissionStatus.FAILED, result: heard, error: parsed ? 'The scoring result was not valid' : answer.error });
    const { fluency, pronunciation } = heard.scores;
    return this.finish(submission, {
      status: SubmissionStatus.DONE,
      result: { ...heard, gemini: parsed.data, scores: openSpeakingScores({ criteria: parsed.data.criteria, fluency, pronunciation }) },
    });
  }

  async purgeRecordings(limit = 100) {
    const before = new Date(this.now().getTime() - RECORDING_KEEP_DAYS * DAY_MS);
    const expired = await this.repository.listExpiredRecordings(before, limit);
    if (!expired.length) return 0;
    const answer = await this.contentClient.deleteLearnerRecordings(expired.map((row) => ({ storage: row.recording.storage, storageId: row.recording.storageId })));
    const deleted = new Set(answer?.deleted || []);
    const ids = expired.filter((row) => deleted.has(row.recording.storageId)).map((row) => row.id);
    await this.repository.markRecordingsDeleted(ids, this.now());
    return ids.length;
  }
}
