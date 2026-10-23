import { LESSON_TEST_PARTS, MOCK_GROUP_AUDIO_PARTS, MOCK_SET_QUESTION_COUNT, MOCK_TEST_PART_COUNTS, Skill } from '@appenglish/content-contracts';
import { MockAttemptKind, MockQuestionFlag } from '@appenglish/learning-contracts';

const letters = 'ABCD';
const rate = (correct, shown) => (shown ? Math.round((correct * 100) / shown) : null);
const average = (values) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

export const MOCK_FIRST_NUMBERS = (() => {
  let next = 1;
  return Object.fromEntries(
    LESSON_TEST_PARTS.map((spec) => {
      const first = next;
      next += MOCK_TEST_PART_COUNTS[spec.key];
      return [spec.key, first];
    }),
  );
})();

export function numberOf(key, part, question, index) {
  const first = MOCK_FIRST_NUMBERS[key];
  const set = (part.groups || []).findIndex((group) => group.id === question.groupId);
  if (!MOCK_GROUP_AUDIO_PARTS.includes(key) || set === -1) return first + index;
  const place = part.questions.filter((item) => item.groupId === question.groupId).indexOf(question);
  return first + set * MOCK_SET_QUESTION_COUNT + place;
}

function flagOf(tally, options, enough) {
  if (!enough) return null;
  const share = rate(tally.correct, tally.shown);
  const right = options.find((option) => option.isCorrect);
  const topWrong = options.filter((option) => !option.isCorrect).sort((a, b) => b.chosen - a.chosen)[0];
  if (share < 50 && right && topWrong && topWrong.chosen > right.chosen) return MockQuestionFlag.CHECK_KEY;
  if (share < 30) return MockQuestionFlag.HARD;
  if (share >= 95) return MockQuestionFlag.EASY;
  return null;
}

export function mockStats({ paper, papers, attempts, minLearners }) {
  const finished = attempts.filter((attempt) => attempt.status === 'COMPLETED');
  const full = finished.filter((attempt) => attempt.kind === MockAttemptKind.FULL);
  const learners = new Set(finished.map((attempt) => attempt.accountId)).size;
  const base = {
    learners,
    fullAttempts: full.length,
    miniAttempts: finished.length - full.length,
    minLearners,
    enoughLearners: learners >= minLearners,
    published: Boolean(paper),
    versionNumber: paper?.versionNumber ?? null,
  };
  if (!base.enoughLearners || !paper) return { ...base, averageScore: null, parts: [], questions: [] };

  const tallies = new Map();
  const tallyOf = (id) => {
    if (!tallies.has(id)) tallies.set(id, { shown: 0, answered: 0, correct: 0, chosen: new Map() });
    return tallies.get(id);
  };
  for (const attempt of finished) {
    const own = papers.get(attempt.mockVersionId);
    if (!own) continue;
    const keys = attempt.partKey ? [attempt.partKey] : LESSON_TEST_PARTS.map((spec) => spec.key);
    for (const key of keys)
      for (const question of own.test[key]?.questions || []) {
        const tally = tallyOf(question.id);
        tally.shown++;
        const chosen = attempt.answers?.[question.id];
        if (!chosen) continue;
        tally.answered++;
        tally.chosen.set(chosen, (tally.chosen.get(chosen) || 0) + 1);
        if (question.options.find((option) => option.id === chosen)?.isCorrect) tally.correct++;
      }
  }

  const scored = full.filter((attempt) => attempt.listeningScore !== null && attempt.listeningScore !== undefined);
  const questions = [];
  const parts = LESSON_TEST_PARTS.map((spec) => {
    const part = paper.test[spec.key] || { questions: [], groups: [] };
    let shown = 0;
    let correct = 0;
    part.questions.forEach((question, index) => {
      const tally = tallies.get(question.id) || { shown: 0, answered: 0, correct: 0, chosen: new Map() };
      shown += tally.shown;
      correct += tally.correct;
      const options = question.options.map((option, at) => ({ id: option.id, letter: letters[at], text: option.text || '', isCorrect: Boolean(option.isCorrect), chosen: tally.chosen.get(option.id) || 0 }));
      questions.push({
        id: question.id,
        partKey: spec.key,
        number: numberOf(spec.key, part, question, index),
        prompt: (question.prompt || '').slice(0, 200),
        shown: tally.shown,
        answered: tally.answered,
        skipped: tally.shown - tally.answered,
        correct: tally.correct,
        rate: rate(tally.correct, tally.shown),
        options,
        flag: flagOf(tally, options, tally.shown >= minLearners),
      });
    });
    return { key: spec.key, number: spec.number, skill: spec.skill, questionCount: part.questions.length, shown, correct, rate: rate(correct, shown) };
  });

  return {
    ...base,
    averageScore: scored.length
      ? {
          total: average(scored.map((attempt) => attempt.listeningScore + attempt.readingScore)),
          listening: average(scored.map((attempt) => attempt.listeningScore)),
          reading: average(scored.map((attempt) => attempt.readingScore)),
        }
      : null,
    skills: [Skill.LISTENING, Skill.READING].map((skill) => {
      const own = parts.filter((part) => part.skill === skill);
      const shown = own.reduce((sum, part) => sum + part.shown, 0);
      return { skill, rate: rate(own.reduce((sum, part) => sum + part.correct, 0), shown) };
    }),
    parts,
    questions,
  };
}
