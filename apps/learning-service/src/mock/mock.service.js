import { AccountRole } from '@appenglish/auth-contracts';
import { LESSON_TEST_PARTS, MOCK_LISTENING_MAX_MINUTES, MOCK_READING_MINUTES, MockFormat, Skill, TOEIC_SECTION_SEDIFF, TOEIC_SECTION_SEM } from '@appenglish/content-contracts';
import { GOAL_HISTORY_SIZE, GOAL_RECENT_ATTEMPTS, MOCK_MISTAKE_CLEAR_STREAK, MOCK_MISTAKE_SESSION, LearningEventType, MOCK_STATS_MIN_LEARNERS, MockAttemptKind, PlacementStatus, StudyActivity } from '@appenglish/learning-contracts';
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
import { mockStats, numberOf } from './mock.stats.js';
import { mistakeSummary, mistakesOf } from './mistakes.rules.js';
import { goalView, partRates, swActivity, swEstimate, weakestPart } from './goal.rules.js';

const SUBMIT_GRACE_MS = 30 * 1000;
const MINUTE_MS = 60 * 1000;
const LISTENING_KEYS = LESSON_TEST_PARTS.filter((spec) => spec.skill === Skill.LISTENING).map((spec) => spec.key);
const isStrict = (attempt) => attempt.kind === MockAttemptKind.FULL && (attempt.format || MockFormat.FULL) === MockFormat.FULL;
const sectionTrend = (change) => (change >= TOEIC_SECTION_SEDIFF ? 'up' : change <= -TOEIC_SECTION_SEDIFF ? 'down' : 'same');
const listeningIdsOf = (test) => new Set(LISTENING_KEYS.flatMap((key) => test[key].questions.map((question) => question.id)));
const IN_PROGRESS = 'IN_PROGRESS';
const COMPLETED = 'COMPLETED';

const percent = (correctCount, totalCount) =>
  totalCount ? Math.round((correctCount * 100) / totalCount) : 0;
const sameAttemptSeries = (attempt, kind, partKey) =>
  attempt.kind === kind && attempt.partKey === (partKey || '');

