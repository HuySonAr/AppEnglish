import { AccountRole } from '@appenglish/auth-contracts';
import { COURSE_LEVELS, COURSE_PASS_PERCENT, CourseItemType, CourseQuestionKind, countBlanks, hasCourseFocus } from '@appenglish/content-contracts';
import { COURSE_FOCUS_ID, CourseItemState, CourseLessonStep, CoursePlacementStatus, courseBlankKey } from '@appenglish/learning-contracts';
import { accuracyOf, checkSentence, sameWords } from '../listening/dictation.rules.js';
import { placementErrors } from '../placement/placement.errors.js';
import { courseErrors } from './course.errors.js';
import { courseMap, courseProgress, lessonStateIn, levelAfter, mostMissedWords, placementStartLevel, testStateIn } from './course.rules.js';

const isComplete = (question) => question.kind === CourseQuestionKind.COMPLETE;
const hideAnswer = ({ id, kind, skill, prompt, options, answers }) =>
  isComplete({ kind })
    ? { id, kind, skill, prompt, blankCount: answers.length, options: [] }
    : { id, kind: CourseQuestionKind.CHOICE, skill, prompt, options: options.map(({ id: optionId, text }) => ({ id: optionId, text })) };

// The blanks of a sentence or passage filled by the learner: each with what
// was expected and typed (by courseBlankKey), right by the dictation rules.
function markBlanks(id, expected, answers) {
  const blanks = expected.map((text, index) => {
    const typed = answers[courseBlankKey(id, index)] || '';
    return { index, expected: text, typed, correct: sameWords(text, typed) };
  });
  const right = blanks.filter((blank) => blank.correct).length;
  return { blanks, correct: right === blanks.length, accuracy: blanks.length ? Math.round((right * 100) / blanks.length) : 0 };
}

// A question with the learner's answer and why: the option chosen and the
// right one, or the blanks filled (D109). `accuracy` is its points, 0 to 100.
function markQuestion(question, answers) {
  if (isComplete(question)) return { ...hideAnswer(question), ...markBlanks(question.id, question.answers, answers), explanation: question.explanation || '' };
  const chosenOptionId = answers[question.id] || null;
  const correctOptionId = question.options.find((option) => option.isCorrect)?.id ?? null;
  const correct = chosenOptionId === correctOptionId;
  return { ...hideAnswer(question), chosenOptionId, correctOptionId, correct, accuracy: correct ? 100 : 0, explanation: question.explanation || '' };
}

// The Focus on passage to fill (words in alphabetical order, so their order
// gives nothing away) and the same once filled.
const focusView = (focus) => ({
  title: focus.title,
  passage: focus.passage,
  blankCount: countBlanks(focus.passage),
  words: [...focus.words].sort((a, b) => a.localeCompare(b)),
});
const markFocus = (focus, answers) => ({ ...focusView(focus), ...markBlanks(COURSE_FOCUS_ID, focus.answers, answers) });

// A sentence written down, word by word (D86).
function markSentence(segment, answers) {
  const typed = answers[segment.id] || '';
  const checked = checkSentence(segment.text, typed);
  return { id: segment.id, speaker: segment.speaker, text: segment.text, typed, words: checked.words, accuracy: accuracyOf(checked.total, checked.errors) };
}

// The words of a checked sentence that were written wrong or left out:
// [{ text, typed }] (typed null when left out).
const missedWordsOf = (sentence) =>
  sentence.words.filter((word) => word.status === 'wrong' || word.status === 'missing').map((word) => ({ text: word.text, typed: word.typed ?? null }));

// The Listening course for learners (F05C, D100–D104, D109). A lesson has
// five or six steps: keywords, the main idea, details (chosen or completed
// with the words heard), a Focus on passage when the lesson has one,
// sentences written down and a review; each step can be checked as the learner goes and finishing scores
// the whole lesson. A unit ends with its unit check and a level with its
// level test; passing the level test moves the learner up. The listening
// placement, taken or skipped once, sets the starting level. Sentences written
// down wrong go to the learner's mistakes notebook until written right (D104).
// What is open follows course.rules.js. Units, lessons, tests and their answers live in
// content-service.
export class CourseLessonService {
  // now() is replaceable in tests.
  constructor(repository, contentClient, { now = () => new Date() } = {}) {
    this.repository = repository;
    this.contentClient = contentClient;
    this.now = now;
  }

  assertStudent(actor) {
    if (actor.role !== AccountRole.STUDENT) throw placementErrors.forbiddenRole();
  }

