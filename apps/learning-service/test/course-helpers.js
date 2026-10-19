import { randomUUID } from 'node:crypto';
import { CourseLessonService } from '../src/course/course.service.js';

// In-memory stand-in for CourseRepository.
export function createCourseRepository() {
  const tables = { results: [], tests: [], placements: [], mistakes: [] };
  const copy = (row) => (row ? structuredClone(row) : null);
  const repository = {
    tables,
    async listResults(accountId) {
      return tables.results.filter((row) => row.accountId === accountId).map(copy);
    },
    async findResult(accountId, lessonId) {
      return copy(tables.results.find((row) => row.accountId === accountId && row.lessonId === lessonId));
    },
    async recordAttempt(accountId, unitId, lessonId, score, passed, at) {
      const row = tables.results.find((item) => item.accountId === accountId && item.lessonId === lessonId);
      if (row)
        Object.assign(row, {
          unitId,
          bestScore: Math.max(row.bestScore, score),
          lastScore: score,
          attemptCount: row.attemptCount + 1,
          passedAt: row.passedAt || (passed ? at : null),
          lastAttemptAt: at,
        });
      else
        tables.results.push({
          id: randomUUID(),
          accountId,
          unitId,
          lessonId,
          bestScore: score,
          lastScore: score,
          attemptCount: 1,
          passedAt: passed ? at : null,
          lastAttemptAt: at,
        });
      return repository.findResult(accountId, lessonId);
    },
    async listTestResults(accountId) {
      return tables.tests.filter((row) => row.accountId === accountId).map(copy);
    },
    async findTestResult(accountId, itemId) {
      return copy(tables.tests.find((row) => row.accountId === accountId && row.itemId === itemId));
    },
    async recordTestAttempt(accountId, itemId, kind, level, score, passed, at) {
      const row = tables.tests.find((item) => item.accountId === accountId && item.itemId === itemId);
      if (row)
        Object.assign(row, {
          bestScore: Math.max(row.bestScore, score),
          lastScore: score,
          attemptCount: row.attemptCount + 1,
          passedAt: row.passedAt || (passed ? at : null),
          lastAttemptAt: at,
        });
      else
        tables.tests.push({
          id: randomUUID(),
          accountId,
          itemId,
          kind,
          level,
          bestScore: score,
          lastScore: score,
          attemptCount: 1,
          passedAt: passed ? at : null,
          lastAttemptAt: at,
        });
      return repository.findTestResult(accountId, itemId);
    },
    async listMistakes(accountId) {
      return tables.mistakes
        .filter((row) => row.accountId === accountId)
        .sort((a, b) => b.lastMissedAt - a.lastMissedAt)
        .map(copy);
    },
    async findMistake(accountId, id) {
      return copy(tables.mistakes.find((row) => row.accountId === accountId && row.id === id));
    },
    async recordMistake(mistake) {
      const row = tables.mistakes.find(
        (item) => item.accountId === mistake.accountId && item.lessonId === mistake.lessonId && item.segmentId === mistake.segmentId,
      );
      const fields = ({ id, timesMissed, ...rest }) => structuredClone(rest);
      if (row) Object.assign(row, fields(mistake), { timesMissed: row.timesMissed + 1 });
      else tables.mistakes.push({ ...fields(mistake), id: randomUUID(), timesMissed: 1 });
    },
    async deleteMistake(accountId, lessonId, segmentId) {
      tables.mistakes = tables.mistakes.filter((row) => !(row.accountId === accountId && row.lessonId === lessonId && row.segmentId === segmentId));
    },
    async findPlacement(accountId) {
      return copy(tables.placements.find((row) => row.accountId === accountId));
    },
    async createPlacement(placement) {
      if (tables.placements.some((row) => row.accountId === placement.accountId)) return null;
      tables.placements.push({ id: randomUUID(), ...structuredClone(placement) });
      return repository.findPlacement(placement.accountId);
    },
  };
  return repository;
}

const option = (text, isCorrect = false) => ({ id: randomUUID(), text, isCorrect });
const question = (prompt, skill, right, wrong) => ({
  id: randomUUID(),
  skill,
  prompt,
  options: [option(right, true), option(wrong)],
  explanation: `Because: ${right}.`,
});

