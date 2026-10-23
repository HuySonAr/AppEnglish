import { AccountRole } from '@appenglish/auth-contracts';
import { currentRequestId } from '@appenglish/backend-common/observability';
import {
  LearningEventType,
  LearningResponseCode,
  REVIEW_CRITERIA,
  ReviewAction,
  ReviewStatus,
  SubmissionStatus,
  TEACHER_REVIEW_LIMITS,
  countWords,
  reviewMaxScore,
  reviewScores,
  vietnamWeekStart,
} from '@appenglish/learning-contracts';
import { noEvents } from '../events/learning-events.js';
import { LearningError, placementErrors } from '../placement/placement.errors.js';

const HOUR_MS = 60 * 60 * 1000;
const READY = new Set([SubmissionStatus.DONE, SubmissionStatus.FAILED, SubmissionStatus.SAVED]);
const SPOKEN = new Set(['read_aloud', 'open_speaking']);
const iso = (value) => (value ? new Date(value).toISOString() : null);

export const reviewErrors = Object.freeze({
  limit: (left) => new LearningError(LearningResponseCode.REVIEW_LIMIT_REACHED, 'You have used your teacher reviews for this week', 409, { left }),
  notAllowed: (reason, message) => new LearningError(LearningResponseCode.REVIEW_NOT_ALLOWED, message, 409, { reason }),
  notFound: () => new LearningError(LearningResponseCode.REVIEW_NOT_FOUND, 'The review was not found', 404),
  locked: (message = 'Another teacher is reviewing this answer') => new LearningError(LearningResponseCode.REVIEW_LOCKED, message, 409),
  invalid: (message, path = []) => new LearningError(LearningResponseCode.VALIDATION_ERROR, message, 400, { issues: [{ path, message }] }),
});

export function aiScoresOf(submission) {
  if (submission.status !== SubmissionStatus.DONE) return null;
  const scores = submission.result?.scores;
  if (!scores || scores.total === null || scores.total === undefined) return null;
  const picked = Object.fromEntries(REVIEW_CRITERIA[submission.kind].map(({ key }) => [key, scores[key]]));
  return Object.values(picked).every((value) => typeof value === 'number') ? { ...picked, total: scores.total } : null;
}

export class ReviewService {
  constructor(repository, { now = () => new Date(), events = noEvents } = {}) {
    this.repository = repository;
    this.now = now;
    this.events = events;
  }

  assertRole(actor, role) {
    if (actor.role !== role) throw placementErrors.forbiddenRole();
  }

  async quotaOf(accountId) {
    const weekStart = vietnamWeekStart(this.now());
    const used = await this.repository.countUsed(accountId, weekStart);
    return { limit: TEACHER_REVIEW_LIMITS.weekly, used, left: Math.max(0, TEACHER_REVIEW_LIMITS.weekly - used), weekStart };
  }

  statusOf(review) {
    if (!review) return null;
    const inReview = review.status === ReviewStatus.WAITING && review.lockedUntil && new Date(review.lockedUntil) > this.now();
    return { status: inReview ? 'IN_REVIEW' : review.status, requestedAt: iso(review.requestedAt), expiresAt: iso(review.expiresAt), completedAt: iso(review.completedAt) };
  }

  async reviewFor(submissionId) {
    return this.statusOf(await this.repository.findBySubmission(submissionId));
  }

  async getQuota(actor) {
    this.assertRole(actor, AccountRole.STUDENT);
    return { quota: await this.quotaOf(actor.id) };
  }

