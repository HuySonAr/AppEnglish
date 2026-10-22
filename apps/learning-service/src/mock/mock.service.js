import { AccountRole } from '@appenglish/auth-contracts';
import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import { LearningEventType, MockAttemptKind, PlacementStatus, StudyActivity } from '@appenglish/learning-contracts';
import {
  scoreTest,
  shuffledOptionOrder,
  skillTotals,
  testParts,
  testProgression,
} from '../lesson/lesson.rules.js';
import { noEvents, recordActivity } from '../events/learning-events.js';
import { placementErrors } from '../placement/placement.errors.js';
import { mockErrors } from './mock.errors.js';
import { defaultScoreConversion, estimatedScores, recommendedLevel } from './mock.rules.js';

// A submit that arrives this long after the deadline still counts.
const SUBMIT_GRACE_MS = 30 * 1000;
const IN_PROGRESS = 'IN_PROGRESS';
const COMPLETED = 'COMPLETED';

const percent = (correctCount, totalCount) =>
  totalCount ? Math.round((correctCount * 100) / totalCount) : 0;
// Attempts of the full test have partKey ''; a mini test has its part's key.
const sameAttemptSeries = (attempt, kind, partKey) =>
  attempt.kind === kind && attempt.partKey === (partKey || '');

export class MockService {
  // contentClient reads published mock tests from content-service;
  // placementRepository gives the starting unit for the first suggestion;
  // events reports finished full tests to progress-service (F06); now() and
  // random() are replaceable in tests.
  constructor(repository, placementRepository, contentClient, { now = () => new Date(), random = Math.random, events = noEvents } = {}) {
    this.repository = repository;
    this.placementRepository = placementRepository;
    this.contentClient = contentClient;
    this.events = events;
    this.now = now;
    this.random = random;
  }

  assertRole(actor, role) {
    if (actor.role !== role) throw placementErrors.forbiddenRole();
  }

  async conversion() {
    const stored = await this.repository.findConversion();
    return stored ? { listening: stored.listening, reading: stored.reading } : defaultScoreConversion();
  }

  // Published mock tests with the learner's results and the suggested level.
  async listMockTests(actor) {
    this.assertRole(actor, AccountRole.STUDENT);
    const [{ mockTests }, attempts, placement] = await Promise.all([
      this.contentClient.listPublishedMockTests(),
      this.repository.listFinishedAttempts(actor.id),
      this.placementRepository.findAttempt(actor.id),
    ]);
    const full = attempts.filter((attempt) => attempt.kind === MockAttemptKind.FULL);
    const latest = full.at(-1);
    const level = recommendedLevel({
      latestTotalScore: latest ? latest.listeningScore + latest.readingScore : null,
      startUnit: placement && placement.status !== PlacementStatus.IN_PROGRESS ? placement.startUnit : null,
    });
    return {
      recommendedLevel: level,
      mockTests: mockTests.map((mockTest) => {
        const own = full.filter((attempt) => attempt.mockTestId === mockTest.id);
        return {
          ...mockTest,
          recommended: mockTest.level === level,
          attemptCount: own.length,
          bestPercent: own.length
            ? Math.max(...own.map((attempt) => percent(attempt.correctCount, attempt.totalCount)))
            : null,
          latestTotalScore: own.length ? own.at(-1).listeningScore + own.at(-1).readingScore : null,
        };
      }),
    };
  }

  async paper(mockTestId, versionId) {
    const paper = await this.contentClient.getMockPaper(mockTestId, versionId);
    if (!paper) throw mockErrors.notFound();
    return paper;
  }

  // The learner's attempts at one mock test; a full attempt whose time ran
  // out is finished first with the answers saved so far.
  async attempts(actor, mockTestId) {
    const attempts = await this.repository.listTestAttempts(actor.id, mockTestId);
    for (const [index, attempt] of attempts.entries())
      if (attempt.status === IN_PROGRESS && this.isExpired(attempt))
        attempts[index] = await this.complete(attempt, attempt.answers, actor);
    return attempts;
  }

  isExpired(attempt) {
    return (
      Boolean(attempt.expiresAt) &&
      this.now().getTime() > new Date(attempt.expiresAt).getTime() + SUBMIT_GRACE_MS
    );
  }

  summary(attempt) {
    const full = attempt.kind === MockAttemptKind.FULL;
    return {
      attemptNumber: attempt.attemptNumber,
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
      scorePercent: percent(attempt.correctCount, attempt.totalCount),
      listeningCorrect: attempt.listeningCorrect,
      listeningTotal: attempt.listeningTotal,
      readingCorrect: attempt.readingCorrect,
      readingTotal: attempt.readingTotal,
      durationSeconds: attempt.durationSeconds,
      submittedAt: new Date(attempt.submittedAt).toISOString(),
      // Estimated TOEIC scores, for full tests only (D64).
      estimated: full
        ? {
            listeningScore: attempt.listeningScore,
            readingScore: attempt.readingScore,
            totalScore: attempt.listeningScore + attempt.readingScore,
          }
        : null,
      // Only the first full attempt of a mock test earns XP (D63).
      countsForXp: full && attempt.attemptNumber === 1,
    };
  }