// Content-service stand-in. A1: unit "Shopping" (lessons Ordering and
// Paying), unit "Travel" (lesson Airport), each with a check of 4 questions,
// and a level test of 4 questions; A2: unit "Work" (lesson Meetings); no
// level test from A2 on. Every lesson uses one recording of four sentences.
export function courseHarness() {
  const segment = (text, start, end, speaker = '') => ({ id: randomUUID(), text, start, end, speaker });
  const segments = [
    segment('Can I help you?', 0, 2, 'Man'),
    segment('Yes, a coffee please.', 2, 4, 'Woman'),
    segment('Small or large?', 4, 6, 'Man'),
    segment('Large, please.', 6, 8, 'Woman'),
  ];
  const exercise = { id: randomUUID(), title: 'At the café', level: 'A2', kind: 'part3', audioUrl: 'https://media.test/cafe.mp3', segments };
  const lesson = (title) => ({
    id: randomUUID(),
    title,
    exerciseId: exercise.id,
    keywords: [{ id: randomUUID(), word: 'large', meaning: 'lớn' }],
    gist: question('Where are they?', 'gist', 'In a café', 'At school'),
    detail: [question('What does she want?', 'detail', 'A coffee', 'A tea'), question('Which size?', 'detail', 'Large', 'Small')],
    closeSegmentIds: [segments[3].id, segments[1].id],
  });
  const sections = () => [
    { id: randomUUID(), exerciseId: exercise.id, questions: [1, 2, 3, 4].map((n) => question(`Check ${n}?`, 'detail', `Right ${n}`, `Wrong ${n}`)) },
  ];
  const papers = [];
  const item = (level, type, title, content) => {
    const paper = {
      item: { id: randomUUID(), level, type, title, description: '', position: papers.length + 1 },
      versionId: randomUUID(),
      versionNumber: 1,
      content,
      exercises: { [exercise.id]: exercise },
    };
    papers.push(paper);
    return paper;
  };
  const paper = item('A1', 'unit', 'Shopping', { lessons: [lesson('Ordering'), lesson('Paying')], check: { sections: sections() } });
  const travel = item('A1', 'unit', 'Travel', { lessons: [lesson('Airport')], check: { sections: sections() } });
  const levelTest = item('A1', 'level_test', 'A1 test', { sections: sections() });
  const work = item('A2', 'unit', 'Work', { lessons: [lesson('Meetings')], check: { sections: sections() } });
  // Published only when a test calls publishPlacement().
  const placementPaper = {
    item: { id: randomUUID(), level: null, type: 'placement', title: 'Listening placement', description: '', position: 0 },
    versionId: randomUUID(),
    versionNumber: 1,
    content: {
      sections: ['A1', 'A2', 'B1', 'B2', 'C1'].map((level) => ({
        id: randomUUID(),
        exerciseId: exercise.id,
        level,
        questions: [1, 2, 3].map((n) => question(`${level} question ${n}?`, 'detail', `${level} right ${n}`, `${level} wrong ${n}`)),
      })),
    },
    exercises: { [exercise.id]: exercise },
  };
  let placementPublished = false;
  const publishPlacement = () => {
    placementPublished = true;
    papers.push(placementPaper);
  };
  const client = {
    async listPublishedCourse() {
      const summary = (entry) => ({
        ...entry.item,
        versionId: entry.versionId,
        lessons: entry.item.type === 'unit' ? entry.content.lessons.map(({ id, title }) => ({ id, title })) : [],
        questionCount: 4,
      });
      return structuredClone({
        placement: placementPublished ? { ...placementPaper.item, versionId: placementPaper.versionId, lessons: [], questionCount: 15 } : null,
        levels: ['A1', 'A2', 'B1', 'B2', 'C1'].map((level) => {
          const own = papers.filter((entry) => entry.item.level === level);
          const test = own.find((entry) => entry.item.type === 'level_test');
          return { level, units: own.filter((entry) => entry.item.type === 'unit').map(summary), levelTest: test ? summary(test) : null };
        }),
      });
    },
    async getCoursePaper(itemId, versionId) {
      const found = papers.find((entry) => entry.item.id === itemId);
      if (!found || (versionId && versionId !== found.versionId)) return null;
      return structuredClone(found);
    },
  };
  const repository = createCourseRepository();
  const service = new CourseLessonService(repository, client, { now: () => new Date('2026-10-14T08:00:00Z') });
  return { service, repository, client, unit: paper.item, paper, travel, levelTest, work, segments, placementPaper, publishPlacement };
}

// Option ids of a test's sections: the first `right` questions answered right,
// the others wrong.
export function testAnswers(paper, right) {
  const sections = paper.item.type === 'unit' ? paper.content.check.sections : paper.content.sections;
  const answers = {};
  sections
    .flatMap((section) => section.questions)
    .forEach((question, index) => {
      answers[question.id] = question.options.find((item) => item.isCorrect === index < right).id;
    });
  return answers;
}

// A detail question completed with the words heard, and a Focus on passage
// (D109), for a test to put on a lesson.
export const completeQuestion = (prompt, answers) => ({
  id: randomUUID(),
  kind: 'complete',
  skill: 'detail',
  prompt,
  options: [],
  answers,
  explanation: 'Listen again.',
});
export const focusOn = () => ({
  title: 'Saying hello',
  passage: "A: How's it ___?\nB: Not too ___, thanks.",
  words: ['bad', 'going', 'well'],
  answers: ['going', 'bad'],
});

// The right answers of a lesson: options by question id, words by blank key,
// sentences by id.
export function rightAnswers(lesson, segments) {
  const answers = {};
  for (const question of [lesson.gist, ...lesson.detail]) {
    if (question.kind === 'complete') question.answers.forEach((word, index) => (answers[`${question.id}:${index}`] = word));
    else answers[question.id] = question.options.find((item) => item.isCorrect).id;
  }
  if (lesson.focus?.passage) lesson.focus.answers.forEach((word, index) => (answers[`focus:${index}`] = word));
  for (const id of lesson.closeSegmentIds) answers[id] = segments.find((segment) => segment.id === id).text;
  return answers;
}
