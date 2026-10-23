export const QuizLight = Object.freeze({ UNCHECKED: 'unchecked', RIGHT: 'right', WRONG: 'wrong' });

export function checkedLights(questions, wrongIds) {
  return Object.fromEntries(
    questions.map((question) => [question.id, wrongIds.includes(question.id) ? QuizLight.WRONG : QuizLight.RIGHT]),
  );
}

export function withAnswerChanged(lights, questionId) {
  if (!lights[questionId]) return lights;
  const { [questionId]: _changed, ...rest } = lights;
  return rest;
}

export function lightOf(lights, questionId) {
  return lights[questionId] || QuizLight.UNCHECKED;
}
