import { randomUUID } from 'node:crypto';
import { MockService } from '../src/mock/mock.service.js';
import { createMemoryRepository, student } from './helpers.js';

// A mock paper as content-service returns it: 2+1+2+1 listening and 2+2+3
// reading questions (13); the first option of every question is correct.
export function mockPaper(mockTest, versionNumber = 1) {
  const audio = randomUUID();
  const question = (fields = {}) => ({
    id: randomUUID(), prompt: 'Q?', audioMediaId: null, transcript: '', imageMediaId: null, groupId: null, explanation: 'Secret explanation',
    options: Array.from({ length: 4 }, (_, index) => ({ id: randomUUID(), text: `Option ${index + 1}`, isCorrect: index === 0 })),
    ...fields,
  });
  const part = (count, extra = {}) => ({ audioMediaId: null, transcript: '', passage: '', imageMediaId: null, groups: [], questions: Array.from({ length: count }, () => question()), ...extra });
  const spoken = { audioMediaId: audio, transcript: 'Secret transcript' };
  const [group3, group4, group6] = [randomUUID(), randomUUID(), randomUUID()];
  const set = (id, fields) => ({ id, audioMediaId: null, transcript: '', passage: '', imageMediaId: null, ...fields });
  return {
    mockTest,
    versionId: randomUUID(),
    versionNumber,
    test: {
      // Parts 1-2: a recording per question; Parts 3-4: a recording per set.
      part1: { ...part(0), questions: [question(spoken), question(spoken)] },
      part2: { ...part(0), questions: [question(spoken)] },
      part3: { ...part(0), groups: [set(group3, spoken)], questions: [question({ groupId: group3 }), question({ groupId: group3 })] },
      part4: { ...part(0), groups: [set(group4, spoken)], questions: [question({ groupId: group4 })] },
      part5: part(2),
      part6: { ...part(0), groups: [set(group6, { passage: 'Dear ___, the ___.' })], questions: [question({ groupId: group6 }), question({ groupId: group6 })] },
      part7: part(3),
    },
    media: { [audio]: { kind: 'audio', fileName: 'a.mp3', url: 'https://media.test/a.mp3' } },
  };
}

export function createMockRepository() {
  const tables = { attempts: [], conversion: null };
  const copy = (row) => (row ? structuredClone(row) : null);
  return {
    tables,
    async listFinishedAttempts(accountId) {
      return tables.attempts
        .filter((row) => row.accountId === accountId && row.status === 'COMPLETED')
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
        .map(copy);
    },
    async listTestAttempts(accountId, mockTestId) {
      return tables.attempts
        .filter((row) => row.accountId === accountId && row.mockTestId === mockTestId)
        .sort((a, b) => a.attemptNumber - b.attemptNumber)
        .map(copy);
    },
    async listRecentAttempts(accountId, limit) {
      return tables.attempts
        .filter((row) => row.accountId === accountId && row.status === 'COMPLETED')
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .slice(0, limit)
        .map(copy);
    },
    async listCompletedAttempts(accountId) {
      return tables.attempts
        .filter((row) => row.accountId === accountId && row.status === 'COMPLETED')
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
        .map(copy);
    },
    async listReviewAnswers(accountId) {
      return (tables.reviews || []).filter((row) => row.accountId === accountId).map(copy);
    },
    async saveReviewAnswer(answer) {
      tables.reviews = [...(tables.reviews || []), { id: randomUUID(), ...structuredClone(answer) }];
      return copy(answer);
    },
    async findGoal(accountId) { return copy(tables.goals?.[accountId]); },
    async saveGoal(goal) { tables.goals = { ...tables.goals, [goal.accountId]: { ...goal } }; return copy(goal); },
    async deleteGoal(accountId) { if (tables.goals) delete tables.goals[accountId]; },
    async listCompletedTestAttempts(mockTestId) {
      return tables.attempts.filter((row) => row.mockTestId === mockTestId && row.status === 'COMPLETED').map(copy);
    },
    async createAttempt(attempt) {
      const same = (row) => row.accountId === attempt.accountId && row.mockTestId === attempt.mockTestId && row.kind === attempt.kind && row.partKey === attempt.partKey;
      if (tables.attempts.some((row) => same(row) && (row.status === 'IN_PROGRESS' || row.attemptNumber === attempt.attemptNumber))) return null;
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
    async findConversion() { return copy(tables.conversion); },
    async saveConversion(conversion) { tables.conversion = { ...conversion, id: 1 }; return copy(tables.conversion); },
  };
}

export async function harness({ startUnit = null } = {}) {
  const tests = [
    { id: randomUUID(), title: 'Level 1 test', level: 1, durationMinutes: 120 },
    { id: randomUUID(), title: 'Level 2 test', level: 2, durationMinutes: 60 },
  ];
  const papers = new Map();
  const versions = new Map();
  const content = {
    republish(mockTest) {
      const paper = mockPaper(mockTest, (papers.get(mockTest.id)?.versionNumber || 0) + 1);
      papers.set(mockTest.id, paper);
      versions.set(paper.versionId, paper);
      return paper;
    },
    paperOf: (id) => papers.get(id),
    async listPublishedMockTests() {
      return { mockTests: tests.map((mockTest) => ({ ...mockTest, questionCount: 13, partCounts: {} })) };
    },
    async getMockPaper(id, versionId) {
      const paper = versionId ? versions.get(versionId) : papers.get(id);
      return paper && paper.mockTest.id === id ? structuredClone(paper) : null;
    },
  };
  tests.forEach((mockTest) => content.republish(mockTest));
  const placement = createMemoryRepository();
  if (startUnit) await placement.createAttempt({ accountId: student.id, status: 'COMPLETED', startUnit, answers: {} });
  const repository = createMockRepository();
  const clock = { now: new Date('2026-10-11T08:00:00Z') };
  const service = new MockService(repository, placement, content, { now: () => new Date(clock.now) });
  const advance = (minutes) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60 * 1000);
  };
  // Answers with the first `correct` questions (of the given parts) right.
  const answers = (id, correct, partKeys) => {
    const paper = content.paperOf(id);
    const questions = Object.entries(paper.test).filter(([key]) => !partKeys || partKeys.includes(key)).flatMap(([, part]) => part.questions);
    return Object.fromEntries(questions.map((question, index) => [question.id, question.options[index < correct ? 0 : 1].id]));
  };
  return { service, repository, content, tests, advance, answers };
}