  // What a learner sees of one series of attempts (the full test, or the mini
  // test of one part): the finished ones, how they develop, and whether one
  // is open.
  series(attempts, kind, partKey) {
    const own = attempts.filter((attempt) => sameAttemptSeries(attempt, kind, partKey));
    const finished = own.filter((attempt) => attempt.status === COMPLETED);
    return {
      attempts: finished.map((attempt) => this.summary(attempt)),
      progression: testProgression(finished),
      inProgress: own.some((attempt) => attempt.status === IN_PROGRESS),
    };
  }

  // One mock test: the full test and the mini test of each part, with the
  // learner's history of each.
  async getMockTest(actor, mockTestId) {
    this.assertRole(actor, AccountRole.STUDENT);
    const paper = await this.paper(mockTestId);
    const attempts = await this.attempts(actor, mockTestId);
    return {
      mockTest: {
        ...paper.mockTest,
        questionCount: Object.values(paper.test).reduce((sum, part) => sum + part.questions.length, 0),
      },
      full: this.series(attempts, MockAttemptKind.FULL),
      parts: LESSON_TEST_PARTS.map((spec) => ({
        key: spec.key,
        number: spec.number,
        title: spec.title,
        skill: spec.skill,
        questionCount: paper.test[spec.key].questions.length,
        mini: this.series(attempts, MockAttemptKind.MINI, spec.key),
      })),
    };
  }

  attemptView(attempt, paper) {
    return {
      status: IN_PROGRESS,
      kind: attempt.kind,
      partKey: attempt.partKey || null,
      attemptNumber: attempt.attemptNumber,
      title: paper.mockTest.title,
      startedAt: new Date(attempt.startedAt).toISOString(),
      // A mini test has no time limit (D63).
      expiresAt: attempt.expiresAt ? new Date(attempt.expiresAt).toISOString() : null,
      serverNow: this.now().toISOString(),
      answers: attempt.answers,
      parts: testParts(
        { test: paper.test, media: paper.media },
        { optionOrder: attempt.optionOrder, partKeys: attempt.partKey ? [attempt.partKey] : undefined },
      ),
    };
  }

  // The attempt in progress for the full test or a part's mini test, if any.
  async getMockAttempt(actor, mockTestId, { kind, partKey }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const open = (await this.attempts(actor, mockTestId)).find(
      (attempt) => attempt.status === IN_PROGRESS && sameAttemptSeries(attempt, kind, partKey),
    );
    if (!open) return { status: 'NONE' };
    return this.attemptView(open, await this.paper(mockTestId, open.mockVersionId));
  }

  // Starts the full test or the mini test of one part, or returns the one in
  // progress. Both can be taken any number of times.
  async startMockAttempt(actor, mockTestId, { kind, partKey }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const paper = await this.paper(mockTestId);
    const attempts = await this.attempts(actor, mockTestId);
    const own = attempts.filter((attempt) => sameAttemptSeries(attempt, kind, partKey));
    const open = own.find((attempt) => attempt.status === IN_PROGRESS);
    if (open) return this.attemptView(open, await this.paper(mockTestId, open.mockVersionId));
    const partKeys = partKey ? [partKey] : undefined;
    if (partKey && !paper.test[partKey].questions.length) throw mockErrors.notFound();
    const startedAt = this.now();
    const created = await this.repository.createAttempt({
      accountId: actor.id,
      mockTestId,
      mockVersionId: paper.versionId,
      kind,
      partKey: partKey || '',
      attemptNumber: own.length + 1,
      status: IN_PROGRESS,
      startedAt,
      expiresAt:
        kind === MockAttemptKind.FULL
          ? new Date(startedAt.getTime() + paper.mockTest.durationMinutes * 60 * 1000)
          : null,
      // Options of Parts 3-7 are shuffled for each attempt (D31).
      optionOrder: shuffledOptionOrder(paper.test, this.random, partKeys),
      answers: {},
    });
    if (!created) return this.getMockAttempt(actor, mockTestId, { kind, partKey });
    return this.attemptView(created, paper);
  }

  async openAttempt(actor, mockTestId, { kind, partKey }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const attempt = (await this.repository.listTestAttempts(actor.id, mockTestId)).find(
      (item) => item.status === IN_PROGRESS && sameAttemptSeries(item, kind, partKey),
    );
    if (!attempt) throw mockErrors.notInProgress();
    return attempt;
  }

