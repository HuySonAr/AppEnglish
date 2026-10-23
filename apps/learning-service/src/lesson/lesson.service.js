import { AccountRole } from '@appenglish/auth-contracts';
import { UNIT_REVIEW_PARTS, UNIT_REVIEW_QUESTION_COUNT, countBlanks } from '@appenglish/content-contracts';
import {
  LESSON_PASS_PERCENT,
  LESSON_TEST_DURATION_MINUTES,
  LearningEventType,
  StudyActivity,
  LessonState,
  LessonStep,
  LessonTestStatus,
  PlacementStatus,
  QuizKind,
  StepStatus,
  UnitReviewState,
  VOCABULARY_PRACTICE_SIZE,
  lessonTestPassed,
} from '@appenglish/learning-contracts';
import { noEvents, recordActivity } from '../events/learning-events.js';
import { placementErrors } from '../placement/placement.errors.js';
import { lessonErrors } from './lesson.errors.js';
import {
  SKILL_TOTALS,
  lessonAccess,
  lessonSteps,
  practiceWords,
  scoreTest,
  shuffled,
  shuffledOptionOrder,
  testParts,
  testProgression,
  unitReviewAccess,
  vocabularyPractice,
  vocabularyQuiz,
  wrongBlanks,
  wrongQuizAnswers,
} from './lesson.rules.js';

const SUBMIT_GRACE_MS = 30 * 1000;
const RANKING_SIZE = 50;
const IN_PROGRESS = 'IN_PROGRESS';
const COMPLETED = 'COMPLETED';

const percent = (correctCount, totalCount) =>
  totalCount ? Math.round((correctCount * 100) / totalCount) : 0;

export class LessonService {
  constructor(repository, placementRepository, contentClient, { now = () => new Date(), random = Math.random, events = noEvents } = {}) {
    this.repository = repository;
    this.placementRepository = placementRepository;
    this.contentClient = contentClient;
    this.events = events;
    this.now = now;
    this.random = random;
  }

  assertStudent(actor) {
    if (actor.role !== AccountRole.STUDENT) throw placementErrors.forbiddenRole();
  }

  async standing(actor) {
    const [curriculum, placement, progress, reviewAttempts] = await Promise.all([
      this.contentClient.getCurriculum(),
      this.placementRepository.findAttempt(actor.id),
      this.repository.listProgress(actor.id),
      this.repository.listReviewAttempts(actor.id),
    ]);
    const placed = Boolean(placement) && placement.status !== PlacementStatus.IN_PROGRESS;
    const startUnit = placed ? placement.startUnit : null;
    const completed = new Set(progress.filter((row) => row.completedAt).map((row) => row.lessonId));
    const passedReviews = new Set(reviewAttempts.filter((attempt) => attempt.passed).map((attempt) => attempt.unitId));
    return {
      curriculum,
      placementRequired: !placed,
      startUnit,
      access: lessonAccess(curriculum, startUnit, completed, passedReviews),
      reviews: unitReviewAccess(curriculum, startUnit, completed, passedReviews),
      reviewAttempts,
      progress: new Map(progress.map((row) => [row.lessonId, row])),
    };
  }

  async getCurriculum(actor) {
    this.assertStudent(actor);
    const standing = await this.standing(actor);
    const best = new Map();
    for (const attempt of await this.repository.listCompletedAttempts(actor.id)) {
      const score = percent(attempt.correctCount, attempt.totalCount);
      if (score > (best.get(attempt.lessonId) ?? -1)) best.set(attempt.lessonId, score);
    }
    return {
      placementRequired: standing.placementRequired,
      startUnit: standing.startUnit,
      units: standing.curriculum.units.map((unit, index) => ({
        id: unit.id,
        number: index + 1,
        title: unit.title,
        description: unit.description,
        review: this.reviewSummary(standing, unit.id),
        lessons: unit.lessons.map((lesson) => {
          const entry = standing.access.get(lesson.id);
          return {
            id: lesson.id,
            number: entry.lessonNumber,
            title: lesson.title,
            state: entry.state,
            bestPercent: best.get(lesson.id) ?? null,
          };
        }),
      })),
    };
  }

  async open(actor, lessonId) {
    this.assertStudent(actor);
    const standing = await this.standing(actor);
    const entry = standing.access.get(lessonId);
    if (!entry) throw lessonErrors.notFound();
    if (entry.state === LessonState.LOCKED) throw lessonErrors.locked(standing.placementRequired);
    const paper = await this.contentClient.getLessonPaper(lessonId);
    if (!paper) throw lessonErrors.notFound();
    const progress = standing.progress.get(lessonId) || { accountId: actor.id, lessonId };
    return { standing, entry, paper, progress, steps: lessonSteps(entry, progress) };
  }

