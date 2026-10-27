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

const day = (value) => (value ? String(value instanceof Date ? value.toISOString() : value).slice(0, 10) : null);

export function goalView(goal) {
  if (!goal) return null;
  const lr = goal.lrEnabled !== false && goal.targetScore ? { targetScore: goal.targetScore, examDate: day(goal.examDate) } : null;
  const sw = goal.swEnabled ? { speakingTarget: goal.speakingTarget ?? null, writingTarget: goal.writingTarget ?? null, examDate: day(goal.swExamDate) } : null;
  return lr || sw ? { lr, sw } : null;
}

export function swActivity(attempts, practice) {
  const latest = (rows) => rows.reduce((best, row) => (!best || new Date(row) > new Date(best) ? row : best), null);
  const submitted = (section) => latest(attempts.filter((attempt) => attempt.section === section && attempt.status === 'SUBMITTED' && attempt.submittedAt).map((attempt) => new Date(attempt.submittedAt).toISOString()));
  const practiced = {};
  for (const submission of practice) {
    const task = submission.prompt?.etsTask || (submission.kind === 'read_aloud' ? 'read_aloud' : null);
    if (!task) continue;
    const at = new Date(submission.submittedAt).toISOString();
    if (!practiced[task] || at > practiced[task]) practiced[task] = at;
  }
  return { lastTest: { speaking: submitted('speaking'), writing: submitted('writing') }, practiced };
}

export function swEstimate(attempts) {
  const latest = (section) => {
    const scored = attempts
      .filter((attempt) => attempt.section === section && attempt.status === 'SUBMITTED' && (attempt.teacherReview?.final || attempt.scoring?.final))
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
      .at(-1);
    if (!scored) return null;
    const final = scored.teacherReview?.final || scored.scoring.final;
    return { scaled: final.scaled, at: new Date(scored.submittedAt).toISOString(), reviewed: Boolean(scored.teacherReview?.final), swTestId: scored.testId, attemptNumber: scored.attemptNumber };
  };
  const speaking = latest('speaking');
  const writing = latest('writing');
  return speaking || writing ? { speaking, writing } : null;
}

