
export function practiceInstruction(question) {
  return question.direction === 'WORD' ? 'Choose the word for this meaning' : 'Choose the meaning of this word';
}

export function practiceScore(questions, answers) {
  const answered = questions.filter((question) => question.id in answers);
  const wrong = answered.filter((question) => answers[question.id] !== question.answer);
  return { answered: answered.length, correct: answered.length - wrong.length, wrong };
}
