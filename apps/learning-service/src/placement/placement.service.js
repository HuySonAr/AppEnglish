import { AccountRole } from '@appenglish/auth-contracts';
import { LESSON_TEST_PARTS, Skill } from '@appenglish/content-contracts';
import {
  DEFAULT_PLACEMENT_THRESHOLDS,
  PLACEMENT_DURATION_MINUTES,
  PlacementStatus,
  placementStartUnit,
} from '@appenglish/learning-contracts';
import { placementErrors } from './placement.errors.js';

// A submit that arrives this long after the deadline still counts: the page
// submits on its own when the clock runs out and the request takes a moment.
const SUBMIT_GRACE_MS = 30 * 1000;

// Counts the right answers of a paper, in total and per skill.
export function scorePlacement(test, answers) {
  const score = { totalCount: 0, correctCount: 0, listeningCorrect: 0, readingCorrect: 0 };
  for (const spec of LESSON_TEST_PARTS) {
    for (const question of test[spec.key]?.questions || []) {
      score.totalCount++;
      const chosen = question.options.find((option) => option.id === answers[question.id]);
      if (!chosen?.isCorrect) continue;
      score.correctCount++;
      if (spec.skill === Skill.LISTENING) score.listeningCorrect++;
      else score.readingCorrect++;
    }
  }
  return score;
}

export class PlacementService {
  // contentClient.getPlacementPaper(versionId?) reads the test from
  // content-service; now() is replaceable in tests.
  constructor(repository, contentClient, now = () => new Date()) {
    this.repository = repository;
    this.contentClient = contentClient;
    this.now = now;
  }

  assertRole(actor, role) {
    if (actor.role !== role) throw placementErrors.forbiddenRole();
  }

  async thresholds() {
    const settings = await this.repository.findSettings();
    return settings
      ? { unit2Threshold: settings.unit2Threshold, unit3Threshold: settings.unit3Threshold }
      : { ...DEFAULT_PLACEMENT_THRESHOLDS };
  }

  // The learner's state: not started, in progress (with the paper), or the
  // result.
  async getPlacement(actor) {
    this.assertRole(actor, AccountRole.STUDENT);
    const attempt = await this.currentAttempt(actor.id);
    if (attempt) return this.view(attempt);
    return {
      status: PlacementStatus.NOT_STARTED,
      available: Boolean(await this.contentClient.getPlacementPaper()),
      durationMinutes: PLACEMENT_DURATION_MINUTES,
    };
  }

