import { AccountRole } from '@appenglish/auth-contracts';
import { COURSE_PASS_PERCENT, CourseItemType, lyricPieces } from '@appenglish/content-contracts';
import { CourseDictationMode, LearningEventType, StudyActivity } from '@appenglish/learning-contracts';
import { noEvents, recordActivity } from '../events/learning-events.js';
import { accuracyOf, checkSentence, sameWords } from '../listening/dictation.rules.js';
import { placementErrors } from '../placement/placement.errors.js';
import { courseErrors } from './course.errors.js';
import { courseMap, courseProgress, itemPlace, levelAfter, shuffledOrder } from './course.rules.js';

const hideAnswer = ({ id, skill, prompt, options }) => ({ id, skill, prompt, options: options.map(({ id: optionId, text }) => ({ id: optionId, text })) });

// A level-test question with the learner's answer and the right one.
function markQuestion(question, answers) {
  const chosenOptionId = answers[question.id] || null;
  const correctOptionId = question.options.find((option) => option.isCorrect)?.id ?? null;
  return { ...hideAnswer(question), chosenOptionId, correctOptionId, correct: chosenOptionId === correctOptionId, explanation: question.explanation || '' };
}

// The pieces of a sentence in the blanks mode: text, and blanks numbered
// from 0 with their answer (the same notation as songs, D88).
const gapPieces = (gap) => {
  let next = 0;
  return lyricPieces(gap).map((piece) => ('blank' in piece ? { blank: next++, answer: piece.blank } : piece));
};

// The Listening course for learners (F05C, D143–D145). Each level has topics,
// each topic one listening lesson: vocabulary, comprehension questions, an
// optional ordering task, dictation (blanks or full sentences) and the
// transcript with its translation. Questions, ordering and dictation are
// checked to help the learner but nothing is scored or kept; a topic is
// marked done for progress. Topics of an open level are all open; the level
// test of a level, passed, opens the next level. Topics, tests and answers
// live in content-service.
// The URL of a level-test section's own recording (D147).
const audioOf = (paper, section) => (section.audioMediaId && paper.media?.[section.audioMediaId]) || null;

