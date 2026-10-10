import { randomUUID } from 'node:crypto';
import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';

export const student = { id: '22222222-2222-4222-8222-222222222222', role: 'STUDENT' };
export const otherStudent = { id: '44444444-4444-4444-8444-444444444444', role: 'STUDENT' };
export const manager = { id: '11111111-1111-4111-8111-111111111111', role: 'CONTENT_MANAGER' };
export const admin = { id: '33333333-3333-4333-8333-333333333333', role: 'ADMIN' };

// In-memory stand-in for PlacementRepository.
export function createMemoryRepository() {
  const tables = { attempts: [], settings: null };
  const copy = (row) => (row ? structuredClone(row) : null);
  return {
    tables,
    async findAttempt(accountId) {
      return copy(tables.attempts.find((attempt) => attempt.accountId === accountId));
    },
    async saveAttempt(attempt) {
      const index = tables.attempts.findIndex((item) => item.id === attempt.id);
      tables.attempts[index] = structuredClone(attempt);
      return copy(attempt);
    },
    async createAttempt(attempt) {
      if (tables.attempts.some((item) => item.accountId === attempt.accountId)) return null;
      const stored = { id: randomUUID(), ...structuredClone(attempt) };
      tables.attempts.push(stored);
      return copy(stored);
    },
    async findSettings() {
      return copy(tables.settings);
    },
    async saveSettings(settings) {
      tables.settings = { ...settings, id: 1 };
      return copy(tables.settings);
    },
  };
}

// A published placement paper as content-service returns it: 23 questions,
// the first option of every question is the correct one.
export function placementPaper({ versionNumber = 1, publishedUnitCount = 5 } = {}) {
  const audio = randomUUID();
  const image = randomUUID();
  const test = Object.fromEntries(
    LESSON_TEST_PARTS.map((spec) => [
      spec.key,
      {
        audioMediaId: spec.group.audio ? audio : null,
        transcript: spec.group.audio ? 'Secret transcript' : '',
        passage: spec.group.passage ? 'A passage' : '',
        imageMediaId: null,
        questions: Array.from({ length: spec.questionCount }, (_, index) => ({
          id: randomUUID(),
          prompt: spec.question.prompt ? `Question ${index + 1}?` : '',
          audioMediaId: null,
          transcript: '',
          imageMediaId: spec.question.image ? image : null,
          explanation: 'Secret explanation',
          options: Array.from({ length: spec.optionCount }, (_, optionIndex) => ({
            id: randomUUID(),
            text: spec.option.text ? `Option ${optionIndex + 1}` : '',
            audioMediaId: null,
            transcript: '',
            isCorrect: optionIndex === 0,
          })),
        })),
      },
    ]),
  );
  return {
    versionId: randomUUID(),
    versionNumber,
    test,
    media: {
      [audio]: { kind: 'audio', fileName: 'a.mp3', url: 'https://media.test/a.mp3' },
      [image]: { kind: 'image', fileName: 'p.png', url: 'https://media.test/p.png' },
    },
    publishedUnitCount,
  };
}

// Content-service stand-in. published is the latest paper (null: none yet);
// earlier versions stay readable by id.
export function createContentClient(initial = placementPaper()) {
  const versions = new Map();
  const client = {
    published: null,
    publish(paper) {
      client.published = paper;
      if (paper) versions.set(paper.versionId, paper);
    },
    async getPlacementPaper(versionId) {
      return structuredClone(versionId ? versions.get(versionId) || null : client.published);
    },
  };
  client.publish(initial);
  return client;
}

// Answers with the first `correct` questions right and the rest wrong.
export function answersFor(paper, correct, { skip = 0 } = {}) {
  const questions = LESSON_TEST_PARTS.flatMap((spec) => paper.test[spec.key].questions);
  return Object.fromEntries(
    questions
      .slice(0, questions.length - skip)
      .map((question, index) => [question.id, question.options[index < correct ? 0 : 1].id]),
  );
}
