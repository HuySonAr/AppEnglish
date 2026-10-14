import { AccountRole } from '@appenglish/auth-contracts';
import { countBlanks } from '@appenglish/content-contracts';
import {
  LESSON_PASS_PERCENT,
  LESSON_TEST_DURATION_MINUTES,
  LessonState,
  LessonStep,
  LessonTestStatus,
  PlacementStatus,
  QuizKind,
  StepStatus,
  lessonTestPassed,
} from '@appenglish/learning-contracts';
import { placementErrors } from '../placement/placement.errors.js';
import { lessonErrors } from './lesson.errors.js';
import {
  SKILL_TOTALS,
  lessonAccess,
  lessonSteps,
  scoreTest,
  shuffledOptionOrder,
  testParts,
  testProgression,
  vocabularyQuiz,
  wrongBlanks,
  wrongQuizAnswers,
} from './lesson.rules.js';

// A submit that arrives this long after the deadline still counts.
const SUBMIT_GRACE_MS = 30 * 1000;
const RANKING_SIZE = 50;
const IN_PROGRESS = 'IN_PROGRESS';
const COMPLETED = 'COMPLETED';

const percent = (correctCount, totalCount) =>
  totalCount ? Math.round((correctCount * 100) / totalCount) : 0;

export class LessonService {
  // contentClient reads the curriculum and lesson papers from content-service;
  // placementRepository gives the learner's starting unit; now() and random()
  // are replaceable in tests.
  constructor(repository, placementRepository, contentClient, { now = () => new Date(), random = Math.random } = {}) {
    this.repository = repository;
    this.placementRepository = placementRepository;
    this.contentClient = contentClient;
    this.now = now;
    this.random = random;
  }

  assertStudent(actor) {
    if (actor.role !== AccountRole.STUDENT) throw placementErrors.forbiddenRole();
  }

