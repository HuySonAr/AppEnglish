import { AccountRole } from '@appenglish/auth-contracts';
import { ListeningFormat, listeningKind, lyricPieces, lyricText } from '@appenglish/content-contracts';
import { LISTENING_HIDE_SHARE, ListeningMode, StudyActivity } from '@appenglish/learning-contracts';
import { noEvents, recordActivity } from '../events/learning-events.js';
import { placementErrors } from '../placement/placement.errors.js';
import { accuracyOf, checkSentence, sameWords } from './dictation.rules.js';
import { checkHiddenLine, hiddenPieces, isHideMode } from './hidden-words.js';
import { listeningErrors } from './listening.errors.js';

const isSong = (exercise) => exercise.kind === 'song';
const LineStatus = Object.freeze({ DONE: 'done', WRONG: 'wrong' });
const isToeic = (exercise) => Boolean(listeningKind(exercise.kind)?.number);

function numberedPieces(segments) {
  let next = 0;
  return segments.map((segment) =>
    lyricPieces(segment.text).map((piece) => ('blank' in piece ? { blank: next++, answer: piece.blank } : piece)),
  );
}

export class ListeningPracticeService {
  constructor(repository, contentClient, { now = () => new Date(), events = noEvents, random = Math.random } = {}) {
    this.repository = repository;
    this.contentClient = contentClient;
    this.now = now;
    this.events = events;
    this.random = random;
  }

  assertStudent(actor) {
    if (actor.role !== AccountRole.STUDENT) throw placementErrors.forbiddenRole();
  }

  resultView(result) {
    return result
      ? { bestAccuracy: result.bestAccuracy, lastAccuracy: result.lastAccuracy, checkCount: result.checkCount }
      : { bestAccuracy: null, lastAccuracy: null, checkCount: 0 };
  }

  resultsView(results) {
    const of = (mode) => results.find((result) => result.mode === mode);
    return {
      ...this.resultView(of(ListeningMode.FULL)),
      blanks: this.resultView(of(ListeningMode.BLANKS)),
      hide30: this.resultView(of(ListeningMode.HIDE_30)),
      hide50: this.resultView(of(ListeningMode.HIDE_50)),
      hide100: this.resultView(of(ListeningMode.HIDE_100)),
    };
  }

  async listPractice(actor) {
    this.assertStudent(actor);
    const [published, results, lines] = await Promise.all([
      this.contentClient.listPublishedListeningExercises(),
      this.repository.listResults(actor.id),
      this.repository.listLines(actor.id),
    ]);
    const toeic = new Set(published.topics.filter((topic) => topic.format === ListeningFormat.TOEIC).map((topic) => topic.id));
    const exercises = published.exercises.filter((exercise) => toeic.has(exercise.topic?.id) && isToeic(exercise));
    const used = new Set(exercises.map((exercise) => exercise.topic.id));
    const usedTests = new Set(exercises.map((exercise) => exercise.test?.id).filter(Boolean));
    return {
      topics: published.topics
        .filter((topic) => used.has(topic.id))
        .map((topic) => ({ id: topic.id, code: topic.code, name: topic.name, format: topic.format, level: topic.level || null })),
      tests: (published.tests || []).filter((test) => usedTests.has(test.id)).map((test) => ({ id: test.id, topicId: test.topicId, name: test.name })),
      exercises: exercises.map((exercise) => ({
        ...exercise,
        ...this.resultsView(results.filter((result) => result.exerciseId === exercise.id)),
        lines: this.lineCounts(lines.filter((line) => line.exerciseId === exercise.id)),
      })),
    };
  }

  lineCounts(lines) {
    return { done: lines.filter((line) => line.status === LineStatus.DONE).length, wrong: lines.filter((line) => line.status === LineStatus.WRONG).length };
  }

  async paper(exerciseId) {
    const paper = await this.contentClient.getListeningPaper(exerciseId);
    if (!paper) throw listeningErrors.notFound();
    return paper;
  }

  blanksOf(paper) {
    const pieces = isSong(paper.exercise) ? numberedPieces(paper.content.segments) : [];
    if (!pieces.flat().some((piece) => 'blank' in piece)) throw listeningErrors.noBlanks();
    return pieces;
  }

  async getExercise(actor, exerciseId, { mode = ListeningMode.FULL } = {}) {
    this.assertStudent(actor);
    const [paper, results, lines] = await Promise.all([this.paper(exerciseId), this.repository.listResults(actor.id, exerciseId), this.repository.listLines(actor.id, exerciseId)]);
    const { audioMediaId, segments } = paper.content;
    if (isHideMode(mode) && !isToeic(paper.exercise)) throw listeningErrors.wrongMode();
    const pieces = mode === ListeningMode.BLANKS ? this.blanksOf(paper) : isHideMode(mode) ? segments.map((segment) => hiddenPieces(segment, LISTENING_HIDE_SHARE[mode], this.random)) : null;
    return {
      exercise: paper.exercise,
      source: paper.content.source?.name ? { name: paper.content.source.name, url: paper.content.source.url || '' } : null,
      mode,
      audioUrl: (audioMediaId && paper.media[audioMediaId]?.url) || null,
      blankCount: (isSong(paper.exercise) ? numberedPieces(segments) : pieces || []).flat().filter((piece) => 'blank' in piece).length,
      segments: segments.map(({ id, speaker, start, end }, index) => ({
        id,
        speaker,
        start,
        end,
        ...(pieces ? { pieces: pieces[index].map((piece) => ('blank' in piece ? { blank: piece.blank, ...(piece.size ? { size: piece.size } : {}) } : piece)) } : {}),
      })),
      lines: Object.fromEntries(lines.map((line) => [line.segmentId, line.status])),
      ...this.resultsView(results),
    };
  }