  requireStep(steps, step) {
    const target = steps.findIndex((item) => item.key === step);
    const blocking = steps.findIndex((item) => item.status !== StepStatus.DONE);
    if (blocking !== -1 && blocking < target) throw lessonErrors.stepRequired(steps[blocking].key);
  }

  async getLesson(actor, lessonId) {
    const { standing, entry, paper, progress, steps } = await this.open(actor, lessonId);
    const url = (mediaId) => (mediaId && paper.media[mediaId]?.url) || null;
    const { vocabulary, fillIn } = paper.content;
    const attempts = (await this.repository.listAttempts(actor.id, lessonId)).filter(
      (attempt) => attempt.status === COMPLETED,
    );
    const previous = entry.previousLessonId ? standing.access.get(entry.previousLessonId) : null;
    return {
      lesson: {
        id: lessonId,
        title: paper.lesson.title,
        number: entry.lessonNumber,
        unitNumber: entry.unitNumber,
        unitTitle: paper.lesson.unitTitle,
        state: entry.state,
      },
      steps,
      review: steps.some((step) => step.key === LessonStep.REVIEW)
        ? { lessonId: previous.lesson.id, lessonTitle: previous.lesson.title }
        : null,
      vocabulary: vocabulary.map((item) => ({
        id: item.id,
        word: item.word,
        partOfSpeech: item.partOfSpeech,
        phonetic: item.phonetic,
        meaning: item.meaning,
        example: item.example,
        exampleMeaning: item.exampleMeaning,
        audioUkUrl: url(item.audioUkMediaId),
        audioUsUrl: url(item.audioUsMediaId),
      })),
      fillIn: {
        passage: fillIn.passage,
        blankCount: countBlanks(fillIn.passage),
        wordBank: shuffled(fillIn.answers, this.random),
      },
      test: {
        durationMinutes: LESSON_TEST_DURATION_MINUTES,
        passPercent: LESSON_PASS_PERCENT,
        attemptCount: attempts.length,
        bestPercent: attempts.length
          ? Math.max(...attempts.map((attempt) => percent(attempt.correctCount, attempt.totalCount)))
          : null,
      },
    };
  }

  async markVocabularyStudied(actor, lessonId) {
    const { progress, steps } = await this.open(actor, lessonId);
    this.requireStep(steps, LessonStep.VOCABULARY);
    if (!progress.vocabularyStudiedAt)
      await this.repository.saveProgress({ ...progress, vocabularyStudiedAt: this.now() });
    await recordActivity(this.events, actor.id, StudyActivity.LESSON_STEP, this.now());
    return { studied: true };
  }

  async quizSource(opened, lessonKind) {
    const { entry, paper, steps } = opened;
    if (lessonKind === QuizKind.VOCABULARY) {
      this.requireStep(steps, LessonStep.VOCABULARY_QUIZ);
      return paper.content.vocabulary;
    }
    if (!steps.some((step) => step.key === LessonStep.REVIEW)) throw lessonErrors.notFound();
    const previous = await this.contentClient.getLessonPaper(entry.previousLessonId);
    if (!previous) throw lessonErrors.notFound();
    return previous.content.vocabulary;
  }

  async getVocabularyQuiz(actor, lessonId, { kind }) {
    const opened = await this.open(actor, lessonId);
    return { kind, questions: vocabularyQuiz(await this.quizSource(opened, kind), this.random) };
  }

  async submitVocabularyQuiz(actor, lessonId, { kind, answers }) {
    const opened = await this.open(actor, lessonId);
    const vocabulary = await this.quizSource(opened, kind);
    const wrongIds = wrongQuizAnswers(vocabulary, answers);
    if (!wrongIds.length) {
      const field = kind === QuizKind.REVIEW ? 'reviewPassedAt' : 'vocabularyQuizPassedAt';
      if (!opened.progress[field])
        await this.repository.saveProgress({ ...opened.progress, [field]: this.now() });
      await recordActivity(this.events, actor.id, StudyActivity.LESSON_STEP, this.now());
    }
    return { kind, passed: !wrongIds.length, total: vocabulary.length, wrongIds };
  }

