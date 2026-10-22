import { Logger } from '@nestjs/common';
import { AccountRole } from '@appenglish/auth-contracts';
import { LearningEventType, MockAttemptKind } from '@appenglish/learning-contracts';
import { LEADERBOARD_SIZE, ProgressSkill, ProgressSource } from '@appenglish/progress-contracts';
import { progressErrors } from './progress.errors.js';
import { completion, skillMastery } from './progress.rules.js';
import { learnerIdSchema, payloadSchemas, resultMessageSchema } from './progress.schemas.js';
import { dayOf, streakView } from './streak.rules.js';
import { earnsXp, rankTotals, xpOf } from './xp.rules.js';

const logger = new Logger('ProgressService');

const counts = (payload) => ({
  attemptNumber: payload.attemptNumber,
  correctCount: payload.correctCount,
  totalCount: payload.totalCount,
  listeningCorrect: payload.listeningCorrect,
  listeningTotal: payload.listeningTotal,
  readingCorrect: payload.readingCorrect,
  readingTotal: payload.readingTotal,
  submittedAt: new Date(payload.submittedAt),
});

// Progress (F06, D33): lessons completed over the published lessons, and the
// Reading and Listening mastery from the lesson tests and full mock tests.
// Results arrive as learning.results messages; the curriculum is read from
// content-service.
export class ProgressService {
  constructor(repository, contentClient, { now = () => new Date() } = {}) {
    this.repository = repository;
    this.contentClient = contentClient;
    this.now = now;
  }

  assertStudent(actor) {
    if (actor.role !== AccountRole.STUDENT) throw progressErrors.forbiddenRole();
  }

  async getProgress(actor) {
    this.assertStudent(actor);
    return this.progressOf(actor.id);
  }

  // Admin (D114): the progress and XP of one learner, read-only. The id must
  // be a UUID; a learner without results simply has empty numbers.
  async getLearnerSummary(actor, learnerId) {
    if (actor.role !== AccountRole.ADMIN) throw progressErrors.forbiddenRole();
    const id = learnerIdSchema.parse(learnerId);
    const [progress, xp] = await Promise.all([this.progressOf(id), this.xpOf(id)]);
    return { learnerId: id, progress, xp };
  }

  async progressOf(accountId) {
    const [results, completions, curriculum] = await Promise.all([
      this.repository.listResults(accountId),
      this.repository.listCompletions(accountId),
      this.contentClient.getCurriculum(),
    ]);
    return {
      completion: completion(completions, curriculum),
      skills: {
        listening: skillMastery(results, ProgressSkill.LISTENING),
        reading: skillMastery(results, ProgressSkill.READING),
      },
      // How many finished tests the mastery rests on, by kind.
      attempts: {
        lessonTests: results.filter((result) => result.source === ProgressSource.LESSON_TEST).length,
        mockTests: results.filter((result) => result.source === ProgressSource.MOCK_TEST).length,
      },
    };
  }

  // Applies one learning.results message. Invalid messages throw a ZodError
  // (the consumer drops them); unknown types are ignored. Applying the same
  // message twice stores nothing new.
  async applyResult(message) {
    const { type, payload } = resultMessageSchema.parse(message);
    const schema = payloadSchemas[type];
    if (!schema) {
      logger.warn(`Ignored learning result of unknown type ${type}`);
      return false;
    }
    const data = schema.parse(payload);
    if (type === LearningEventType.LESSON_TEST_SUBMITTED) {
      await this.repository.saveResult({
        id: data.attemptId,
        accountId: data.accountId,
        source: ProgressSource.LESSON_TEST,
        sourceId: data.lessonId,
        ...counts(data),
      });
    } else if (type === LearningEventType.ACTIVITY_RECORDED) {
      const at = new Date(data.occurredAt);
      await this.repository.saveStudyDay({ accountId: data.accountId, day: dayOf(at), activity: data.activity, at });
    } else if (type === LearningEventType.LESSON_COMPLETED) {
      await this.repository.saveCompletion({ accountId: data.accountId, lessonId: data.lessonId, completedAt: new Date(data.completedAt) });
    } else if (type === LearningEventType.MOCK_SUBMITTED) {
      // Only full tests count (workflow 07); learning-service sends no others.
      if (data.kind !== MockAttemptKind.FULL) return false;
      await this.repository.saveResult({
        id: data.attemptId,
        accountId: data.accountId,
        source: ProgressSource.MOCK_TEST,
        sourceId: data.mockTestId,
        ...counts(data),
      });
      // XP from the first full attempt only (D63); one row per test.
      if (earnsXp(data)) {
        await this.repository.saveXp({
          id: data.attemptId,
          accountId: data.accountId,
          accountEmail: data.accountEmail,
          mockTestId: data.mockTestId,
          mockTestTitle: data.mockTestTitle,
          correctCount: data.correctCount,
          totalCount: data.totalCount,
          xp: xpOf(data.correctCount, data.totalCount),
          earnedAt: new Date(data.submittedAt),
        });
      }
    }
    return true;
  }

  async getStreak(actor) {
    this.assertStudent(actor);
    return streakView(await this.repository.listStudyDays(actor.id), this.now());
  }

  // The learner's XP (F07): the total, their rank, and the mock tests it
  // came from, latest first.
  async getXp(actor) {
    this.assertStudent(actor);
    return this.xpOf(actor.id);
  }

  async xpOf(accountId) {
    const [entries, totals] = await Promise.all([this.repository.listXp(accountId), this.repository.listXpTotals()]);
    const own = rankTotals(totals).find((entry) => entry.accountId === accountId) || null;
    return {
      totalXp: own?.totalXp ?? 0,
      rank: own?.rank ?? null,
      learnerCount: totals.length,
      entries: entries.map((entry) => ({
        mockTestId: entry.mockTestId,
        mockTestTitle: entry.mockTestTitle,
        xp: entry.xp,
        correctCount: entry.correctCount,
        totalCount: entry.totalCount,
        earnedAt: new Date(entry.earnedAt).toISOString(),
      })),
    };
  }

  // The XP leaderboard (D39): the top learners by total XP, ties broken by
  // who reached the total first, and the learner's own place.
  async getLeaderboard(actor) {
    this.assertStudent(actor);
    const ranked = rankTotals(await this.repository.listXpTotals());
    const view = (entry) => ({
      rank: entry.rank,
      accountId: entry.accountId,
      email: entry.accountEmail,
      totalXp: entry.totalXp,
      mockCount: entry.mockCount,
      reachedAt: new Date(entry.reachedAt).toISOString(),
      isYou: entry.accountId === actor.id,
    });
    const own = ranked.find((entry) => entry.accountId === actor.id);
    return {
      entries: ranked.slice(0, LEADERBOARD_SIZE).map(view),
      learnerCount: ranked.length,
      you: own ? view(own) : null,
    };
  }
}