  async getTranscript(actor, exerciseId) {
    this.assertStudent(actor);
    const paper = await this.paper(exerciseId);
    const song = isSong(paper.exercise);
    return {
      segments: paper.content.segments.map(({ id, speaker, text, start, end, translation }) => ({
        id,
        speaker,
        text: song ? lyricText(text) : text,
        translation: translation || '',
        start,
        end,
      })),
    };
  }

  async check(actor, exerciseId, { mode = ListeningMode.FULL, answers }) {
    this.assertStudent(actor);
    const paper = await this.paper(exerciseId);
    const scored = this.score(paper, mode, answers);
    const result = await this.repository.recordCheck(actor.id, exerciseId, mode, scored.accuracy, this.now());
    await recordActivity(this.events, actor.id, StudyActivity.LISTENING_PRACTICE, this.now());
    return { mode, accuracy: scored.accuracy, ...this.resultView(result), segments: scored.segments };
  }

  async checkLine(actor, exerciseId, { mode = ListeningMode.FULL, segmentId, answers }) {
    this.assertStudent(actor);
    const paper = await this.paper(exerciseId);
    if (!paper.content.segments.some((segment) => segment.id === segmentId)) throw listeningErrors.noLine();
    if (isHideMode(mode)) {
      const segment = paper.content.segments.find((item) => item.id === segmentId);
      const line = checkHiddenLine(segment, answers, LISTENING_HIDE_SHARE[mode]);
      if (!line) throw listeningErrors.badBlanks();
      return this.lineChecked(actor, exerciseId, mode, { id: segment.id, speaker: segment.speaker, text: segment.text, pieces: line.pieces, accuracy: line.accuracy });
    }
    const scored = this.score(paper, mode, answers);
    return this.lineChecked(actor, exerciseId, mode, scored.segments.find((segment) => segment.id === segmentId));
  }

  async lineChecked(actor, exerciseId, mode, segment) {
    const status = segment.accuracy === 100 || segment.accuracy === null ? LineStatus.DONE : LineStatus.WRONG;
    await this.repository.recordLine(actor.id, exerciseId, segment.id, status, this.now());
    return { mode, status, segment };
  }

  score(paper, mode, answers) {
    if (mode === ListeningMode.BLANKS) return this.checkBlanks(paper, answers);
    if (isHideMode(mode)) return this.checkHidden(paper, mode, answers);
    return this.checkLines(paper, answers);
  }

  checkHidden(paper, mode, answers) {
    if (!isToeic(paper.exercise)) throw listeningErrors.wrongMode();
    let right = 0;
    let count = 0;
    const segments = paper.content.segments.map((segment) => {
      const line = checkHiddenLine(segment, answers, LISTENING_HIDE_SHARE[mode]);
      if (!line) throw listeningErrors.badBlanks();
      right += line.right;
      count += line.count;
      return { id: segment.id, speaker: segment.speaker, text: segment.text, pieces: line.pieces, accuracy: line.accuracy };
    });
    return { accuracy: count ? Math.round((right * 100) / count) : 0, segments };
  }

  checkLines(paper, answers) {
    let total = 0;
    let errors = 0;
    const segments = paper.content.segments.map((segment) => {
      const text = isSong(paper.exercise) ? lyricText(segment.text) : segment.text;
      const typed = answers[segment.id] || '';
      const checked = checkSentence(text, typed);
      total += checked.total;
      errors += checked.errors;
      return { id: segment.id, speaker: segment.speaker, text, typed, words: checked.words, accuracy: accuracyOf(checked.total, checked.errors) };
    });
    return { accuracy: accuracyOf(total, errors), segments };
  }

  checkBlanks(paper, answers) {
    const pieces = this.blanksOf(paper);
    let right = 0;
    let count = 0;
    const segments = paper.content.segments.map((segment, index) => {
      const line = pieces[index].map((piece) => {
        if (!('blank' in piece)) return piece;
        const typed = answers[String(piece.blank)] || '';
        const correct = sameWords(piece.answer, typed);
        count++;
        if (correct) right++;
        return { ...piece, typed, correct };
      });
      const blanks = line.filter((piece) => 'blank' in piece);
      return {
        id: segment.id,
        speaker: segment.speaker,
        text: lyricText(segment.text),
        pieces: line,
        accuracy: blanks.length ? Math.round((blanks.filter((piece) => piece.correct).length * 100) / blanks.length) : null,
      };
    });
    return { accuracy: count ? Math.round((right * 100) / count) : 0, segments };
  }
}