  async getVocabularyPractice(actor) {
    this.assertStudent(actor);
    const standing = await this.standing(actor);
    const completed = [...standing.access.entries()]
      .filter(([, entry]) => entry.state === LessonState.COMPLETED)
      .map(([lessonId]) => lessonId);
    const papers = (await Promise.all(completed.map((lessonId) => this.contentClient.getLessonPaper(lessonId)))).filter(Boolean);
    const words = practiceWords(
      papers.flatMap((paper) => {
        const url = (mediaId) => (mediaId && paper.media[mediaId]?.url) || null;
        return paper.content.vocabulary.map((item) => ({
          id: item.id,
          word: item.word,
          partOfSpeech: item.partOfSpeech,
          phonetic: item.phonetic,
          meaning: item.meaning,
          example: item.example,
          exampleMeaning: item.exampleMeaning,
          audioUkUrl: url(item.audioUkMediaId),
          audioUsUrl: url(item.audioUsMediaId),
          lessonTitle: paper.lesson.title,
        }));
      }),
    );
    const available = words.length >= VOCABULARY_PRACTICE_SIZE;
    return {
      size: VOCABULARY_PRACTICE_SIZE,
      wordCount: words.length,
      completedLessonCount: papers.length,
      available,
      questions: available ? vocabularyPractice(words, this.random) : [],
    };
  }

  async completeVocabularyPractice(actor) {
    this.assertStudent(actor);
    await recordActivity(this.events, actor.id, StudyActivity.WORD_MEMORY, this.now());
    return { recorded: true };
  }

  async submitFillIn(actor, lessonId, { answers }) {
    const { paper, progress, steps } = await this.open(actor, lessonId);
    this.requireStep(steps, LessonStep.FILL_IN);
    const blanks = wrongBlanks(paper.content.fillIn.answers, answers);
    if (!blanks.length && !progress.fillInPassedAt)
      await this.repository.saveProgress({ ...progress, fillInPassedAt: this.now() });
    if (!blanks.length) await recordActivity(this.events, actor.id, StudyActivity.LESSON_STEP, this.now());
    return { passed: !blanks.length, total: paper.content.fillIn.answers.length, wrongBlanks: blanks };
  }

  isExpired(attempt) {
    return this.now().getTime() > new Date(attempt.expiresAt).getTime() + SUBMIT_GRACE_MS;
  }

  async attempts(actor, lessonId) {
    const attempts = await this.repository.listAttempts(actor.id, lessonId);
    const open = attempts.find((attempt) => attempt.status === IN_PROGRESS);
    if (open && this.isExpired(open))
      attempts[attempts.indexOf(open)] = await this.complete(open, open.answers);
    return attempts;
  }

  attemptSummary(attempt) {
    return {
      attemptNumber: attempt.attemptNumber,
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
      scorePercent: percent(attempt.correctCount, attempt.totalCount),
      listeningCorrect: attempt.listeningCorrect,
      listeningTotal: SKILL_TOTALS.listening,
      readingCorrect: attempt.readingCorrect,
      readingTotal: SKILL_TOTALS.reading,
      passed: attempt.passed,
      durationSeconds: attempt.durationSeconds,
      submittedAt: new Date(attempt.submittedAt).toISOString(),
    };
  }

  async getLessonTest(actor, lessonId) {
    const { steps } = await this.open(actor, lessonId);
    const attempts = await this.attempts(actor, lessonId);
    return this.testView(steps, attempts, lessonId);
  }

  async testView(steps, attempts, lessonId, paper) {
    const open = attempts.find((attempt) => attempt.status === IN_PROGRESS);
    const finished = attempts.filter((attempt) => attempt.status === COMPLETED);
    const base = {
      durationMinutes: LESSON_TEST_DURATION_MINUTES,
      passPercent: LESSON_PASS_PERCENT,
      attempts: finished.map((attempt) => this.attemptSummary(attempt)),
      progression: testProgression(finished),
    };
    if (!open) {
      const ready = steps.every((step) => step.key === LessonStep.TEST || step.status === StepStatus.DONE);
      return { ...base, status: ready ? LessonTestStatus.READY : LessonTestStatus.LOCKED };
    }
    const source = paper || (await this.contentClient.getLessonPaper(lessonId, open.lessonVersionId));
    if (!source) throw lessonErrors.notFound();
    return {
      ...base,
      status: LessonTestStatus.IN_PROGRESS,
      attemptNumber: open.attemptNumber,
      startedAt: new Date(open.startedAt).toISOString(),
      expiresAt: new Date(open.expiresAt).toISOString(),
      serverNow: this.now().toISOString(),
      answers: open.answers,
      parts: testParts({ test: source.content.test, media: source.media }, { optionOrder: open.optionOrder }),
    };
  }