  async saveMockAnswers(actor, mockTestId, { answers, ...reference }) {
    const attempt = await this.openAttempt(actor, mockTestId, reference);
    if (this.isExpired(attempt)) {
      await this.complete(attempt, attempt.answers, actor);
      throw mockErrors.notInProgress();
    }
    attempt.answers = answers;
    await this.repository.saveAttempt(attempt);
    return { saved: true };
  }

  // Throws away the attempt in progress: it is not scored and leaves no trace
  // in the history (D82). An attempt whose time already ran out is finished
  // instead, as it would be on the next visit.
  async discardMockAttempt(actor, mockTestId, reference) {
    const attempt = await this.openAttempt(actor, mockTestId, reference);
    if (this.isExpired(attempt)) {
      await this.complete(attempt, attempt.answers, actor);
      throw mockErrors.notInProgress();
    }
    await this.repository.deleteOpenAttempt(attempt.id);
    return { discarded: true };
  }

  // Scores the attempt and returns the result with every answer explained.
  async submitMockAttempt(actor, mockTestId, { answers, ...reference }) {
    const attempt = await this.openAttempt(actor, mockTestId, reference);
    // A submit after the grace period is scored with the answers saved in time.
    const finished = await this.complete(attempt, this.isExpired(attempt) ? attempt.answers : answers, actor);
    return this.reviewView(finished);
  }

  // actor is the learner, for the email the XP leaderboard shows (D112).
  async complete(attempt, answers, actor) {
    const paper = await this.paper(attempt.mockTestId, attempt.mockVersionId);
    const partKeys = attempt.partKey ? [attempt.partKey] : undefined;
    const score = scoreTest(paper.test, answers, partKeys);
    const totals = skillTotals(paper.test, partKeys);
    const submittedAt = this.now();
    const end = attempt.expiresAt
      ? Math.min(submittedAt.getTime(), new Date(attempt.expiresAt).getTime())
      : submittedAt.getTime();
    Object.assign(attempt, score, {
      answers,
      status: COMPLETED,
      submittedAt,
      listeningTotal: totals.listening,
      readingTotal: totals.reading,
      durationSeconds: Math.max(0, Math.round((end - new Date(attempt.startedAt).getTime()) / 1000)),
    });
    // The estimate is stored with the attempt, so a later change of the
    // conversion table does not rewrite past results.
    if (attempt.kind === MockAttemptKind.FULL) {
      const { listeningScore, readingScore } = estimatedScores(score, totals, await this.conversion());
      Object.assign(attempt, { listeningScore, readingScore });
    }
    const saved = await this.repository.saveAttempt(attempt);
    await recordActivity(this.events, saved.accountId, StudyActivity.MOCK_TEST, submittedAt);
    // Only full tests reach progress and XP; mini tests are practice (D63).
    if (saved.kind === MockAttemptKind.FULL) {
      const { estimated, countsForXp, durationSeconds, scorePercent, ...counts } = this.summary(saved);
      await this.events.record(LearningEventType.MOCK_SUBMITTED, {
        attemptId: saved.id,
        accountId: saved.accountId,
        accountEmail: actor?.email || '',
        mockTestId: saved.mockTestId,
        mockTestTitle: paper.mockTest?.title || '',
        mockVersionId: saved.mockVersionId,
        kind: saved.kind,
        ...counts,
        listeningScore: estimated.listeningScore,
        readingScore: estimated.readingScore,
      });
    }
    return saved;
  }

  // One finished attempt of a series (the latest, or the given number).
  async getMockReview(actor, mockTestId, { kind, partKey, attemptNumber }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const finished = (await this.attempts(actor, mockTestId)).filter(
      (attempt) => attempt.status === COMPLETED && sameAttemptSeries(attempt, kind, partKey),
    );
    const attempt = attemptNumber
      ? finished.find((item) => item.attemptNumber === attemptNumber)
      : finished.at(-1);
    if (!attempt) return { attempt: null, parts: [] };
    return this.reviewView(attempt);
  }

  async reviewView(attempt) {
    const paper = await this.paper(attempt.mockTestId, attempt.mockVersionId);
    return {
      kind: attempt.kind,
      partKey: attempt.partKey || null,
      attempt: this.summary(attempt),
      parts: testParts(
        { test: paper.test, media: paper.media },
        {
          optionOrder: attempt.optionOrder,
          answers: attempt.answers,
          partKeys: attempt.partKey ? [attempt.partKey] : undefined,
        },
      ),
    };
  }

  async getScoreConversion(actor) {
    this.assertRole(actor, AccountRole.ADMIN);
    return { conversion: await this.conversion(), isDefault: !(await this.repository.findConversion()) };
  }

  // The new table applies to tests finished afterwards; stored results keep
  // their estimate.
  async updateScoreConversion(actor, conversion) {
    this.assertRole(actor, AccountRole.ADMIN);
    await this.repository.saveConversion({ ...conversion, updatedBy: actor.id });
    return this.getScoreConversion(actor);
  }
}
