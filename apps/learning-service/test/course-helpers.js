import { randomUUID } from 'node:crypto';
import { CourseLessonService } from '../src/course/course.service.js';

// In-memory stand-in for CourseRepository.
export function createCourseRepository() {
  const tables = { results: [], tests: [] };
  const copy = (row) => (row ? structuredClone(row) : null);
  const upsert = (rows, match, fields, score, passed, at) => {
    const row = rows.find(match);
    if (row)
      Object.assign(row, fields, {
        bestScore: Math.max(row.bestScore, score),
        lastScore: score,
        attemptCount: row.attemptCount + 1,
        passedAt: row.passedAt || (passed ? at : null),
        lastAttemptAt: at,
      });
    else rows.push({ id: randomUUID(), ...fields, bestScore: score, lastScore: score, attemptCount: 1, passedAt: passed ? at : null, lastAttemptAt: at });
  };
  const repository = {
    tables,
    async listResults(accountId) {
      return tables.results.filter((row) => row.accountId === accountId).map(copy);
    },
    async findResult(accountId, lessonId) {
      return copy(tables.results.find((row) => row.accountId === accountId && row.lessonId === lessonId));
    },
    async recordAttempt(accountId, unitId, lessonId, score, passed, at) {
      upsert(tables.results, (row) => row.accountId === accountId && row.lessonId === lessonId, { accountId, unitId, lessonId }, score, passed, at);
      return repository.findResult(accountId, lessonId);
    },
    async listTestResults(accountId) {
      return tables.tests.filter((row) => row.accountId === accountId).map(copy);
    },
    async findTestResult(accountId, itemId) {
      return copy(tables.tests.find((row) => row.accountId === accountId && row.itemId === itemId));
    },
    async recordTestAttempt(accountId, itemId, kind, level, score, passed, at) {
      upsert(tables.tests, (row) => row.accountId === accountId && row.itemId === itemId, { accountId, itemId, kind, level }, score, passed, at);
      return repository.findTestResult(accountId, itemId);
    },
  };
  return repository;
}

const option = (text, isCorrect = false) => ({ id: randomUUID(), text, isCorrect });
export const question = (prompt, right = 'A coffee', wrong = 'A tea') => ({
  id: randomUUID(),
  skill: 'detail',
  prompt,
  options: [option(right, true), option(wrong)],
  explanation: `Because: ${right}.`,
});

// Content-service stand-in (D145). A1: topics "Ordering" and "Paying" and a
// level test of 4 questions; A2: topic "Meetings" and a level test; B1–C2
// empty. Every topic holds the same recording of four sentences (D147).
export function courseHarness() {
  const segment = (text, start, end, speaker = '', index = 0) => ({
    id: randomUUID(),
    text,
    start,
    end,
    speaker,
    translation: `Câu ${index + 1}`,
    gap: index === 1 ? 'Yes, a [coffee] [please].' : '',
  });
  const lines = [
    ['Can I help you?', 0, 2, 'Man'],
    ['Yes, a coffee please.', 2, 4, 'Woman'],
    ['Small or large?', 4, 6, 'Man'],
    ['Large, please.', 6, 8, 'Woman'],
  ];
  const recording = randomUUID();
  const wordAudio = randomUUID();
  const topicContent = () => ({
    audioMediaId: recording,
    segments: lines.map(([text, start, end, speaker], index) => segment(text, start, end, speaker, index)),
    vocabulary: [{ id: randomUUID(), word: 'large', phonetic: '/lɑːdʒ/', meaning: 'lớn', audioMediaId: wordAudio }],
    questions: [question('What does she want?')],
    ordering: { enabled: true, prompt: 'In order', items: ['He offers help', 'She asks for coffee', 'She chooses a size'].map((text) => ({ id: randomUUID(), text })) },
  });
  const versionId = () => randomUUID();
  const item = (level, type, title, content, position = 0) => ({
    item: { id: randomUUID(), level, type, title, description: `${title} description`, position },
    versionId: versionId(),
    versionNumber: 1,
    content,
  });
  const ordering = item('A1', 'topic', 'Ordering', topicContent(), 1);
  const paying = item('A1', 'topic', 'Paying', topicContent(), 2);
  const a1Test = item('A1', 'level_test', 'A1 test', { sections: [{ id: randomUUID(), audioMediaId: recording, transcript: 'Man: Can I help you?\nWoman: Yes, a coffee please.\nMan: Small or large?\nWoman: Large, please.', questions: [1, 2, 3, 4].map((n) => question(`Q${n}?`)) }] });
  const meetings = item('A2', 'topic', 'Meetings', topicContent(), 1);
  const a2Test = item('A2', 'level_test', 'A2 test', { sections: [{ id: randomUUID(), audioMediaId: recording, transcript: 'Man: Can I help you?\nWoman: Yes, a coffee please.\nMan: Small or large?\nWoman: Large, please.', questions: [1, 2].map((n) => question(`R${n}?`)) }] });
  const papers = [ordering, paying, a1Test, meetings, a2Test];
  const summary = (paper) => ({
    ...paper.item,
    versionId: paper.versionId,
    questionCount: paper.item.type === 'topic' ? paper.content.questions.length : paper.content.sections.reduce((sum, section) => sum + section.questions.length, 0),
  });
  const course = {
    levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => ({
      level,
      topics: papers.filter((paper) => paper.item.level === level && paper.item.type === 'topic').map(summary),
      levelTest: (() => {
        const test = papers.find((paper) => paper.item.level === level && paper.item.type === 'level_test');
        return test ? summary(test) : null;
      })(),
    })),
  };
  const contentClient = {
    async listPublishedCourse() {
      return structuredClone(course);
    },
    async getCoursePaper(itemId, wanted) {
      const paper = papers.find((entry) => entry.item.id === itemId);
      if (!paper || (wanted && wanted !== paper.versionId)) return null;
      return structuredClone({ ...paper, media: { [recording]: 'https://media.test/cafe.mp3', [wordAudio]: 'https://media.test/large.mp3' } });
    },
  };
  const repository = createCourseRepository();
  const clock = { now: new Date('2026-10-22T08:00:00Z') };
  const recorded = [];
  const events = { record: async (type, payload) => recorded.push({ type, payload }) };
  const service = new CourseLessonService(repository, contentClient, { now: () => new Date(clock.now), events });
  return { service, repository, course, segments: paying.content.segments, ordering, paying, a1Test, meetings, a2Test, recorded };
}

// The answers of a level test with the first `right` questions right.
export function testAnswers(paper, right) {
  const questions = paper.content.sections.flatMap((section) => section.questions);
  return Object.fromEntries(
    questions.map((item, index) => [item.id, item.options.find((entry) => entry.isCorrect === index < right).id]),
  );
}