  async startPlacement(actor) {
    this.assertRole(actor, AccountRole.STUDENT);
    const existing = await this.currentAttempt(actor.id);
    // Asking again while the clock runs returns the same attempt.
    if (existing?.status === PlacementStatus.IN_PROGRESS) return this.view(existing);
    if (existing) throw placementErrors.alreadyTaken();
    const paper = await this.contentClient.getPlacementPaper();
    if (!paper) throw placementErrors.notAvailable();
    const startedAt = this.now();
    const created = await this.repository.createAttempt({
      accountId: actor.id,
      status: PlacementStatus.IN_PROGRESS,
      placementVersionId: paper.versionId,
      versionNumber: paper.versionNumber,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + PLACEMENT_DURATION_MINUTES * 60 * 1000),
      answers: {},
    });
    return this.view(created || (await this.currentAttempt(actor.id)), paper);
  }

  // Keeps the answers chosen so far, so they count if the time runs out and
  // survive a page reload.
  async savePlacementAnswers(actor, { answers }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const attempt = await this.currentAttempt(actor.id);
    if (attempt?.status !== PlacementStatus.IN_PROGRESS) throw placementErrors.notInProgress();
    attempt.answers = answers;
    await this.repository.saveAttempt(attempt);
    return { saved: true };
  }

  async submitPlacement(actor, { answers }) {
    this.assertRole(actor, AccountRole.STUDENT);
    const attempt = await this.repository.findAttempt(actor.id);
    if (attempt?.status !== PlacementStatus.IN_PROGRESS) throw placementErrors.notInProgress();
    // A submit after the grace period is scored with the answers saved in time.
    const late = this.now().getTime() > new Date(attempt.expiresAt).getTime() + SUBMIT_GRACE_MS;
    return this.view(await this.complete(attempt, late ? attempt.answers : answers));
  }

  // Skipping uses up the single attempt and starts the learner at unit 1.
  async skipPlacement(actor) {
    this.assertRole(actor, AccountRole.STUDENT);
    if (await this.currentAttempt(actor.id)) throw placementErrors.alreadyTaken();
    const created = await this.repository.createAttempt({
      accountId: actor.id,
      status: PlacementStatus.SKIPPED,
      submittedAt: this.now(),
      answers: {},
      startUnit: 1,
    });
    if (!created) throw placementErrors.alreadyTaken();
    return this.view(created);
  }

  async getPlacementSettings(actor) {
    this.assertRole(actor, AccountRole.ADMIN);
    return { settings: await this.thresholds(), durationMinutes: PLACEMENT_DURATION_MINUTES };
  }

  // New thresholds apply to attempts completed afterwards; earlier results
  // keep their starting unit.
  async updatePlacementSettings(actor, settings) {
    this.assertRole(actor, AccountRole.ADMIN);
    await this.repository.saveSettings({ ...settings, updatedBy: actor.id });
    return this.getPlacementSettings(actor);
  }

  // The stored attempt; one whose time ran out is completed first with the
  // answers saved so far.
  async currentAttempt(accountId) {
    const attempt = await this.repository.findAttempt(accountId);
    if (
      attempt?.status === PlacementStatus.IN_PROGRESS &&
      this.now().getTime() > new Date(attempt.expiresAt).getTime() + SUBMIT_GRACE_MS
    )
      return this.complete(attempt, attempt.answers);
    return attempt;
  }

  async complete(attempt, answers) {
    const paper = await this.contentClient.getPlacementPaper(attempt.placementVersionId);
    if (!paper) throw placementErrors.notAvailable();
    const score = scorePlacement(paper.test, answers);
    Object.assign(attempt, score, {
      answers,
      status: PlacementStatus.COMPLETED,
      submittedAt: this.now(),
      startUnit: placementStartUnit(
        score.correctCount,
        score.totalCount,
        await this.thresholds(),
        paper.publishedUnitCount,
      ),
    });
    return this.repository.saveAttempt(attempt);
  }

  async view(attempt, paper) {
    if (attempt.status === PlacementStatus.IN_PROGRESS) {
      const source = paper || (await this.contentClient.getPlacementPaper(attempt.placementVersionId));
      if (!source) throw placementErrors.notAvailable();
      return {
        status: attempt.status,
        startedAt: new Date(attempt.startedAt).toISOString(),
        expiresAt: new Date(attempt.expiresAt).toISOString(),
        serverNow: this.now().toISOString(),
        durationMinutes: PLACEMENT_DURATION_MINUTES,
        answers: attempt.answers,
        parts: this.learnerParts(source),
      };
    }
    // The result shows the score and the starting unit only (D56).
    const result = { status: attempt.status, startUnit: attempt.startUnit };
    if (attempt.status === PlacementStatus.COMPLETED)
      Object.assign(result, {
        correctCount: attempt.correctCount,
        totalCount: attempt.totalCount,
        // Stored exactly, shown as a whole percent (D39).
        scorePercent: attempt.totalCount
          ? Math.round((attempt.correctCount * 100) / attempt.totalCount)
          : 0,
      });
    return result;
  }

  // The paper as the learner sees it: no correct answers, explanations or
  // transcripts.
  learnerParts(paper) {
    const url = (mediaId) => (mediaId && paper.media[mediaId]?.url) || null;
    return LESSON_TEST_PARTS.map((spec) => {
      const part = paper.test[spec.key];
      return {
        key: spec.key,
        number: spec.number,
        title: spec.title,
        skill: spec.skill,
        audioUrl: url(part.audioMediaId),
        imageUrl: url(part.imageMediaId),
        passage: part.passage,
        questions: part.questions.map((question, index) => ({
          id: question.id,
          number: spec.firstQuestionNumber + index,
          prompt: question.prompt,
          imageUrl: url(question.imageMediaId),
          options: question.options.map((option) => ({ id: option.id, text: option.text })),
        })),
      };
    });
  }
}