  async request(actor, { submissionId }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const submission = await this.repository.findSubmission(submissionId);
    if (!submission || submission.accountId !== actor.id) throw reviewErrors.notFound();
    if (!READY.has(submission.status)) throw reviewErrors.notAllowed('NOT_READY', 'Wait until the answer is scored');
    if (SPOKEN.has(submission.kind) && (!submission.recording || submission.recordingDeletedAt)) throw reviewErrors.notAllowed('NO_RECORDING', 'The recording is no longer kept');
    const existing = await this.repository.findBySubmission(submissionId);
    if (existing && existing.status !== ReviewStatus.EXPIRED) throw reviewErrors.notAllowed('ALREADY_SENT', 'This answer was already sent to a teacher');
    const at = this.now();
    const weekStart = vietnamWeekStart(at);
    const saved = await this.repository.reserve(
      {
        submissionId,
        accountId: actor.id,
        kind: submission.kind,
        weekStart,
        status: ReviewStatus.WAITING,
        requestedAt: at,
        expiresAt: new Date(at.getTime() + TEACHER_REVIEW_LIMITS.expireHours * HOUR_MS),
        teacherId: null,
        claimedAt: null,
        lockedUntil: null,
        completedAt: null,
        action: null,
        before: null,
        after: null,
        note: null,
      },
      TEACHER_REVIEW_LIMITS.weekly,
    );
    if (!saved) throw reviewErrors.limit(0);
    return { review: this.statusOf(saved), quota: await this.quotaOf(actor.id) };
  }

  async withdraw(actor, { submissionId }) {
    this.assertRole(actor, AccountRole.STUDENT);
    if (!(await this.repository.withdraw(submissionId, actor.id, this.now()))) {
      const review = await this.repository.findBySubmission(submissionId);
      if (!review || review.accountId !== actor.id || review.status !== ReviewStatus.WAITING) throw reviewErrors.notFound();
      throw reviewErrors.locked('A teacher is already reviewing this answer');
    }
    return { review: null, quota: await this.quotaOf(actor.id) };
  }

  async listQueue(actor) {
    this.assertRole(actor, AccountRole.TEACHER);
    const at = this.now();
    const waiting = await this.repository.listWaiting(at);
    const visible = waiting.filter((review) => !review.lockedUntil || new Date(review.lockedUntil) <= at || review.teacherId === actor.id);
    const submissions = await Promise.all(visible.map((review) => this.repository.findSubmission(review.submissionId)));
    return {
      reviews: visible.map((review, index) => {
        const submission = submissions[index];
        return {
          id: review.id,
          kind: review.kind,
          title: submission?.prompt?.title || '',
          level: submission?.prompt?.level || null,
          hasAi: Boolean(submission && aiScoresOf(submission)),
          requestedAt: iso(review.requestedAt),
          expiresAt: iso(review.expiresAt),
          mine: review.teacherId === actor.id && Boolean(review.lockedUntil) && new Date(review.lockedUntil) > at,
          lockedUntil: review.teacherId === actor.id ? iso(review.lockedUntil) : null,
        };
      }),
      doneThisWeek: await this.repository.countDoneSince(actor.id, new Date(`${vietnamWeekStart(at)}T00:00:00+07:00`)),
    };
  }

  async ownClaim(actor, reviewId) {
    const review = await this.repository.findReview(reviewId);
    if (!review || review.status !== ReviewStatus.WAITING) throw reviewErrors.notFound();
    if (review.teacherId !== actor.id || !review.lockedUntil || new Date(review.lockedUntil) <= this.now()) throw reviewErrors.locked('Take this answer from the queue first');
    return review;
  }

  async detail(review) {
    const submission = await this.repository.findSubmission(review.submissionId);
    const prompt = submission.prompt;
    const ai = aiScoresOf(submission);
    return {
      review: { id: review.id, kind: review.kind, requestedAt: iso(review.requestedAt), expiresAt: iso(review.expiresAt), claimedAt: iso(review.claimedAt), lockedUntil: iso(review.lockedUntil) },
      prompt: {
        title: prompt.title,
        level: prompt.level,
        topic: prompt.topic,
        text: prompt.text,
        audioUrl: prompt.audioUrl || null,
        instructions: prompt.instructions,
        imageUrl: prompt.imageUrl || null,
        taskType: prompt.taskType,
        minWords: prompt.minWords,
        maxWords: prompt.maxWords,
        maxSeconds: prompt.maxSeconds,
        sampleAnswer: prompt.sampleAnswer,
        keyPoints: prompt.keyPoints || [],
      },
      work: {
        answer: submission.answer || null,
        words: submission.answer ? countWords(submission.answer) : null,
        recordingUrl: submission.recording && !submission.recordingDeletedAt ? submission.recording.url : null,
        durationSeconds: submission.recording?.durationSeconds ?? null,
      },
      ai: { status: submission.status, error: submission.error || null, scores: ai, result: submission.result || null },
      criteria: REVIEW_CRITERIA[review.kind],
      maxScore: reviewMaxScore(review.kind),
    };
  }