  resultView(result) {
    return result
      ? { bestScore: result.bestScore, lastScore: result.lastScore, attemptCount: result.attemptCount, passed: Boolean(result.passedAt) }
      : { bestScore: null, lastScore: null, attemptCount: 0, passed: false };
  }

  // The learner's place in the published course, with their results.
  async mapOf(accountId) {
    const [course, lessonResults, testResults, placement] = await Promise.all([
      this.contentClient.listPublishedCourse(),
      this.repository.listResults(accountId),
      this.repository.listTestResults(accountId),
      this.repository.findPlacement(accountId),
    ]);
    const passedIds = (results, key) => new Set(results.filter((result) => result.passedAt).map((result) => result[key]));
    const map = courseMap(course, {
      lessonPassed: passedIds(lessonResults, 'lessonId'),
      testPassed: passedIds(testResults, 'itemId'),
      startLevel: placement?.startLevel || COURSE_LEVELS[0],
    });
    return { map, course, lessonResults, testResults, placement };
  }

  placementView(placement, course) {
    return placement
      ? { status: placement.status, available: true, startLevel: placement.startLevel }
      : { status: CoursePlacementStatus.NOT_STARTED, available: Boolean(course.placement), startLevel: null };
  }

  // The published course by level: the learner's current level, what is open
  // with their results, and the next thing to do.
  async getCourse(actor) {
    this.assertStudent(actor);
    const { map, course, lessonResults, testResults, placement } = await this.mapOf(actor.id);
    const lessonResult = (lessonId) => this.resultView(lessonResults.find((result) => result.lessonId === lessonId));
    const testResult = (itemId) => this.resultView(testResults.find((result) => result.itemId === itemId));
    return {
      passPercent: COURSE_PASS_PERCENT,
      currentLevel: map.currentLevel,
      next: map.next,
      placement: this.placementView(placement, course),
      levels: map.levels.map((level) => ({
        level: level.level,
        state: level.state,
        units: level.units.map((unit) => ({
          id: unit.id,
          section: unit.section ?? null,
          title: unit.title,
          description: unit.description,
          lessons: unit.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, state: lesson.state, ...lessonResult(lesson.id) })),
          check: { state: unit.check.state, questionCount: unit.questionCount, ...testResult(unit.id) },
        })),
        levelTest: level.levelTest
          ? {
              id: level.levelTest.id,
              title: level.levelTest.title,
              description: level.levelTest.description,
              questionCount: level.levelTest.questionCount,
              state: level.levelTest.state,
              ...testResult(level.levelTest.id),
            }
          : null,
      })),
    };
  }

  // Refuses a lesson or test not in the course (404) or locked for the
  // learner (409, D102).
  assertOpen(state) {
    if (state === null) throw courseErrors.notFound();
    if (state === CourseItemState.LOCKED) throw courseErrors.locked();
  }

  // The unit, the lesson and its recording.
  async lessonOf(accountId, unitId, lessonId, versionId) {
    const [paper, { map }] = await Promise.all([this.contentClient.getCoursePaper(unitId, versionId), this.mapOf(accountId)]);
    if (!paper || paper.item.type !== CourseItemType.UNIT) throw courseErrors.notFound();
    const index = paper.content.lessons.findIndex((lesson) => lesson.id === lessonId);
    const lesson = paper.content.lessons[index];
    const exercise = lesson && paper.exercises[lesson.exerciseId];
    if (!exercise) throw courseErrors.notFound();
    this.assertOpen(lessonStateIn(map, unitId, lessonId));
    return { paper, lesson, index, exercise, closeSegments: exercise.segments.filter((segment) => lesson.closeSegmentIds.includes(segment.id)) };
  }

  // One lesson to work through: keywords, the questions without their
  // answers and the sentences to write down without their text.
  async getLesson(actor, unitId, { lessonId }) {
    this.assertStudent(actor);
    const [{ paper, lesson, index, exercise, closeSegments }, result] = await Promise.all([
      this.lessonOf(actor.id, unitId, lessonId),
      this.repository.findResult(actor.id, lessonId),
    ]);
    return {
      unit: { id: paper.item.id, title: paper.item.title, level: paper.item.level },
      versionId: paper.versionId,
      lesson: { id: lesson.id, title: lesson.title, number: index + 1, count: paper.content.lessons.length },
      passPercent: COURSE_PASS_PERCENT.lesson,
      keywords: lesson.keywords.map(({ id, word, meaning }) => ({ id, word, meaning })),
      audioUrl: exercise.audioUrl,
      gist: hideAnswer(lesson.gist),
      detail: lesson.detail.map(hideAnswer),
      focus: hasCourseFocus(lesson.focus) ? focusView(lesson.focus) : null,
      closeSegments: closeSegments.map(({ id, speaker, start, end }) => ({ id, speaker, start, end })),
      ...this.resultView(result),
    };
  }

  // One step checked as the learner goes; nothing is kept.
  async checkStep(actor, unitId, { lessonId, versionId, step, segmentId, answers }) {
    this.assertStudent(actor);
    const { lesson, closeSegments } = await this.lessonOf(actor.id, unitId, lessonId, versionId);
    if (step === CourseLessonStep.GIST) return { step, questions: [markQuestion(lesson.gist, answers)] };
    if (step === CourseLessonStep.DETAIL) return { step, questions: lesson.detail.map((question) => markQuestion(question, answers)) };
    if (step === CourseLessonStep.FOCUS) {
      if (!hasCourseFocus(lesson.focus)) throw courseErrors.noFocus();
      return { step, focus: markFocus(lesson.focus, answers) };
    }
    const segment = closeSegments.find((item) => item.id === segmentId);
    if (!segment) throw courseErrors.noSentence();
    return { step, sentence: markSentence(segment, answers) };
  }

  // The whole lesson scored and kept. Each question is one point (a chosen
  // one right or not, a completed one the share of its blanks right), the
  // Focus on passage one point by the share of its blanks right, and each
  // sentence its accuracy (0 to 1); the score is the share of points and the
  // lesson is passed at COURSE_PASS_PERCENT.lesson (D101, D109). `next` is
  // what to do next in the course once this attempt counts.
  async complete(actor, unitId, { lessonId, versionId, answers }) {
    this.assertStudent(actor);
    const { paper, lesson, exercise, closeSegments } = await this.lessonOf(actor.id, unitId, lessonId, versionId);
    const questions = [lesson.gist, ...lesson.detail].map((question) => markQuestion(question, answers));
    const sentences = closeSegments.map((segment) => markSentence(segment, answers));
    const focus = hasCourseFocus(lesson.focus) ? markFocus(lesson.focus, answers) : null;
    await this.keepMistakes(actor.id, paper, lesson, sentences);
    const parts = questions.length + (focus ? 1 : 0) + sentences.length;
    const earned = [...questions, ...(focus ? [focus] : []), ...sentences].reduce((sum, part) => sum + part.accuracy, 0);
    const score = Math.round(earned / parts);
    const passed = earned >= COURSE_PASS_PERCENT.lesson * parts;
    const result = await this.repository.recordAttempt(actor.id, unitId, lessonId, score, passed, this.now());
    const { map } = await this.mapOf(actor.id);
    const chosen = new Set(lesson.closeSegmentIds);
    // `passed` is this attempt; `lessonPassed` whether any attempt passed.
    return {
      ...this.resultView(result),
      score,
      passed,
      lessonPassed: Boolean(result.passedAt),
      passPercent: COURSE_PASS_PERCENT.lesson,
      next: map.next,
      questions,
      focus,
      sentences,
      transcript: exercise.segments.map(({ id, speaker, text, start, end }) => ({ id, speaker, text, start, end, writtenDown: chosen.has(id) })),
    };
  }

  // ----- Unit checks and level tests (D102). itemId is the unit's id for its
  // check, the level test's id for a level test.

  async testOf(accountId, itemId, versionId) {
    const [paper, { map }] = await Promise.all([this.contentClient.getCoursePaper(itemId, versionId), this.mapOf(accountId)]);
    if (!paper) throw courseErrors.notFound();
    this.assertOpen(testStateIn(map, itemId));
    const isUnit = paper.item.type === CourseItemType.UNIT;
    return {
      paper,
      map,
      kind: isUnit ? 'unit_check' : 'level_test',
      passPercent: isUnit ? COURSE_PASS_PERCENT.unitCheck : COURSE_PASS_PERCENT.levelTest,
      sections: isUnit ? paper.content.check.sections : paper.content.sections,
    };
  }

  testView(paper, kind) {
    return {
      id: paper.item.id,
      kind,
      title: paper.item.title,
      level: paper.item.level,
      nextLevel: kind === 'level_test' ? levelAfter(paper.item.level) : null,
    };
  }

  // A unit check or level test to take: each section's recording and its
  // questions without their answers.
  async getTest(actor, itemId) {
    this.assertStudent(actor);
    const [{ paper, kind, passPercent, sections }, result] = await Promise.all([
      this.testOf(actor.id, itemId),
      this.repository.findTestResult(actor.id, itemId),
    ]);
    return {
      test: this.testView(paper, kind),
      versionId: paper.versionId,
      passPercent,
      sections: sections.map((section) => ({
        id: section.id,
        audioUrl: paper.exercises[section.exerciseId]?.audioUrl ?? null,
        questions: section.questions.map(hideAnswer),
      })),
      ...this.resultView(result),
    };
  }

  // The answers scored (the share of right questions) and kept. Passing the
  // level test of the current level moves the learner up (`levelUp`).
  async submitTest(actor, itemId, { versionId, answers }) {
    this.assertStudent(actor);
    const { paper, map: before, kind, passPercent, sections } = await this.testOf(actor.id, itemId, versionId);
    const marked = sections.map((section) => {
      const exercise = paper.exercises[section.exerciseId];
      return {
        id: section.id,
        audioUrl: exercise?.audioUrl ?? null,
        questions: section.questions.map((question) => markQuestion(question, answers)),
        transcript: (exercise?.segments || []).map(({ id, speaker, text }) => ({ id, speaker, text })),
      };
    });
    const questions = marked.flatMap((section) => section.questions);
    const right = questions.filter((question) => question.correct).length;
    const score = Math.round((right * 100) / questions.length);
    const passed = right * 100 >= passPercent * questions.length;
    const result = await this.repository.recordTestAttempt(actor.id, itemId, kind, paper.item.level, score, passed, this.now());
    const { map } = await this.mapOf(actor.id);
    // `passed` is this attempt; `testPassed` whether any attempt passed.
    return {
      ...this.resultView(result),
      test: this.testView(paper, kind),
      score,
      passed,
      testPassed: Boolean(result.passedAt),
      passPercent,
      rightCount: right,
      questionCount: questions.length,
      levelUp: before.currentLevel !== map.currentLevel ? { from: before.currentLevel, to: map.currentLevel } : null,
      next: map.next,
      sections: marked,
    };
  }

  // ----- The listening placement (D103).

  async placementPaper(versionId) {
    const course = await this.contentClient.listPublishedCourse();
    if (!course.placement) throw courseErrors.placementUnavailable();
    const paper = await this.contentClient.getCoursePaper(course.placement.id, versionId);
    if (!paper || paper.item.type !== CourseItemType.PLACEMENT) throw courseErrors.placementUnavailable();
    return paper;
  }

  // The placement to take, without its answers or the level of each
  // recording; once taken or skipped, where the learner starts.
  async getPlacement(actor) {
    this.assertStudent(actor);
    const placement = await this.repository.findPlacement(actor.id);
    if (placement) return { status: placement.status, startLevel: placement.startLevel, levelScores: placement.levelScores };
    const paper = await this.placementPaper();
    return {
      status: CoursePlacementStatus.NOT_STARTED,
      versionId: paper.versionId,
      title: paper.item.title,
      levelPassPercent: COURSE_PASS_PERCENT.placementLevel,
      sections: paper.content.sections.map((section) => ({
        id: section.id,
        audioUrl: paper.exercises[section.exerciseId]?.audioUrl ?? null,
        questions: section.questions.map(hideAnswer),
      })),
    };
  }

  // Scores each level, sets the starting level and keeps it; once only.
  async submitPlacement(actor, { versionId, answers }) {
    this.assertStudent(actor);
    if (await this.repository.findPlacement(actor.id)) throw courseErrors.placementDone();
    const paper = await this.placementPaper(versionId);
    const sections = paper.content.sections.map((section) => {
      const exercise = paper.exercises[section.exerciseId];
      return {
        id: section.id,
        level: section.level,
        audioUrl: exercise?.audioUrl ?? null,
        questions: section.questions.map((question) => markQuestion(question, answers)),
        transcript: (exercise?.segments || []).map(({ id, speaker, text }) => ({ id, speaker, text })),
      };
    });
    const levelScores = COURSE_LEVELS.map((level) => {
      const questions = sections.filter((section) => section.level === level).flatMap((section) => section.questions);
      return { level, right: questions.filter((question) => question.correct).length, total: questions.length };
    });
    const startLevel = placementStartLevel(levelScores, COURSE_PASS_PERCENT.placementLevel);
    const kept = await this.repository.createPlacement({
      accountId: actor.id,
      status: CoursePlacementStatus.COMPLETED,
      versionId: paper.versionId,
      startLevel,
      levelScores,
      answers,
      completedAt: this.now(),
    });
    if (!kept) throw courseErrors.placementDone();
    const { map } = await this.mapOf(actor.id);
    return {
      status: CoursePlacementStatus.COMPLETED,
      startLevel,
      currentLevel: map.currentLevel,
      levelScores,
      levelPassPercent: COURSE_PASS_PERCENT.placementLevel,
      next: map.next,
      sections,
    };
  }

  // Starts at A1 without the placement; once only.
  async skipPlacement(actor) {
    this.assertStudent(actor);
    const kept = await this.repository.createPlacement({
      accountId: actor.id,
      status: CoursePlacementStatus.SKIPPED,
      versionId: null,
      startLevel: COURSE_LEVELS[0],
      levelScores: [],
      answers: {},
      completedAt: this.now(),
    });
    if (!kept) throw courseErrors.placementDone();
    return { status: CoursePlacementStatus.SKIPPED, startLevel: kept.startLevel };
  }

  // ----- Progress and the mistakes notebook (D104).

  // Each sentence of a finished lesson: written wrong, it is kept (once more
  // if it was already there); written right, it leaves the notebook.
  async keepMistakes(accountId, paper, lesson, sentences) {
    for (const sentence of sentences) {
      if (sentence.accuracy === 100) {
        await this.repository.deleteMistake(accountId, lesson.id, sentence.id);
        continue;
      }
      await this.repository.recordMistake({
        accountId,
        unitId: paper.item.id,
        lessonId: lesson.id,
        segmentId: sentence.id,
        level: paper.item.level,
        unitTitle: paper.item.title,
        lessonTitle: lesson.title,
        text: sentence.text,
        speaker: sentence.speaker || '',
        missedWords: missedWordsOf(sentence),
        lastMissedAt: this.now(),
      });
    }
  }

  // The learner's progress in the course.
  async getProgress(actor) {
    this.assertStudent(actor);
    const [{ map, lessonResults, testResults, placement }, mistakes] = await Promise.all([this.mapOf(actor.id), this.repository.listMistakes(actor.id)]);
    return {
      ...courseProgress(map, lessonResults, testResults),
      placement: placement ? { status: placement.status, startLevel: placement.startLevel } : null,
      mistakeCount: mistakes.length,
      mostMissedWords: mostMissedWords(mistakes),
    };
  }

  // The recording and place of the sentences of the units given, by
  // segment id; units no longer published are left out.
  async sentencePlaces(unitIds) {
    const places = new Map();
    for (const unitId of unitIds) {
      const paper = await this.contentClient.getCoursePaper(unitId);
      if (!paper) continue;
      for (const exercise of Object.values(paper.exercises))
        for (const segment of exercise.segments)
          places.set(segment.id, { audioUrl: exercise.audioUrl, start: segment.start, end: segment.end, text: segment.text });
    }
    return places;
  }

  mistakeView(mistake, place) {
    return {
      id: mistake.id,
      level: mistake.level,
      unitId: mistake.unitId,
      unitTitle: mistake.unitTitle,
      lessonId: mistake.lessonId,
      lessonTitle: mistake.lessonTitle,
      speaker: mistake.speaker,
      missedWords: mistake.missedWords,
      timesMissed: mistake.timesMissed,
      lastMissedAt: new Date(mistake.lastMissedAt).toISOString(),
      audioUrl: place?.audioUrl ?? null,
      start: place?.start ?? null,
      end: place?.end ?? null,
    };
  }

  // The notebook: each sentence with its recording and place in it, without
  // its text (it is written again), and the words missed most.
  async listMistakes(actor) {
    this.assertStudent(actor);
    const mistakes = await this.repository.listMistakes(actor.id);
    const places = await this.sentencePlaces([...new Set(mistakes.map((mistake) => mistake.unitId))]);
    return {
      mistakes: mistakes.map((mistake) => this.mistakeView(mistake, places.get(mistake.segmentId))),
      mostMissedWords: mostMissedWords(mistakes),
    };
  }

  // One sentence of the notebook written again: right, it leaves the
  // notebook (`fixed`); wrong, it stays with the words missed this time.
  async checkMistake(actor, id, { text }) {
    this.assertStudent(actor);
    const mistake = await this.repository.findMistake(actor.id, id);
    if (!mistake) throw courseErrors.notFound();
    const place = (await this.sentencePlaces([mistake.unitId])).get(mistake.segmentId);
    const sentence = markSentence({ id: mistake.segmentId, speaker: mistake.speaker, text: place?.text ?? mistake.text }, { [mistake.segmentId]: text });
    const fixed = sentence.accuracy === 100;
    if (fixed) await this.repository.deleteMistake(actor.id, mistake.lessonId, mistake.segmentId);
    else await this.repository.recordMistake({ ...mistake, text: sentence.text, missedWords: missedWordsOf(sentence), lastMissedAt: this.now() });
    return { sentence, fixed };
  }
}
