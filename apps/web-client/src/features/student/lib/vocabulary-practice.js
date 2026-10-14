// A vocabulary practice in the browser (D84): the questions come with their
// answers, so each answer is checked as soon as it is chosen.

// The instruction above a question: what the prompt is and what to choose.
export function practiceInstruction(question) {
  return question.direction === 'WORD' ? 'Choose the word for this meaning' : 'Choose the meaning of this word';
}

// The result so far: the number answered and right, and the questions
// answered wrong, in the order they were asked. answers maps question id to
// the option chosen.
export function practiceScore(questions, answers) {
  const answered = questions.filter((question) => question.id in answers);
  const wrong = answered.filter((question) => answers[question.id] !== question.answer);
  return { answered: answered.length, correct: answered.length - wrong.length, wrong };
}