  async claim(actor, reviewId) {
    this.assertRole(actor, AccountRole.TEACHER);
    const at = this.now();
    const claimed = await this.repository.claim(reviewId, actor.id, at, new Date(at.getTime() + TEACHER_REVIEW_LIMITS.lockHours * HOUR_MS));
    if (!claimed) {
      const review = await this.repository.findReview(reviewId);
      if (!review || review.status !== ReviewStatus.WAITING || new Date(review.expiresAt) <= at) throw reviewErrors.notFound();
      throw reviewErrors.locked();
    }
    return this.detail(claimed);
  }

  async getReview(actor, reviewId) {
    this.assertRole(actor, AccountRole.TEACHER);
    return this.detail(await this.ownClaim(actor, reviewId));
  }

  async release(actor, reviewId) {
    this.assertRole(actor, AccountRole.TEACHER);
    await this.ownClaim(actor, reviewId);
    await this.repository.release(reviewId, actor.id);
    return { released: true };
  }

  checkScores(kind, scores = {}) {
    const clean = {};
    for (const { key, label, min, max, step } of REVIEW_CRITERIA[kind]) {
      const value = Number(scores[key]);
      if (!Number.isFinite(value) || value < min || value > max) throw reviewErrors.invalid(`${label} must be between ${min} and ${max}`, ['scores', key]);
      clean[key] = Math.round(value / step) * step;
      clean[key] = Math.round(clean[key] * 10) / 10;
    }
    return clean;
  }

  async complete(actor, reviewId, { action, scores, note }) {
    this.assertRole(actor, AccountRole.TEACHER);
    const review = await this.ownClaim(actor, reviewId);
    const submission = await this.repository.findSubmission(review.submissionId);
    const ai = aiScoresOf(submission);
    const text = String(note || '').trim();
    if (!ai && action !== ReviewAction.FROM_SCRATCH) throw reviewErrors.invalid('There is no AI score to keep; grade it from the start', ['action']);
    if (ai && action === ReviewAction.FROM_SCRATCH) throw reviewErrors.invalid('This answer has an AI score; confirm or change it', ['action']);
    if (action !== ReviewAction.CONFIRM && !text) throw reviewErrors.invalid('Write a comment for the learner', ['note']);
    const after = action === ReviewAction.CONFIRM ? ai : reviewScores(review.kind, this.checkScores(review.kind, scores));
    const at = this.now();
    const teacherReview = { action, scores: after, note: text || null, reviewedAt: at.toISOString() };
    await this.repository.complete(
      { ...review, status: ReviewStatus.DONE, completedAt: at, lockedUntil: null, action, before: ai, after, note: text || null },
      { id: submission.id, teacherReview },
      {
        type: LearningEventType.REVIEW_COMPLETED,
        queue: null,
        payload: { accountId: submission.accountId, submissionId: submission.id, promptId: submission.promptId, kind: submission.kind, title: submission.prompt.title || '', total: after.total, reviewedAt: at.toISOString() },
        requestId: currentRequestId(),
        createdAt: at,
        publishedAt: null,
      },
    );
    this.events.flush?.().catch(() => {});
    return { review: { id: review.id, status: ReviewStatus.DONE, action, scores: after } };
  }

  async expireDue(limit = 100) {
    const at = this.now();
    let expired = 0;
    for (const review of await this.repository.listExpired(at, limit)) {
      const submission = await this.repository.findSubmission(review.submissionId);
      const done = await this.repository.expire(review, {
        type: LearningEventType.REVIEW_EXPIRED,
        queue: null,
        payload: { accountId: review.accountId, submissionId: review.submissionId, promptId: submission?.promptId || review.submissionId, kind: review.kind, title: submission?.prompt?.title || '', expiredAt: at.toISOString() },
        requestId: null,
        createdAt: at,
        publishedAt: null,
      });
      if (done) expired++;
    }
    if (expired) this.events.flush?.().catch(() => {});
    return expired;
  }
}
