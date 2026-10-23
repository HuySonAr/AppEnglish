import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import { GOAL_MIN_ANSWERED } from '@appenglish/learning-contracts';

const rate = (correct, shown) => (shown ? Math.round((correct * 100) / shown) : null);

export function partRates(attempts, papers) {
  const tally = new Map(LESSON_TEST_PARTS.map((spec) => [spec.key, { shown: 0, correct: 0 }]));
  for (const attempt of attempts) {
    const paper = papers.get(attempt.mockVersionId);
    if (!paper) continue;
    const keys = attempt.partKey ? [attempt.partKey] : LESSON_TEST_PARTS.map((spec) => spec.key);
    for (const key of keys)
      for (const question of paper.test[key]?.questions || []) {
        const entry = tally.get(key);
        entry.shown++;
        if (question.options.find((option) => option.id === attempt.answers?.[question.id])?.isCorrect) entry.correct++;
      }
  }
  return LESSON_TEST_PARTS.map((spec) => {
    const { shown, correct } = tally.get(spec.key);
    return { key: spec.key, number: spec.number, skill: spec.skill, shown, rate: rate(correct, shown) };
  });
}

export function weakestPart(parts) {
  return [...parts].filter((part) => part.shown >= GOAL_MIN_ANSWERED && part.rate < 100).sort((a, b) => a.rate - b.rate || a.number - b.number)[0] || null;
}

export function goalView(goal) {
  return goal ? { targetScore: goal.targetScore, examDate: goal.examDate ? String(goal.examDate).slice(0, 10) : null } : null;
}
