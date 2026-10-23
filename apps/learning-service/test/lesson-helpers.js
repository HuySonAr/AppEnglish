import { randomUUID } from 'node:crypto';
import { createMemoryRepository, placementPaper } from './helpers.js';

export function createLessonRepository() {
  const tables = { progress: [], attempts: [], reviewAttempts: [] };
  const copy = (row) => (row ? structuredClone(row) : null);
  return {
    tables,
    async listReviewAttempts(accountId, unitId) {
      return tables.reviewAttempts
        .filter((row) => row.accountId === accountId && (!unitId || row.unitId === unitId))
        .sort((a, b) => a.unitId.localeCompare(b.unitId) || a.attemptNumber - b.attemptNumber)
        .map(copy);
    },
    async createReviewAttempt(attempt) {
      const stored = { id: randomUUID(), ...structuredClone(attempt) };
      tables.reviewAttempts.push(stored);
      return copy(stored);
    },
    async listProgress(accountId) {
      return tables.progress.filter((row) => row.accountId === accountId).map(copy);
    },
    async findProgress(accountId, lessonId) {
      return copy(tables.progress.find((row) => row.accountId === accountId && row.lessonId === lessonId));
    },
    async saveProgress(progress) {
      const index = tables.progress.findIndex(
        (row) => row.accountId === progress.accountId && row.lessonId === progress.lessonId,
      );
      const stored = { id: tables.progress[index]?.id || randomUUID(), ...tables.progress[index], ...structuredClone(progress) };
      if (index >= 0) tables.progress[index] = stored;
      else tables.progress.push(stored);
      return copy(stored);
    },
    async listAttempts(accountId, lessonId) {
      return tables.attempts
        .filter((row) => row.accountId === accountId && row.lessonId === lessonId)
        .sort((a, b) => a.attemptNumber - b.attemptNumber)
        .map(copy);
    },
    async listCompletedAttempts(accountId) {
      return tables.attempts.filter((row) => row.accountId === accountId && row.status === 'COMPLETED').map(copy);
    },
    async createAttempt(attempt) {
      const clash = tables.attempts.some(
        (row) =>
          row.accountId === attempt.accountId &&
          row.lessonId === attempt.lessonId &&
          (row.attemptNumber === attempt.attemptNumber || row.status === 'IN_PROGRESS'),
      );
      if (clash) return null;
      const stored = { id: randomUUID(), ...structuredClone(attempt) };
      tables.attempts.push(stored);
      return copy(stored);
    },
    async saveAttempt(attempt) {
      tables.attempts[tables.attempts.findIndex((row) => row.id === attempt.id)] = structuredClone(attempt);
      return copy(attempt);
    },
    async deleteOpenAttempt(id) {
      tables.attempts = tables.attempts.filter((row) => row.id !== id || row.status !== 'IN_PROGRESS');
    },
    async listRanking(lessonId) {
      return tables.attempts
        .filter((row) => row.lessonId === lessonId && row.attemptNumber === 1 && row.status === 'COMPLETED')
        .sort(
          (a, b) =>
            b.correctCount - a.correctCount ||
            a.durationSeconds - b.durationSeconds ||
            new Date(a.submittedAt) - new Date(b.submittedAt),
        )
        .map(copy);
    },
  };
}

const words = [
  ['ticket', 'vé'],
  ['platform', 'sân ga'],
  ['luggage', 'hành lý'],
  ['delay', 'sự chậm trễ'],
  ['passenger', 'hành khách'],
];

export function lessonPaper(lesson, unit, { versionNumber = 1, wordCount = 5 } = {}) {
  const base = placementPaper();
  const vocabulary = words.slice(0, wordCount).map(([word, meaning]) => ({
    id: randomUUID(),
    word: `${word}-${lesson.title}`,
    partOfSpeech: 'noun',
    phonetic: '',
    audioUkMediaId: null,
    audioUsMediaId: null,
    meaning: `${meaning} (${lesson.title})`,
    example: `The ${word} is here.`,
    exampleMeaning: '',
  }));
  return {
    lesson: { id: lesson.id, title: lesson.title, unitId: unit.id, unitTitle: unit.title },
    versionId: randomUUID(),
    versionNumber,
    content: {
      vocabulary,
      fillIn: { passage: 'The ___ left from the ___.', answers: [vocabulary[0].word, vocabulary[1 % vocabulary.length].word] },
      test: base.test,
    },
    media: base.media,
  };
}

