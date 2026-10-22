import { AccountRole } from '@appenglish/auth-contracts';
import {
  DEFAULT_PLACEMENT_THRESHOLDS,
  PLACEMENT_DURATION_MINUTES,
  PlacementStatus,
  placementStartUnit,
} from '@appenglish/learning-contracts';
import { scoreTest, testParts } from '../lesson/lesson.rules.js';
import { placementErrors } from './placement.errors.js';

// A submit that arrives this long after the deadline still counts: the page
// submits on its own when the clock runs out and the request takes a moment.
const SUBMIT_GRACE_MS = 30 * 1000;

// Kept under this name for placement callers.
export { scoreTest as scorePlacement };

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

  // An admin lets a learner take the placement again (D131): the single
  // attempt is removed, so the lessons lock until the test is taken or
  // skipped again and the starting unit is decided anew. Lesson progress and
  // results are untouched. The gateway writes the audit row in auth-service.
  async adminResetPlacement(actor, accountId) {
    this.assertRole(actor, AccountRole.ADMIN);
    const reset = await this.repository.deleteAttempt(accountId);
    return { reset };
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
    const score = scoreTest(paper.test, answers);
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
        // No correct answers, explanations or transcripts.
        parts: testParts(source),
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
}
