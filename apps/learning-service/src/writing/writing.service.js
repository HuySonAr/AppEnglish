import { randomUUID } from 'node:crypto';
import { AccountRole } from '@appenglish/auth-contracts';
import { PracticePromptKind } from '@appenglish/content-contracts';
import { seal } from '@appenglish/backend-common/secret-box';
import { currentRequestId } from '@appenglish/backend-common/observability';
import {
  AiKeyCheck,
  LearningEventType,
  LearningQueue,
  StudyActivity,
  SUBMISSION_HISTORY_SIZE,
  SubmissionStatus,
  WRITING_LIMITS,
  countWords,
  writingScores,
} from '@appenglish/learning-contracts';
import { noEvents, recordActivity } from '../events/learning-events.js';
import { placementErrors } from '../placement/placement.errors.js';
import { writingErrors } from './writing.errors.js';
import { writingResultSchema } from './writing.schemas.js';

const iso = (value) => (value ? new Date(value).toISOString() : null);

export class WritingService {
  constructor(repository, keys, contentClient, { checker, secret = '', now = () => new Date(), events = noEvents, reviews = null } = {}) {
    this.repository = repository;
    this.keys = keys;
    this.contentClient = contentClient;
    this.checker = checker;
    this.secret = secret;
    this.now = now;
    this.events = events;
    this.reviews = reviews;
  }

  assertStudent(actor) {
    if (actor.role !== AccountRole.STUDENT) throw placementErrors.forbiddenRole();
  }

  async paperOf(promptId) {
    const paper = await this.contentClient.getPracticePaper(promptId);
    if (paper?.prompt?.kind !== PracticePromptKind.WRITING) throw writingErrors.promptNotFound();
    return paper.prompt;
  }

