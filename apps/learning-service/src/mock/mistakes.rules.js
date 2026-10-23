import { LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import { MOCK_MISTAKE_CLEAR_STREAK } from '@appenglish/learning-contracts';

export function mistakesOf(attempts, papers, reviews) {
  const events = [];
  for (const attempt of attempts) {
    const paper = papers.get(attempt.mockVersionId);
    if (!paper) continue;
    const keys = attempt.partKey ? [attempt.partKey] : LESSON_TEST_PARTS.map((spec) => spec.key);
    for (const partKey of keys)
      for (const question of paper.test[partKey]?.questions || []) {
        const chosen = attempt.answers?.[question.id];
        events.push({
          questionId: question.id,
          partKey,
          mockTestId: attempt.mockTestId,
          versionId: attempt.mockVersionId,
          correct: Boolean(question.options.find((option) => option.id === chosen)?.isCorrect),
          at: new Date(attempt.submittedAt).getTime(),
        });
      }
  }
  for (const review of reviews)
    events.push({ questionId: review.questionId, partKey: review.partKey, mockTestId: review.mockTestId, versionId: review.mockVersionId, correct: review.correct, at: new Date(review.answeredAt).getTime(), review: true });
  events.sort((a, b) => a.at - b.at);

  const open = new Map();
  for (const event of events) {
    const current = open.get(event.questionId);
    if (!event.correct) {
      open.set(event.questionId, {
        questionId: event.questionId,
        partKey: event.partKey,
        mockTestId: event.mockTestId,
        versionId: event.review ? current?.versionId || event.versionId : event.versionId,
        wrongCount: (current?.wrongCount || 0) + 1,
        streak: 0,
        lastWrongAt: new Date(event.at).toISOString(),
      });
    } else if (current) {
      const streak = current.streak + 1;
      if (streak >= MOCK_MISTAKE_CLEAR_STREAK) open.delete(event.questionId);
      else open.set(event.questionId, { ...current, streak, versionId: event.review ? current.versionId : event.versionId });
    }
  }
  return [...open.values()].sort((a, b) => a.lastWrongAt.localeCompare(b.lastWrongAt));
}

export function mistakeSummary(mistakes) {
  return LESSON_TEST_PARTS.map((spec) => ({ key: spec.key, number: spec.number, title: spec.title, skill: spec.skill, count: mistakes.filter((item) => item.partKey === spec.key).length }));
}
