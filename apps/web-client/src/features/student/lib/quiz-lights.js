// The light of each word in a vocabulary quiz (D83): unchecked until the
// answers are checked, then right or wrong; changing an answer turns its light
// back to unchecked until the next check.
export const QuizLight = Object.freeze({ UNCHECKED: 'unchecked', RIGHT: 'right', WRONG: 'wrong' });

// The lights after a check: every word is right except the wrong ones.
export function checkedLights(questions, wrongIds) {
  return Object.fromEntries(
    questions.map((question) => [question.id, wrongIds.includes(question.id) ? QuizLight.WRONG : QuizLight.RIGHT]),
  );
}

// The lights once the answer of one word changed.
export function withAnswerChanged(lights, questionId) {
  if (!lights[questionId]) return lights;
  const { [questionId]: _changed, ...rest } = lights;
  return rest;
}

export function lightOf(lights, questionId) {
  return lights[questionId] || QuizLight.UNCHECKED;
}