  learnerPrompt(prompt) {
    const { content, media = {} } = prompt;
    return {
      id: prompt.id,
      kind: prompt.kind,
      versionNumber: prompt.versionNumber,
      title: content.title,
      level: content.level,
      topic: content.topic,
      taskType: content.taskType,
      instructions: content.instructions,
      imageUrl: (content.imageMediaId && media[content.imageMediaId]?.url) || null,
      minWords: content.minWords,
      maxWords: content.maxWords,
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
    return {
      ...this.summary(submission),
      promptId: submission.promptId,
      kind: submission.kind,
      error: submission.error || null,
      scoredAt: iso(submission.scoredAt),
      answer: submission.answer,
      words: countWords(submission.answer),
      prompt: {
        title: submission.prompt.title,
        level: submission.prompt.level,
        sampleAnswer: submission.prompt.sampleAnswer,
        keyPoints: submission.prompt.keyPoints || [],
      },
      result: submission.result || null,
      teacherReview: submission.teacherReview || null,
    };
  }

  async withReview(submission) {
    return { ...this.view(submission), review: this.reviews ? await this.reviews.reviewFor(submission.id) : null };
  }

  async keyView(accountId) {
    const key = await this.keys.findKey(accountId);
    return key ? { last4: key.last4, verifiedAt: iso(key.verifiedAt) } : null;
  }

  async getKey(actor) {
    this.assertStudent(actor);
    return { key: await this.keyView(actor.id) };
  }

  async saveKey(actor, { key }) {
    this.assertStudent(actor);
    const sealed = seal(key, this.secret);
    let answer;
    try {
      answer = await this.checker.check(sealed);
    } catch {
      throw writingErrors.keyUnavailable();
    }
    if (answer?.status === AiKeyCheck.INVALID) throw writingErrors.keyInvalid(answer.reason);
    if (answer?.status !== AiKeyCheck.VALID) throw writingErrors.keyUnavailable();
    const at = this.now();
    await this.keys.saveKey({ accountId: actor.id, provider: 'gemini', sealed, last4: key.slice(-4), verifiedAt: at });
    return { key: await this.keyView(actor.id) };
  }

  async deleteKey(actor) {
    this.assertStudent(actor);
    await this.keys.deleteKey(actor.id);
    return { key: null };
  }

  async listPrompts(actor) {
    this.assertStudent(actor);
    const published = (await this.contentClient.listPublishedPracticePrompts())?.prompts || [];
    const stats = new Map((await this.repository.statsByPrompt(actor.id)).map((row) => [row.promptId, row]));
    return {
      prompts: published
        .filter((prompt) => prompt.kind === PracticePromptKind.WRITING)
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
      hasKey: Boolean(await this.keys.findKey(actor.id)),
    };
  }

  async getPrompt(actor, promptId) {
    this.assertStudent(actor);
    const prompt = await this.paperOf(promptId);
    const history = await this.repository.listSubmissions(actor.id, promptId, SUBMISSION_HISTORY_SIZE);
    return { prompt: this.learnerPrompt(prompt), submissions: history.map((submission) => this.summary(submission)), hasKey: Boolean(await this.keys.findKey(actor.id)), reviewQuota: this.reviews ? await this.reviews.quotaOf(actor.id) : null };
  }

  async submit(actor, promptId, { text }) {
    this.assertStudent(actor);
    const prompt = await this.paperOf(promptId);
    const answer = String(text).replace(/\r\n/g, '\n').trim();
    const words = countWords(answer);
    const { minWords, maxWords } = prompt.content;
    if (answer.length > WRITING_LIMITS.answerChars) throw writingErrors.answerInvalid('The text is too long', { words, minWords, maxWords });
    if (words < minWords || words > maxWords) throw writingErrors.answerInvalid(`Write ${minWords}–${maxWords} words`, { words, minWords, maxWords });
    const key = await this.keys.findKey(actor.id);
    const at = this.now();
    const id = randomUUID();
    const content = prompt.content;
    const saved = await this.repository.saveWithEvent(
      {
        id,
        accountId: actor.id,
        promptId: prompt.id,
        promptVersionId: prompt.versionId,
        kind: prompt.kind,
        prompt: { ...content, versionId: prompt.versionId, versionNumber: prompt.versionNumber, imageUrl: this.learnerPrompt(prompt).imageUrl },
        answer,
        recording: null,
        recordingDeletedAt: null,
        status: key ? SubmissionStatus.SCORING : SubmissionStatus.SAVED,
        result: null,
        error: null,
        submittedAt: at,
        scoredAt: null,
      },
      key
        ? {
            type: LearningEventType.WRITING_REQUESTED,
            queue: LearningQueue.WRITING_REQUESTS,
            payload: {
              submissionId: id,
              accountId: actor.id,
              prompt: {
                title: content.title,
                level: content.level,
                taskType: content.taskType,
                instructions: content.instructions,
                minWords,
                maxWords,
                sampleAnswer: content.sampleAnswer,
                keyPoints: content.keyPoints || [],
              },
              answer,
              key: key.sealed,
            },
            requestId: currentRequestId(),
            createdAt: at,
            publishedAt: null,
          }
        : null,
    );
    this.events.flush?.().catch(() => {});
    await recordActivity(this.events, actor.id, StudyActivity.WRITING, at);
    return { submission: await this.withReview(saved) };
  }

  async getSubmission(actor, submissionId) {
    this.assertStudent(actor);
    const submission = await this.repository.findSubmission(submissionId);
    if (!submission || submission.accountId !== actor.id || submission.kind !== PracticePromptKind.WRITING) throw writingErrors.submissionNotFound();
    return { submission: await this.withReview(submission) };
  }

  async applyResult(answer) {
    const submission = answer?.submissionId ? await this.repository.findSubmission(answer.submissionId) : null;
    if (!submission) return 'unknown';
    if (submission.status !== SubmissionStatus.SCORING) return 'duplicate';
    if (answer.status !== SubmissionStatus.DONE && answer.status !== SubmissionStatus.FAILED) return 'ignored';
    const parsed = answer.status === SubmissionStatus.DONE ? writingResultSchema.safeParse(answer.result) : null;
    const done = Boolean(parsed?.success);
    const result = done ? { ...parsed.data, scores: writingScores(parsed.data.criteria) } : null;
    const error = parsed && !done ? 'The scoring result was not valid' : answer.error || 'The text could not be scored';
    const at = this.now();
    const finished = { ...submission, status: done ? SubmissionStatus.DONE : SubmissionStatus.FAILED, result, error: done ? null : String(error).slice(0, 500), scoredAt: at };
    await this.repository.saveWithEvent(finished, {
      type: LearningEventType.WRITING_SCORED,
      queue: null,
      payload: {
        accountId: submission.accountId,
        submissionId: submission.id,
        promptId: submission.promptId,
        kind: submission.kind,
        title: submission.prompt.title || '',
        status: finished.status,
        total: result?.scores.total ?? null,
        scoredAt: at.toISOString(),
      },
      requestId: currentRequestId(),
      createdAt: at,
      publishedAt: null,
    });
    this.events.flush?.().catch(() => {});
    return 'applied';
  }
}