  async startLessonTest(actor, lessonId) {
    const { paper, steps } = await this.open(actor, lessonId);
    let attempts = await this.attempts(actor, lessonId);
    if (attempts.some((attempt) => attempt.status === IN_PROGRESS))
      return this.testView(steps, attempts, lessonId);
    this.requireStep(steps, LessonStep.TEST);
    const startedAt = this.now();
    const created = await this.repository.createAttempt({
      accountId: actor.id,
      accountEmail: actor.email || '',
      lessonId,
      lessonVersionId: paper.versionId,
      attemptNumber: attempts.length + 1,
      status: IN_PROGRESS,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + LESSON_TEST_DURATION_MINUTES * 60 * 1000),
      optionOrder: shuffledOptionOrder(paper.content.test, this.random),
      answers: {},
    });
    attempts = created ? [...attempts, created] : await this.attempts(actor, lessonId);
    return this.testView(steps, attempts, lessonId, created ? paper : undefined);
  }

  async openAttempt(actor, lessonId) {
    this.assertStudent(actor);
    const attempts = await this.repository.listAttempts(actor.id, lessonId);
    const attempt = attempts.find((item) => item.status === IN_PROGRESS);
    if (!attempt) throw lessonErrors.testNotInProgress();
    return attempt;
  }

  async saveLessonTestAnswers(actor, lessonId, { answers }) {
    const attempt = await this.openAttempt(actor, lessonId);
    if (this.isExpired(attempt)) {
      await this.complete(attempt, attempt.answers);
      throw lessonErrors.testNotInProgress();
    }
    attempt.answers = answers;
    await this.repository.saveAttempt(attempt);
    return { saved: true };
  }

  async discardLessonTest(actor, lessonId) {
    const attempt = await this.openAttempt(actor, lessonId);
    if (this.isExpired(attempt)) {
      await this.complete(attempt, attempt.answers);
      throw lessonErrors.testNotInProgress();
    }
    await this.repository.deleteOpenAttempt(attempt.id);
    return { discarded: true };
  }

  async submitLessonTest(actor, lessonId, { answers }) {
    const attempt = await this.openAttempt(actor, lessonId);
    const finished = await this.complete(attempt, this.isExpired(attempt) ? attempt.answers : answers);
    return this.reviewView(finished);
  }

  async complete(attempt, answers) {
    const paper = await this.contentClient.getLessonPaper(attempt.lessonId, attempt.lessonVersionId);
    if (!paper) throw lessonErrors.notFound();
    const score = scoreTest(paper.content.test, answers);
    const submittedAt = this.now();
    const end = Math.min(submittedAt.getTime(), new Date(attempt.expiresAt).getTime());
    Object.assign(attempt, score, {
      answers,
      status: COMPLETED,
      submittedAt,
      durationSeconds: Math.max(0, Math.round((end - new Date(attempt.startedAt).getTime()) / 1000)),
      passed: lessonTestPassed(score.correctCount, score.totalCount),
    });
    const saved = await this.repository.saveAttempt(attempt);
    await recordActivity(this.events, saved.accountId, StudyActivity.LESSON_TEST, submittedAt);
    await this.events.record(LearningEventType.LESSON_TEST_SUBMITTED, {
      attemptId: saved.id,
      accountId: saved.accountId,
      lessonId: saved.lessonId,
      lessonVersionId: saved.lessonVersionId,
      ...this.attemptSummary(saved),
    });
    if (saved.passed) {
      const progress = (await this.repository.findProgress(attempt.accountId, attempt.lessonId)) || {
        accountId: attempt.accountId,
        lessonId: attempt.lessonId,
      };
      if (!progress.completedAt) {
        await this.repository.saveProgress({ ...progress, completedAt: submittedAt });
        await this.events.record(LearningEventType.LESSON_COMPLETED, {
          accountId: attempt.accountId,
          lessonId: attempt.lessonId,
          completedAt: submittedAt.toISOString(),
        });
      }
    }
    return saved;
  }

  async getLessonTestReview(actor, lessonId, { attemptNumber } = {}) {
    await this.open(actor, lessonId);
    const finished = (await this.attempts(actor, lessonId)).filter((attempt) => attempt.status === COMPLETED);
    const attempt = attemptNumber
      ? finished.find((item) => item.attemptNumber === attemptNumber)
      : finished.at(-1);
    if (!attempt) return { attempt: null, parts: [] };
    return this.reviewView(attempt);
  }

  async reviewView(attempt) {
    const paper = await this.contentClient.getLessonPaper(attempt.lessonId, attempt.lessonVersionId);
    if (!paper) throw lessonErrors.notFound();
    return {
      attempt: this.attemptSummary(attempt),
      parts: testParts(
        { test: paper.content.test, media: paper.media },
        { optionOrder: attempt.optionOrder, answers: attempt.answers },
      ),
    };
  }

  reviewAttemptSummary(attempt) {
    return {
      attemptNumber: attempt.attemptNumber,
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
      scorePercent: percent(attempt.correctCount, attempt.totalCount),
      passed: attempt.passed,
      submittedAt: new Date(attempt.submittedAt).toISOString(),
    };
  }

  reviewSummary(standing, unitId) {
    const entry = standing.reviews.get(unitId);
    if (!entry || entry.state === UnitReviewState.NONE) return null;
    const attempts = standing.reviewAttempts.filter((attempt) => attempt.unitId === unitId);
    return {
      state: entry.state,
      questionCount: UNIT_REVIEW_QUESTION_COUNT,
      passPercent: LESSON_PASS_PERCENT,
      lessonsLeft: entry.lessonsLeft,
      attemptCount: attempts.length,
      bestPercent: attempts.length ? Math.max(...attempts.map((attempt) => percent(attempt.correctCount, attempt.totalCount))) : null,
    };
  }

  async openReview(actor, unitId) {
    this.assertStudent(actor);
    const standing = await this.standing(actor);
    const entry = standing.reviews.get(unitId);
    if (!entry || entry.state === UnitReviewState.NONE) throw lessonErrors.reviewNotFound();
    if (entry.state === UnitReviewState.LOCKED) throw lessonErrors.reviewLocked(standing.placementRequired, entry.lessonsLeft);
    const paper = await this.contentClient.getUnitReviewPaper(unitId);
    if (!paper) throw lessonErrors.reviewNotFound();
    return { standing, entry, paper };
  }

  async getUnitReview(actor, unitId) {
    const { standing, entry, paper } = await this.openReview(actor, unitId);
    const attempts = standing.reviewAttempts.filter((attempt) => attempt.unitId === unitId);
    return {
      unit: { id: unitId, number: entry.unitNumber, title: entry.unit.title },
      ...this.reviewSummary(standing, unitId),
      attempts: attempts.map((attempt) => this.reviewAttemptSummary(attempt)),
      parts: testParts(
        { test: paper.test, media: {} },
        { optionOrder: shuffledOptionOrder(paper.test, this.random, UNIT_REVIEW_PARTS), partKeys: UNIT_REVIEW_PARTS },
      ),
    };
  }

  async submitUnitReview(actor, unitId, { answers }) {
    const { standing, paper } = await this.openReview(actor, unitId);
    const score = scoreTest(paper.test, answers, UNIT_REVIEW_PARTS);
    const own = standing.reviewAttempts.filter((attempt) => attempt.unitId === unitId);
    const saved = await this.repository.createReviewAttempt({
      accountId: actor.id,
      unitId,
      reviewVersionId: paper.versionId,
      attemptNumber: own.length + 1,
      answers,
      totalCount: score.totalCount,
      correctCount: score.correctCount,
      passed: lessonTestPassed(score.correctCount, score.totalCount),
      submittedAt: this.now(),
    });
    await recordActivity(this.events, actor.id, StudyActivity.UNIT_REVIEW, this.now());
    if (saved.passed && !own.some((attempt) => attempt.passed)) {
      const units = standing.curriculum.units || [];
      const index = units.findIndex((unit) => unit.id === unitId);
      await this.events.record(LearningEventType.UNIT_REVIEW_PASSED, {
        accountId: actor.id,
        unitId,
        unitTitle: units[index]?.title || '',
        nextUnitId: units[index + 1]?.id || null,
        nextUnitTitle: units[index + 1]?.title || null,
        passedAt: new Date(saved.submittedAt).toISOString(),
      });
    }
    return {
      attempt: this.reviewAttemptSummary(saved),
      parts: testParts({ test: paper.test, media: {} }, { answers, partKeys: UNIT_REVIEW_PARTS }),
    };
  }

  async getLessonRanking(actor, lessonId) {
    this.assertStudent(actor);
    const standing = await this.standing(actor);
    if (!standing.access.has(lessonId)) throw lessonErrors.notFound();
    const rows = (await this.repository.listRanking(lessonId)).map((attempt, index) => ({
      rank: index + 1,
      accountId: attempt.accountId,
      email: attempt.accountEmail,
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
      scorePercent: percent(attempt.correctCount, attempt.totalCount),
      durationSeconds: attempt.durationSeconds,
      isMe: attempt.accountId === actor.id,
    }));
    return {
      total: rows.length,
      entries: rows.slice(0, RANKING_SIZE),
      me: rows.find((row) => row.isMe) || null,
    };
  }
}