export class MockService {
  constructor(repository, placementRepository, contentClient, { now = () => new Date(), random = Math.random, events = noEvents, swAttempts = null, practice = null } = {}) {
    this.repository = repository;
    this.placementRepository = placementRepository;
    this.contentClient = contentClient;
    this.events = events;
    this.swAttempts = swAttempts;
    this.practice = practice;
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

  async listMockTests(actor) {
    this.assertRole(actor, AccountRole.STUDENT);
    const [{ mockTests }, attempts, placement] = await Promise.all([
      this.contentClient.listPublishedMockTests(),
      this.repository.listFinishedAttempts(actor.id),
      this.placementRepository.findAttempt(actor.id),
    ]);
    const full = attempts.filter((attempt) => attempt.kind === MockAttemptKind.FULL);
    const scored = full.filter(isStrict);
    const latest = scored.at(-1);
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
          latestTotalScore: own.length && isStrict(own.at(-1)) ? own.at(-1).listeningScore + own.at(-1).readingScore : null,
        };
      }),
    };
  }

  async paper(mockTestId, versionId) {
    const paper = await this.contentClient.getMockPaper(mockTestId, versionId);
    if (!paper) throw mockErrors.notFound();
    return paper;
  }

  async attempts(actor, mockTestId) {
    const attempts = await this.repository.listTestAttempts(actor.id, mockTestId);
    for (const [index, attempt] of attempts.entries()) {
      if (attempt.status !== IN_PROGRESS) continue;
      if (this.isExpired(attempt)) attempts[index] = await this.complete(attempt, attempt.answers, actor);
      else attempts[index] = await this.settlePhase(attempt);
    }
    return attempts;
  }

  listeningCap(attempt) {
    return new Date(new Date(attempt.startedAt).getTime() + MOCK_LISTENING_MAX_MINUTES * MINUTE_MS);
  }

  async settlePhase(attempt) {
    if (!isStrict(attempt) || attempt.readingStartedAt || this.now() < this.listeningCap(attempt)) return attempt;
    return this.startReading(attempt, this.listeningCap(attempt));
  }

  async startReading(attempt, at) {
    attempt.readingStartedAt = at;
    attempt.expiresAt = new Date(at.getTime() + MOCK_READING_MINUTES * MINUTE_MS);
    return this.repository.saveAttempt(attempt);
  }

  async lockedAnswers(attempt, answers) {
    if (!isStrict(attempt) || !attempt.readingStartedAt) return answers;
    const listening = listeningIdsOf((await this.paper(attempt.mockTestId, attempt.mockVersionId)).test);
    const kept = Object.fromEntries(Object.entries(attempt.answers || {}).filter(([id]) => listening.has(id)));
    return { ...Object.fromEntries(Object.entries(answers).filter(([id]) => !listening.has(id))), ...kept };
  }

  isExpired(attempt) {
    return (
      Boolean(attempt.expiresAt) &&
      this.now().getTime() > new Date(attempt.expiresAt).getTime() + SUBMIT_GRACE_MS
    );
  }

  summary(attempt) {
    const full = isStrict(attempt) && attempt.listeningScore !== null && attempt.listeningScore !== undefined;
    return {
      format: attempt.format || MockFormat.FULL,
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
      estimated: full
        ? {
            listeningScore: attempt.listeningScore,
            readingScore: attempt.readingScore,
            totalScore: attempt.listeningScore + attempt.readingScore,
            margin: TOEIC_SECTION_SEM,
          }
        : null,
      countsForXp: full && attempt.attemptNumber === 1,
    };
  }

  series(attempts, kind, partKey) {
    const own = attempts.filter((attempt) => sameAttemptSeries(attempt, kind, partKey));
    const finished = own.filter((attempt) => attempt.status === COMPLETED);
    const progression = testProgression(finished);
    const [previous, latest] = finished.slice(-2);
    const scored = (attempt) => isStrict(attempt) && attempt?.listeningScore !== null && attempt?.listeningScore !== undefined;
    if (progression && scored(previous) && scored(latest)) {
      const listeningScoreChange = latest.listeningScore - previous.listeningScore;
      const readingScoreChange = latest.readingScore - previous.readingScore;
      Object.assign(progression, { listeningScoreChange, readingScoreChange, listeningTrend: sectionTrend(listeningScoreChange), readingTrend: sectionTrend(readingScoreChange) });
    }
    return {
      attempts: finished.map((attempt) => this.summary(attempt)),
      progression,
      inProgress: own.some((attempt) => attempt.status === IN_PROGRESS),
    };
  }

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
    const strict = isStrict(attempt);
    return {
      status: IN_PROGRESS,
      kind: attempt.kind,
      format: attempt.format || MockFormat.FULL,
      phase: strict ? (attempt.readingStartedAt ? 'reading' : 'listening') : null,
      listeningPosition: strict ? attempt.listeningPosition || 0 : null,
      listeningClosesAt: strict && !attempt.readingStartedAt ? this.listeningCap(attempt).toISOString() : null,
      readingStartedAt: attempt.readingStartedAt ? new Date(attempt.readingStartedAt).toISOString() : null,
      partKey: attempt.partKey || null,
      attemptNumber: attempt.attemptNumber,
      title: paper.mockTest.title,
      startedAt: new Date(attempt.startedAt).toISOString(),
      expiresAt: attempt.expiresAt ? new Date(attempt.expiresAt).toISOString() : null,
      serverNow: this.now().toISOString(),
      answers: attempt.answers,
      parts: testParts(
        { test: paper.test, media: paper.media },
        { optionOrder: attempt.optionOrder, partKeys: attempt.partKey ? [attempt.partKey] : undefined },
      ),
    };
  }

  async getMockAttempt(actor, mockTestId, { kind, partKey }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const open = (await this.attempts(actor, mockTestId)).find(
      (attempt) => attempt.status === IN_PROGRESS && sameAttemptSeries(attempt, kind, partKey),
    );
    if (!open) return { status: 'NONE' };
    return this.attemptView(open, await this.paper(mockTestId, open.mockVersionId));
  }

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
    const format = kind === MockAttemptKind.FULL ? paper.mockTest.format || MockFormat.FULL : MockFormat.PRACTICE;
    const strict = kind === MockAttemptKind.FULL && format === MockFormat.FULL;
    const created = await this.repository.createAttempt({
      accountId: actor.id,
      mockTestId,
      mockVersionId: paper.versionId,
      kind,
      partKey: partKey || '',
      attemptNumber: own.length + 1,
      status: IN_PROGRESS,
      startedAt,
      format,
      readingStartedAt: null,
      listeningPosition: 0,
      expiresAt: strict
        ? new Date(startedAt.getTime() + (MOCK_LISTENING_MAX_MINUTES + MOCK_READING_MINUTES) * MINUTE_MS)
        : kind === MockAttemptKind.FULL
          ? new Date(startedAt.getTime() + paper.mockTest.durationMinutes * MINUTE_MS)
          : null,
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

  async saveMockAnswers(actor, mockTestId, { answers, listeningPosition, ...reference }) {
    let attempt = await this.openAttempt(actor, mockTestId, reference);
    if (this.isExpired(attempt)) {
      await this.complete(attempt, attempt.answers, actor);
      throw mockErrors.notInProgress();
    }
    attempt = await this.settlePhase(attempt);
    attempt.answers = await this.lockedAnswers(attempt, answers);
    if (isStrict(attempt) && !attempt.readingStartedAt && listeningPosition !== undefined)
      attempt.listeningPosition = Math.max(attempt.listeningPosition || 0, listeningPosition);
    await this.repository.saveAttempt(attempt);
    return { saved: true };
  }

  async finishMockListening(actor, mockTestId, reference) {
    let attempt = await this.openAttempt(actor, mockTestId, reference);
    if (!isStrict(attempt)) throw mockErrors.notInProgress();
    if (this.isExpired(attempt)) {
      await this.complete(attempt, attempt.answers, actor);
      throw mockErrors.notInProgress();
    }
    attempt = await this.settlePhase(attempt);
    if (!attempt.readingStartedAt) {
      const cap = this.listeningCap(attempt);
      attempt = await this.startReading(attempt, this.now() < cap ? this.now() : cap);
    }
    return this.attemptView(attempt, await this.paper(mockTestId, attempt.mockVersionId));
  }

  async discardMockAttempt(actor, mockTestId, reference) {
    const attempt = await this.openAttempt(actor, mockTestId, reference);
    if (this.isExpired(attempt)) {
      await this.complete(attempt, attempt.answers, actor);
      throw mockErrors.notInProgress();
    }
    await this.repository.deleteOpenAttempt(attempt.id);
    return { discarded: true };
  }

  async submitMockAttempt(actor, mockTestId, { answers, ...reference }) {
    const attempt = await this.openAttempt(actor, mockTestId, reference);
    const finished = await this.complete(attempt, this.isExpired(attempt) ? attempt.answers : await this.lockedAnswers(await this.settlePhase(attempt), answers), actor);
    return this.reviewView(finished);
  }

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
    if (isStrict(attempt)) {
      const { listeningScore, readingScore } = estimatedScores(score, totals, await this.conversion());
      Object.assign(attempt, { listeningScore, readingScore });
    }
    const saved = await this.repository.saveAttempt(attempt);
    await recordActivity(this.events, saved.accountId, StudyActivity.MOCK_TEST, submittedAt);
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
        listeningScore: estimated?.listeningScore ?? null,
        readingScore: estimated?.readingScore ?? null,
      });
    }
    return saved;
  }

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

  async mistakeState(accountId) {
    const [attempts, reviews] = await Promise.all([this.repository.listCompletedAttempts(accountId), this.repository.listReviewAnswers(accountId)]);
    const papers = new Map();
    const pairs = new Map([...attempts.map((attempt) => [attempt.mockVersionId, attempt.mockTestId]), ...reviews.map((review) => [review.mockVersionId, review.mockTestId])]);
    for (const [versionId, mockTestId] of pairs) papers.set(versionId, await this.contentClient.getMockPaper(mockTestId, versionId).catch(() => null));
    const mistakes = mistakesOf(attempts, papers, reviews).filter((item) => papers.get(item.versionId));
    return { mistakes, papers };
  }

  mistakeQuestion(paper, mistake) {
    const part = paper.test[mistake.partKey];
    const index = part.questions.findIndex((question) => question.id === mistake.questionId);
    if (index === -1) return null;
    const [view] = testParts({ test: paper.test, media: paper.media || {} }, { partKeys: [mistake.partKey] });
    const question = view.questions[index];
    const group = question.groupId ? view.groups.find((item) => item.id === question.groupId) : null;
    return {
      questionId: question.id,
      partKey: mistake.partKey,
      partNumber: view.number,
      partTitle: view.title,
      number: numberOf(mistake.partKey, part, part.questions[index], index),
      mockTestTitle: paper.mockTest?.title || '',
      prompt: question.prompt,
      imageUrl: question.imageUrl,
      audioUrl: question.audioUrl || group?.audioUrl || view.audioUrl || null,
      passage: group?.passage || view.passage || '',
      passageImageUrl: group?.imageUrl || view.imageUrl || null,
      options: question.options,
      lettersOnly: !LESSON_TEST_PARTS.find((spec) => spec.key === mistake.partKey).option.text,
      streak: mistake.streak,
      wrongCount: mistake.wrongCount,
    };
  }

  async getMockMistakes(actor) {
    this.assertRole(actor, AccountRole.STUDENT);
    const { mistakes } = await this.mistakeState(actor.id);
    return { total: mistakes.length, clearStreak: MOCK_MISTAKE_CLEAR_STREAK, parts: mistakeSummary(mistakes) };
  }

  async getMistakePractice(actor, { partKey } = {}) {
    this.assertRole(actor, AccountRole.STUDENT);
    const { mistakes, papers } = await this.mistakeState(actor.id);
    const chosen = mistakes.filter((item) => !partKey || item.partKey === partKey).slice(0, MOCK_MISTAKE_SESSION);
    return { total: mistakes.length, questions: chosen.map((item) => this.mistakeQuestion(papers.get(item.versionId), item)).filter(Boolean) };
  }

  async answerMistake(actor, { questionId, optionId }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const { mistakes, papers } = await this.mistakeState(actor.id);
    const mistake = mistakes.find((item) => item.questionId === questionId);
    if (!mistake) throw mockErrors.mistakeNotFound();
    const paper = papers.get(mistake.versionId);
    const part = paper.test[mistake.partKey];
    const question = part.questions.find((item) => item.id === questionId);
    const group = question.groupId ? (part.groups || []).find((item) => item.id === question.groupId) : null;
    const correct = Boolean(question.options.find((option) => option.id === optionId)?.isCorrect);
    const at = this.now();
    await this.repository.saveReviewAnswer({ accountId: actor.id, mockTestId: mistake.mockTestId, mockVersionId: mistake.versionId, partKey: mistake.partKey, questionId, optionId: optionId || null, correct, answeredAt: at });
    await recordActivity(this.events, actor.id, StudyActivity.MISTAKE_REVIEW, at);
    const streak = correct ? mistake.streak + 1 : 0;
    return {
      correct,
      correctOptionId: question.options.find((option) => option.isCorrect)?.id || null,
      explanation: question.explanation || '',
      transcript: question.transcript || group?.transcript || part.transcript || '',
      streak,
      cleared: streak >= MOCK_MISTAKE_CLEAR_STREAK,
      remaining: mistakes.length - (streak >= MOCK_MISTAKE_CLEAR_STREAK ? 1 : 0),
    };
  }

  async getStudyGoal(actor) {
    this.assertRole(actor, AccountRole.STUDENT);
    const [goal, finished, recent, swRows, practiceRows] = await Promise.all([
      this.repository.findGoal(actor.id),
      this.repository.listFinishedAttempts(actor.id),
      this.repository.listRecentAttempts(actor.id, GOAL_RECENT_ATTEMPTS),
      this.swAttempts ? this.swAttempts.listAttempts(actor.id) : [],
      this.practice ? this.practice.listScored(actor.id, ['read_aloud', 'open_speaking', 'writing']) : [],
    ]);
    const scored = finished.filter((attempt) => attempt.kind === MockAttemptKind.FULL && attempt.listeningScore !== null && attempt.listeningScore !== undefined);
    const latest = scored.at(-1);
    const papers = new Map();
    for (const attempt of recent)
      if (!papers.has(attempt.mockVersionId)) papers.set(attempt.mockVersionId, await this.contentClient.getMockPaper(attempt.mockTestId, attempt.mockVersionId).catch(() => null));
    const parts = partRates(recent, papers);
    return {
      goal: goalView(goal),
      estimate: latest
        ? { total: latest.listeningScore + latest.readingScore, listening: latest.listeningScore, reading: latest.readingScore, mockTestId: latest.mockTestId, at: new Date(latest.submittedAt).toISOString() }
        : null,
      history: scored.slice(-GOAL_HISTORY_SIZE).map((attempt) => ({ at: new Date(attempt.submittedAt).toISOString(), total: attempt.listeningScore + attempt.readingScore, mockTestId: attempt.mockTestId })),
      parts,
      weakestPart: weakestPart(parts)?.key || null,
      sw: { ...swActivity(swRows, practiceRows), estimate: swEstimate(swRows) },
      today: this.now().toISOString(),
    };
  }

  async saveStudyGoal(actor, { lr, sw }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const today = this.now().toISOString().slice(0, 10);
    if ((lr?.examDate && lr.examDate < today) || (sw?.examDate && sw.examDate < today)) throw mockErrors.goalInvalid('The exam date is in the past');
    await this.repository.saveGoal({
      accountId: actor.id,
      lrEnabled: Boolean(lr),
      targetScore: lr?.targetScore ?? null,
      examDate: lr?.examDate || null,
      swEnabled: Boolean(sw),
      speakingTarget: sw?.speakingTarget ?? null,
      writingTarget: sw?.writingTarget ?? null,
      swExamDate: sw?.examDate || null,
    });
    return this.getStudyGoal(actor);
  }

  async deleteStudyGoal(actor) {
    this.assertRole(actor, AccountRole.STUDENT);
    await this.repository.deleteGoal(actor.id);
    return this.getStudyGoal(actor);
  }

  async getMockStats(actor, mockTestId) {
    this.assertRole(actor, AccountRole.CONTENT_MANAGER);
    const attempts = await this.repository.listCompletedTestAttempts(mockTestId);
    const fetch = (versionId) => this.contentClient.getMockPaper(mockTestId, versionId).catch(() => null);
    const paper = await fetch();
    const papers = new Map();
    for (const versionId of new Set(attempts.map((attempt) => attempt.mockVersionId)))
      papers.set(versionId, paper?.versionId === versionId ? paper : await fetch(versionId));
    return mockStats({ paper, papers, attempts, minLearners: MOCK_STATS_MIN_LEARNERS });
  }

  async getScoreConversion(actor) {
    this.assertRole(actor, AccountRole.ADMIN);
    return { conversion: await this.conversion(), isDefault: !(await this.repository.findConversion()) };
  }

  async updateScoreConversion(actor, conversion) {
    this.assertRole(actor, AccountRole.ADMIN);
    await this.repository.saveConversion({ ...conversion, updatedBy: actor.id });
    return this.getScoreConversion(actor);
  }
}
