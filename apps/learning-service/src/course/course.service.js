import { AccountRole } from '@appenglish/auth-contracts';
import { COURSE_PASS_PERCENT, CourseItemType, lyricPieces } from '@appenglish/content-contracts';
import { CourseDictationMode, LearningEventType, StudyActivity } from '@appenglish/learning-contracts';
import { noEvents, recordActivity } from '../events/learning-events.js';
import { accuracyOf, checkSentence, sameWords } from '../listening/dictation.rules.js';
import { placementErrors } from '../placement/placement.errors.js';
import { courseErrors } from './course.errors.js';
import { courseMap, courseProgress, itemPlace, levelAfter, shuffledOrder } from './course.rules.js';

const hideAnswer = ({ id, skill, prompt, options }) => ({ id, skill, prompt, options: options.map(({ id: optionId, text }) => ({ id: optionId, text })) });

function markQuestion(question, answers) {
  const chosenOptionId = answers[question.id] || null;
  const correctOptionId = question.options.find((option) => option.isCorrect)?.id ?? null;
  return { ...hideAnswer(question), chosenOptionId, correctOptionId, correct: chosenOptionId === correctOptionId, explanation: question.explanation || '' };
}

const gapPieces = (gap) => {
  let next = 0;
  return lyricPieces(gap).map((piece) => ('blank' in piece ? { blank: next++, answer: piece.blank } : piece));
};

const audioOf = (paper, section) => (section.audioMediaId && paper.media?.[section.audioMediaId]) || null;

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

  async topicOf(accountId, topicId, versionId) {
    const [{ map }, paper] = await Promise.all([this.mapOf(accountId), this.contentClient.getCoursePaper(topicId, versionId)]);
    if (!paper || paper.item.type !== CourseItemType.TOPIC) throw courseErrors.notFound();
    const place = itemPlace(map, topicId);
    if (!place) throw courseErrors.notFound();
    if (!place.open) throw courseErrors.locked();
    return { paper, map };
  }

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

  async completeTopic(actor, topicId) {
    this.assertStudent(actor);
    await this.topicOf(actor.id, topicId);
    const result = await this.repository.recordAttempt(actor.id, topicId, topicId, 100, true, this.now());
    await recordActivity(this.events, actor.id, StudyActivity.COURSE_TOPIC, this.now());
    const { map } = await this.mapOf(actor.id);
    return { done: Boolean(result.passedAt), progress: courseProgress(map, await this.repository.listTestResults(actor.id)) };
  }

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