  // The published curriculum and where the learner stands in it.
  async standing(actor) {
    const [curriculum, placement, progress] = await Promise.all([
      this.contentClient.getCurriculum(),
      this.placementRepository.findAttempt(actor.id),
      this.repository.listProgress(actor.id),
    ]);
    // Lessons open once the placement test is taken or skipped (D35).
    const placed = Boolean(placement) && placement.status !== PlacementStatus.IN_PROGRESS;
    const completed = new Set(progress.filter((row) => row.completedAt).map((row) => row.lessonId));
    return {
      curriculum,
      placementRequired: !placed,
      startUnit: placed ? placement.startUnit : null,
      access: lessonAccess(curriculum, placed ? placement.startUnit : null, completed),
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

  // Loads what every lesson action needs and refuses a locked lesson.
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

  // Refuses when a step before `step` is not finished.
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
        wordBank: [...new Set(vocabulary.map((item) => item.word))],
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

  // The learner has opened every word of the lesson.
  async markVocabularyStudied(actor, lessonId) {
    const { progress, steps } = await this.open(actor, lessonId);
    this.requireStep(steps, LessonStep.VOCABULARY);
    if (!progress.vocabularyStudiedAt)
      await this.repository.saveProgress({ ...progress, vocabularyStudiedAt: this.now() });
    return { studied: true };
  }

  // The words a quiz is about: this lesson's, or the previous lesson's for the
  // review.
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

  // Every word must get its meaning; the wrong ones are named so the learner
  // can try again. No limit on tries.
  async submitVocabularyQuiz(actor, lessonId, { kind, answers }) {
    const opened = await this.open(actor, lessonId);
    const vocabulary = await this.quizSource(opened, kind);
    const wrongIds = wrongQuizAnswers(vocabulary, answers);
    if (!wrongIds.length) {
      const field = kind === QuizKind.REVIEW ? 'reviewPassedAt' : 'vocabularyQuizPassedAt';
      if (!opened.progress[field])
        await this.repository.saveProgress({ ...opened.progress, [field]: this.now() });
    }
    return { kind, passed: !wrongIds.length, total: vocabulary.length, wrongIds };
  }

  async submitFillIn(actor, lessonId, { answers }) {
    const { paper, progress, steps } = await this.open(actor, lessonId);
    this.requireStep(steps, LessonStep.FILL_IN);
    const blanks = wrongBlanks(paper.content.fillIn.answers, answers);
    if (!blanks.length && !progress.fillInPassedAt)
      await this.repository.saveProgress({ ...progress, fillInPassedAt: this.now() });
    return { passed: !blanks.length, total: paper.content.fillIn.answers.length, wrongBlanks: blanks };
  }

  // ----- Lesson test

  isExpired(attempt) {
    return this.now().getTime() > new Date(attempt.expiresAt).getTime() + SUBMIT_GRACE_MS;
  }

  // The learner's attempts at the lesson; one whose time ran out is finished
  // first with the answers saved so far.
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
      // Whether the learner is getting better or worse over the retakes (D62).
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

  // Starts a new attempt, or returns the one in progress.
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
      // Options of Parts 3-7 are shuffled for each attempt (D31).
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

  // Throws away the attempt in progress: it is not scored and leaves no trace
  // in the history or the ranking (D82). An attempt whose time already ran
  // out is finished instead, as it would be on the next visit.
  async discardLessonTest(actor, lessonId) {
    const attempt = await this.openAttempt(actor, lessonId);
    if (this.isExpired(attempt)) {
      await this.complete(attempt, attempt.answers);
      throw lessonErrors.testNotInProgress();
    }
    await this.repository.deleteOpenAttempt(attempt.id);
    return { discarded: true };
  }

  // Scores the attempt and returns the result with the full review: correct
  // answers, explanations and transcripts (D59).
  async submitLessonTest(actor, lessonId, { answers }) {
    const attempt = await this.openAttempt(actor, lessonId);
    // A submit after the grace period is scored with the answers saved in time.
    const finished = await this.complete(attempt, this.isExpired(attempt) ? attempt.answers : answers);
    return this.reviewView(finished);
  }

  async complete(attempt, answers) {
    const paper = await this.contentClient.getLessonPaper(attempt.lessonId, attempt.lessonVersionId);
    if (!paper) throw lessonErrors.notFound();
    const score = scoreTest(paper.content.test, answers);
    const submittedAt = this.now();
    // Time counted for the ranking never exceeds the time allowed.
    const end = Math.min(submittedAt.getTime(), new Date(attempt.expiresAt).getTime());
    Object.assign(attempt, score, {
      answers,
      status: COMPLETED,
      submittedAt,
      durationSeconds: Math.max(0, Math.round((end - new Date(attempt.startedAt).getTime()) / 1000)),
      passed: lessonTestPassed(score.correctCount, score.totalCount),
    });
    const saved = await this.repository.saveAttempt(attempt);
    if (saved.passed) {
      // Passing completes the lesson and opens the next one.
      const progress = (await this.repository.findProgress(attempt.accountId, attempt.lessonId)) || {
        accountId: attempt.accountId,
        lessonId: attempt.lessonId,
      };
      if (!progress.completedAt)
        await this.repository.saveProgress({ ...progress, completedAt: submittedAt });
    }
    return saved;
  }

  // One finished attempt (the latest, or the given number) with every answer
  // explained.
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

  // Learners of the lesson ranked by their first attempt. Every student can
  // see it; learners are shown by email for now (D60).
  async getLessonRanking(actor, lessonId) {
    this.assertStudent(actor);
    const standing = await this.standing(actor);
    if (!standing.access.has(lessonId)) throw lessonErrors.notFound();
    const rows = (await this.repository.listRanking(lessonId)).map((attempt, index) => ({
      rank: index + 1,
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
      // The learner's own row, also when it is below the listed ones.
      me: rows.find((row) => row.isMe) || null,
    };
  }
}
