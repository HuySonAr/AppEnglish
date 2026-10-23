import { AccountRole } from '@appenglish/auth-contracts';
import { lyricPieces, lyricText } from '@appenglish/content-contracts';
import { ListeningMode, StudyActivity } from '@appenglish/learning-contracts';
import { noEvents, recordActivity } from '../events/learning-events.js';
import { placementErrors } from '../placement/placement.errors.js';
import { accuracyOf, checkSentence, sameWords } from './dictation.rules.js';
import { listeningErrors } from './listening.errors.js';

const isSong = (exercise) => exercise.kind === 'song';

// The words of a song line in brackets are blanks (D88), numbered across the
// whole song from 0: the line's pieces with { blank: number, answer }.
function numberedPieces(segments) {
  let next = 0;
  return segments.map((segment) =>
    lyricPieces(segment.text).map((piece) => ('blank' in piece ? { blank: next++, answer: piece.blank } : piece)),
  );
}

// Listening practice (F05B-3, D85, D86; songs D88): dictation exercises
// written in content-service, open to every learner. Each check is scored
// here and the learner's best and latest accuracy per exercise and mode is
// kept.
export class ListeningPracticeService {
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
      ? { bestAccuracy: result.bestAccuracy, lastAccuracy: result.lastAccuracy, checkCount: result.checkCount }
      : { bestAccuracy: null, lastAccuracy: null, checkCount: 0 };
  }

  // The results of one exercise: those of the full mode at the top level,
  // those of the blanks mode under `blanks`.
  resultsView(results) {
    const of = (mode) => results.find((result) => result.mode === mode);
    return { ...this.resultView(of(ListeningMode.FULL)), blanks: this.resultView(of(ListeningMode.BLANKS)) };
  }

  // The topics that have published exercises, and those exercises with the
  // learner's results.
  async listPractice(actor) {
    this.assertStudent(actor);
    const [published, results] = await Promise.all([
      this.contentClient.listPublishedListeningExercises(),
      this.repository.listResults(actor.id),
    ]);
    const used = new Set(published.exercises.map((exercise) => exercise.topic?.id));
    return {
      topics: published.topics
        .filter((topic) => used.has(topic.id))
        .map((topic) => ({ id: topic.id, code: topic.code, name: topic.name, format: topic.format })),
      exercises: published.exercises.map((exercise) => ({
        ...exercise,
        ...this.resultsView(results.filter((result) => result.exerciseId === exercise.id)),
      })),
    };
  }

  async paper(exerciseId) {
    const paper = await this.contentClient.getListeningPaper(exerciseId);
    if (!paper) throw listeningErrors.notFound();
    return paper;
  }

  // The blanks of a song, refusing an exercise that has none.
  blanksOf(paper) {
    const pieces = isSong(paper.exercise) ? numberedPieces(paper.content.segments) : [];
    if (!pieces.flat().some((piece) => 'blank' in piece)) throw listeningErrors.noBlanks();
    return pieces;
  }

  // One exercise to practise: the recording and the sentences with their
  // place in it. In full mode the text is left out; in blanks mode a song's
  // lines come with the blanks in place of their words.
  async getExercise(actor, exerciseId, { mode = ListeningMode.FULL } = {}) {
    this.assertStudent(actor);
    const [paper, results] = await Promise.all([this.paper(exerciseId), this.repository.listResults(actor.id, exerciseId)]);
    const { audioMediaId, segments } = paper.content;
    const pieces = mode === ListeningMode.BLANKS ? this.blanksOf(paper) : null;
    return {
      exercise: paper.exercise,
      source: paper.content.source?.name ? { name: paper.content.source.name, url: paper.content.source.url || '' } : null,
      mode,
      audioUrl: (audioMediaId && paper.media[audioMediaId]?.url) || null,
      blankCount: isSong(paper.exercise) ? numberedPieces(segments).flat().filter((piece) => 'blank' in piece).length : 0,
      segments: segments.map(({ id, speaker, start, end }, index) => ({
        id,
        speaker,
        start,
        end,
        ...(pieces ? { pieces: pieces[index].map((piece) => ('blank' in piece ? { blank: piece.blank } : piece)) } : {}),
      })),
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

  // Scores what the learner wrote, keeps the result for the mode and returns
  // it with the transcript.
  async check(actor, exerciseId, { mode = ListeningMode.FULL, answers }) {
    this.assertStudent(actor);
    const paper = await this.paper(exerciseId);
    const scored = mode === ListeningMode.BLANKS ? this.checkBlanks(paper, answers) : this.checkLines(paper, answers);
    const result = await this.repository.recordCheck(actor.id, exerciseId, mode, scored.accuracy, this.now());
    await recordActivity(this.events, actor.id, StudyActivity.LISTENING_PRACTICE, this.now());
    return { mode, accuracy: scored.accuracy, ...this.resultView(result), segments: scored.segments };
  }

  // Checks one sentence or song line as the learner goes (D93): the same
  // scoring as a whole check, but only that line comes back and nothing is
  // kept; the score is kept by the check of the whole exercise at the end.
  async checkLine(actor, exerciseId, { mode = ListeningMode.FULL, segmentId, answers }) {
    this.assertStudent(actor);
    const paper = await this.paper(exerciseId);
    if (!paper.content.segments.some((segment) => segment.id === segmentId)) throw listeningErrors.noLine();
    const scored = mode === ListeningMode.BLANKS ? this.checkBlanks(paper, answers) : this.checkLines(paper, answers);
    return { mode, segment: scored.segments.find((segment) => segment.id === segmentId) };
  }

  // Every sentence written down (answers by sentence id), word by word (D86).
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

  // The blanks of a song filled in (answers by blank number): each is right or
  // wrong; the score is the share of right blanks (D88).
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