// A level-test transcript as lines; "Man: …" at the start of a line is the
// speaker, as when a Content Manager pastes a transcript.
const SPEAKER = /^([A-Za-z][A-Za-z .'-]{0,38}):\s+(.+)$/;
export function transcriptLines(transcript) {
  return String(transcript || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const spoken = SPEAKER.exec(line);
      return { id: String(index + 1), speaker: spoken ? spoken[1].trim() : '', text: spoken ? spoken[2] : line };
    });
}

export class CourseLessonService {
  // now() is replaceable in tests.
  constructor(repository, contentClient, { now = () => new Date(), events = noEvents } = {}) {
    this.repository = repository;
    this.contentClient = contentClient;
    this.now = now;
    this.events = events;
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
    const [course, topicResults, testResults] = await Promise.all([
      this.contentClient.listPublishedCourse(),
      this.repository.listResults(accountId),
      this.repository.listTestResults(accountId),
    ]);
    const map = courseMap(course, {
      topicDone: new Set(topicResults.filter((result) => result.passedAt).map((result) => result.lessonId)),
      testPassed: new Set(testResults.filter((result) => result.passedAt).map((result) => result.itemId)),
    });
    return { map, topicResults, testResults };
  }

  // The published course by level: what is open, the topics done and the
  // level tests with the learner's results.
  async getCourse(actor) {
    this.assertStudent(actor);
    const { map, testResults } = await this.mapOf(actor.id);
    const testResult = (itemId) => this.resultView(testResults.find((result) => result.itemId === itemId));
    return {
      passPercent: COURSE_PASS_PERCENT,
      currentLevel: map.currentLevel,
      levels: map.levels.map((level) => ({
        level: level.level,
        state: level.state,
        topics: level.topics.map((topic) => ({ id: topic.id, title: topic.title, description: topic.description, position: topic.position, done: topic.done })),
        levelTest: level.levelTest
          ? {
              id: level.levelTest.id,
              title: level.levelTest.title,
              description: level.levelTest.description,
              questionCount: level.levelTest.questionCount,
              nextLevel: levelAfter(level.level),
              ...testResult(level.levelTest.id),
            }
          : null,
      })),
    };
  }

  // A published topic of an open level, with its paper.
  async topicOf(accountId, topicId, versionId) {
    const [{ map }, paper] = await Promise.all([this.mapOf(accountId), this.contentClient.getCoursePaper(topicId, versionId)]);
    if (!paper || paper.item.type !== CourseItemType.TOPIC) throw courseErrors.notFound();
    const place = itemPlace(map, topicId);
    if (!place) throw courseErrors.notFound();
    if (!place.open) throw courseErrors.locked();
    return { paper, map };
  }

  // Everything to study a topic (D143): nothing is scored, so the answers,
  // the transcript and the translation come with it and the page checks the
  // questions and the ordering itself. The ordering ideas come shuffled.
  async getTopic(actor, topicId) {
    this.assertStudent(actor);
    const [{ paper, map }, result] = await Promise.all([this.topicOf(actor.id, topicId), this.repository.findResult(actor.id, topicId)]);
    const { content } = paper;
    const level = map.levels.find((entry) => entry.topics.some((topic) => topic.id === topicId));
    const topics = level.topics;
    const at = topics.findIndex((topic) => topic.id === topicId);
    return {
      topic: { id: paper.item.id, title: paper.item.title, description: paper.item.description, level: paper.item.level },
      versionId: paper.versionId,
      done: Boolean(result?.passedAt),
      previous: at > 0 ? { id: topics[at - 1].id, title: topics[at - 1].title } : null,
      next: at < topics.length - 1 ? { id: topics[at + 1].id, title: topics[at + 1].title } : null,
      audioUrl: (content.audioMediaId && paper.media?.[content.audioMediaId]) || null,
      vocabulary: content.vocabulary.map(({ id, word, phonetic, meaning, audioMediaId }) => ({
        id,
        word,
        phonetic,
        meaning,
        audioUrl: (audioMediaId && paper.media?.[audioMediaId]) || null,
      })),
      questions: content.questions.map((question) => ({
        ...hideAnswer(question),
        correctOptionId: question.options.find((option) => option.isCorrect)?.id ?? null,
        explanation: question.explanation || '',
      })),
      ordering: content.ordering.enabled
        ? {
            prompt: content.ordering.prompt,
            items: shuffledOrder(content.ordering.items, `${actor.id}:${topicId}`).map(({ id, text }) => ({ id, text })),
            order: content.ordering.items.map((item) => item.id),
          }
        : null,
      sentences: content.segments.map((segment) => ({
        id: segment.id,
        speaker: segment.speaker,
        text: segment.text,
        start: segment.start,
        end: segment.end,
        translation: segment.translation || '',
        pieces: segment.gap ? gapPieces(segment.gap) : null,
      })),
    };
  }

  // One dictation sentence checked (D145): word by word in the full mode
  // (D86), blank by blank in the blanks mode. Nothing is kept.
  async checkSentence(actor, topicId, { versionId, segmentId, mode, text, blanks }) {
    this.assertStudent(actor);
    const { paper } = await this.topicOf(actor.id, topicId, versionId);
    const segment = (paper.content.segments || []).find((item) => item.id === segmentId);
    if (!segment) throw courseErrors.noSentence();
    if (mode === CourseDictationMode.BLANKS) {
      const { gap } = segment;
      if (!gap) throw courseErrors.noBlanks();
      const expected = gapPieces(gap).filter((piece) => 'blank' in piece);
      const marked = expected.map((piece) => {
        const typed = blanks[piece.blank] || '';
        return { index: piece.blank, typed, expected: piece.answer, correct: sameWords(piece.answer, typed) };
      });
      const right = marked.filter((blank) => blank.correct).length;
      return { segmentId, mode, blanks: marked, correct: right === marked.length, accuracy: marked.length ? Math.round((right * 100) / marked.length) : 0 };
    }
    const checked = checkSentence(segment.text, text || '');
    const accuracy = accuracyOf(checked.total, checked.errors);
    return { segmentId, mode: CourseDictationMode.FULL, words: checked.words, correct: accuracy === 100, accuracy };
  }

  // The topic marked done (for progress); doing it again keeps it done.
  async completeTopic(actor, topicId) {
    this.assertStudent(actor);
    await this.topicOf(actor.id, topicId);
    const result = await this.repository.recordAttempt(actor.id, topicId, topicId, 100, true, this.now());
    await recordActivity(this.events, actor.id, StudyActivity.COURSE_TOPIC, this.now());
    const { map } = await this.mapOf(actor.id);
    return { done: Boolean(result.passedAt), progress: courseProgress(map, await this.repository.listTestResults(actor.id)) };
  }

  // ----- Level tests (D145).

  async testOf(accountId, itemId, versionId) {
    const [paper, { map }] = await Promise.all([this.contentClient.getCoursePaper(itemId, versionId), this.mapOf(accountId)]);
    if (!paper || paper.item.type !== CourseItemType.LEVEL_TEST) throw courseErrors.notFound();
    const place = itemPlace(map, itemId);
    if (!place) throw courseErrors.notFound();
    if (!place.open) throw courseErrors.locked();
    return { paper, map };
  }

  testView(paper) {
    return { id: paper.item.id, kind: 'level_test', title: paper.item.title, level: paper.item.level, nextLevel: levelAfter(paper.item.level) };
  }

  // A level test to take: each section's recording and its questions without
  // their answers.
  async getTest(actor, itemId) {
    this.assertStudent(actor);
    const [{ paper }, result] = await Promise.all([this.testOf(actor.id, itemId), this.repository.findTestResult(actor.id, itemId)]);
    return {
      test: this.testView(paper),
      versionId: paper.versionId,
      passPercent: COURSE_PASS_PERCENT.levelTest,
      sections: paper.content.sections.map((section) => ({
        id: section.id,
        audioUrl: audioOf(paper, section),
        questions: section.questions.map(hideAnswer),
      })),
      ...this.resultView(result),
    };
  }

  // The answers scored and kept; passing opens the next level (`levelUp`).
  async submitTest(actor, itemId, { versionId, answers }) {
    this.assertStudent(actor);
    const { paper, map: before } = await this.testOf(actor.id, itemId, versionId);
    const passPercent = COURSE_PASS_PERCENT.levelTest;
    const marked = paper.content.sections.map((section) => {
      return {
        id: section.id,
        audioUrl: audioOf(paper, section),
        questions: section.questions.map((question) => markQuestion(question, answers)),
        transcript: transcriptLines(section.transcript),
      };
    });
    const questions = marked.flatMap((section) => section.questions);
    const right = questions.filter((question) => question.correct).length;
    const score = questions.length ? Math.round((right * 100) / questions.length) : 0;
    const passed = questions.length > 0 && right * 100 >= passPercent * questions.length;
    const result = await this.repository.recordTestAttempt(actor.id, itemId, 'level_test', paper.item.level, score, passed, this.now());
    await recordActivity(this.events, actor.id, StudyActivity.COURSE_TEST, this.now());
    const { map } = await this.mapOf(actor.id);
    const levelUp = before.currentLevel !== map.currentLevel ? { from: before.currentLevel, to: map.currentLevel } : null;
    if (levelUp) await this.events.record(LearningEventType.COURSE_LEVEL_UP, { accountId: actor.id, ...levelUp, reachedAt: this.now().toISOString() });
    return {
      ...this.resultView(result),
      test: this.testView(paper),
      score,
      passed,
      testPassed: Boolean(result.passedAt),
      passPercent,
      rightCount: right,
      questionCount: questions.length,
      levelUp,
      sections: marked,
    };
  }

  async getProgress(actor) {
    this.assertStudent(actor);
    const { map, testResults } = await this.mapOf(actor.id);
    return courseProgress(map, testResults);
  }
}