export function reviewPaper(unit, { versionNumber = 1 } = {}) {
  const options = () => Array.from({ length: 4 }, (_, index) => ({ id: randomUUID(), text: `Option ${index + 1}`, isCorrect: index === 0 }));
  const question = (fields) => ({ id: randomUUID(), prompt: '', audioMediaId: null, transcript: '', imageMediaId: null, groupId: null, explanation: 'Secret explanation', options: options(), ...fields });
  const groups = [1, 2, 3].map((number) => ({ id: randomUUID(), audioMediaId: null, transcript: '', passage: `Passage ${number}: ___ ___ ___.`, imageMediaId: null }));
  return {
    unit: { id: unit.id, title: unit.title },
    versionId: randomUUID(),
    versionNumber,
    test: {
      part5: { audioMediaId: null, transcript: '', passage: '', imageMediaId: null, groups: [], questions: Array.from({ length: 10 }, (_, index) => question({ prompt: `Sentence ${index + 1}?` })) },
      part6: { audioMediaId: null, transcript: '', passage: '', imageMediaId: null, groups, questions: groups.flatMap((group) => Array.from({ length: 3 }, () => question({ groupId: group.id }))) },
    },
  };
}

export function reviewAnswers(paper, correct) {
  const questions = [...paper.test.part5.questions, ...paper.test.part6.questions];
  return Object.fromEntries(questions.map((question, index) => [question.id, question.options[index < correct ? 0 : 1].id]));
}

export function createCurriculum(shape = [2, 2], { reviews = [] } = {}) {
  const units = shape.map((count, unitIndex) => ({
    id: randomUUID(),
    title: `Unit ${unitIndex + 1}`,
    description: '',
    reviewVersionId: null,
    lessons: Array.from({ length: count }, (_, lessonIndex) => ({
      id: randomUUID(),
      title: `U${unitIndex + 1}L${lessonIndex + 1}`,
    })),
  }));
  const papers = new Map();
  const versions = new Map();
  const reviewPapers = new Map();
  const client = {
    units,
    lessons: units.flatMap((unit) => unit.lessons),
    paperOf: (lessonId) => papers.get(lessonId),
    reviewOf: (unitId) => reviewPapers.get(unitId),
    publishReview(unitId) {
      const unit = units.find((item) => item.id === unitId);
      const paper = reviewPaper(unit, { versionNumber: (reviewPapers.get(unitId)?.versionNumber || 0) + 1 });
      reviewPapers.set(unitId, paper);
      unit.reviewVersionId = paper.versionId;
      return paper;
    },
    unpublishReview(unitId) {
      units.find((item) => item.id === unitId).reviewVersionId = null;
    },
    async getUnitReviewPaper(unitId) {
      const unit = units.find((item) => item.id === unitId);
      return unit?.reviewVersionId ? structuredClone(reviewPapers.get(unitId)) : null;
    },
    republish(lessonId) {
      const unit = units.find((item) => item.lessons.some((lesson) => lesson.id === lessonId));
      const lesson = unit.lessons.find((item) => item.id === lessonId);
      const paper = lessonPaper(lesson, unit, { versionNumber: (papers.get(lessonId)?.versionNumber || 0) + 1 });
      papers.set(lessonId, paper);
      versions.set(paper.versionId, paper);
      return paper;
    },
    async getCurriculum() {
      return structuredClone({ units });
    },
    async getLessonPaper(lessonId, versionId) {
      const paper = versionId ? versions.get(versionId) : papers.get(lessonId);
      return paper && paper.lesson.id === lessonId ? structuredClone(paper) : null;
    },
    async getPlacementPaper() {
      return null;
    },
  };
  for (const lesson of client.lessons) client.republish(lesson.id);
  for (const index of reviews) client.publishReview(units[index].id);
  return client;
}

export async function placementWith(accountId, startUnit) {
  const repository = createMemoryRepository();
  if (startUnit !== null)
    await repository.createAttempt({ accountId, status: startUnit === 1 ? 'SKIPPED' : 'COMPLETED', startUnit, answers: {} });
  return repository;
}

export function quizAnswers(paper, { wrong = 0 } = {}) {
  return Object.fromEntries(
    paper.content.vocabulary.map((item, index) => [item.id, index < wrong ? 'not the meaning' : item.meaning]),
  );
}

export function testAnswers(paper, correct) {
  const questions = Object.values(paper.content.test).flatMap((part) => part.questions);
  return Object.fromEntries(
    questions.map((question, index) => [question.id, question.options[index < correct ? 0 : 1].id]),
  );
}
