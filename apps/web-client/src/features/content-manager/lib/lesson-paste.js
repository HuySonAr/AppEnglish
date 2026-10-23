import {
  PASSAGE_MAX_LENGTH,
  parsePastedPassages,
  parsePastedQuestions,
  pastedQuestionProblems,
  withPastedText,
} from './question-paste.js';

export const LESSON_PASTE_PARTS = Object.freeze(['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7']);
const TRANSCRIPT_MAX_LENGTH = 10000;

const letters = 'ABCD';
const answerOf = (question) => (question.correct === null ? '?' : letters[question.correct]);
const rangeOf = (spec) => {
  const last = spec.firstQuestionNumber + spec.questionCount - 1;
  return last > spec.firstQuestionNumber ? `questions ${spec.firstQuestionNumber}–${last}` : `question ${spec.firstQuestionNumber}`;
};
const tooMany = (spec) => `Part ${spec.number} of this test has only ${rangeOf(spec)}`;

export function lessonPasteDescription(spec) {
  const numbers = `The numbers of the book can stay: the questions fill ${rangeOf(spec)} in the order they are pasted, or by their number when they already carry these numbers.`;
  if (!spec.option.text)
    return `Paste what the recording says, as a question with its options and answer${spec.question.image ? ' (a photograph has no question line, only the options)' : ''}. It becomes the transcript of the part and sets the correct answers; learners still see only the letters. ${numbers} The recording, photographs and explanations are still added in the editor.`;
  if (!spec.group.passage) return `${numbers} Recordings, transcripts and explanations are still added in the editor.`;
  return spec.group.blanks
    ? `Paste the passage with its questions. The numbered blanks of the passage become the blanks of the editor, and a first line that only names the document (Letter, E-mail…) is left out. ${numbers}`
    : `Paste the document with its questions. Rows copied from a table are written | cell | cell | and drawn as a table for learners. ${numbers}`;
}

function withQuestionsAt(part, places) {
  return {
    ...part,
    questions: part.questions.map((question, index) => (places.has(index) ? withPastedText(question, places.get(index)) : question)),
  };
}

function transcriptOf(spec, places) {
  return [...places.keys()]
    .sort((a, b) => a - b)
    .map((place) => {
      const item = places.get(place);
      const options = item.options.map((option, index) => `(${letters[index]}) ${option}`).filter((_, index) => item.options[index]);
      return [`${spec.firstQuestionNumber + place}.${item.prompt ? ` ${item.prompt}` : ''}`, ...options].join('\n');
    })
    .join('\n\n');
}

function withSpokenQuestions(part, spec, places) {
  return {
    ...part,
    transcript: transcriptOf(spec, places),
    questions: part.questions.map((question, index) =>
      places.has(index)
        ? { ...question, options: question.options.map((option, letter) => ({ ...option, isCorrect: letter === places.get(index).correct })) }
        : question,
    ),
  };
}

function questionsPlan(part, spec, pasted) {
  const spoken = !spec.option.text;
  const first = spec.firstQuestionNumber;
  const byNumber = pasted.every((item) => item.number >= first && item.number < first + spec.questionCount);
  const places = new Map();
  const lines = pasted.map((item, index) => {
    const place = byNumber ? item.number - first : index;
    const { errors, warnings } = pastedQuestionProblems(item, spec);
    if (spoken && !spec.question.image && !item.prompt) warnings.push('no question line');
    if (item.options.length > spec.optionCount) errors.push(`Part ${spec.number} has options ${letters[0]}–${letters[spec.optionCount - 1]} only`);
    if (place >= spec.questionCount) errors.unshift(tooMany(spec));
    else if (places.has(place)) errors.push('this number appears twice');
    else places.set(place, item);
    const existing = part.questions[place];
    const replaces = spoken ? part.transcript && index === 0 : existing && (existing.prompt || existing.options.some((option) => option.text));
    return {
      title: `Question ${item.number}`,
      note: ` · fills question ${first + place}${replaces ? (spoken ? ' · replaces the transcript' : ' · replaces what is there') : ''}${item.correct === null ? '' : ` · answer ${answerOf(item)}`}`,
      text: spoken ? item.prompt || item.options.filter(Boolean).join(' / ') : item.prompt,
      errors,
      warnings,
    };
  });
  if (spoken && lines.length) {
    if (transcriptOf(spec, places).length > TRANSCRIPT_MAX_LENGTH) lines[0].errors.push(`transcript longer than ${TRANSCRIPT_MAX_LENGTH} characters`);
    if (places.size < spec.questionCount)
      lines[0].warnings.push(`the transcript will hold ${places.size} of the ${spec.questionCount} questions of the part`);
  }
  const usable = lines.every((line) => !line.errors.length);
  const filled = spoken ? withSpokenQuestions(part, spec, places) : withQuestionsAt(part, places);
  return { part: usable ? filled : part, count: pasted.length, lines };
}

function passagePlan(part, spec, passages) {
  const first = spec.firstQuestionNumber;
  const lines = passages.map((item, index) => {
    const numbers = item.questions.map((question) => question.number);
    const errors = [];
    const warnings = [];
    if (index) errors.push(`Part ${spec.number} of this test has one passage`);
    if (!item.passage) errors.push('no passage text');
    else if (item.passage.length > PASSAGE_MAX_LENGTH) errors.push(`passage longer than ${PASSAGE_MAX_LENGTH} characters`);
    else if (spec.group.blanks && !item.blanks.length) errors.push(`no blank such as [${item.from}] in the passage`);
    else if (spec.group.blanks && item.blanks.join() !== numbers.join())
      errors.push(`the blanks in the passage are ${item.blanks.join(', ')}, the questions ${numbers.join(', ') || 'none'}`);
    if (!numbers.length) errors.push('no question found');
    if (numbers.length > spec.questionCount) errors.push(tooMany(spec));
    for (const question of item.questions) {
      const problems = pastedQuestionProblems(question, spec);
      errors.push(...problems.errors.map((problem) => `question ${question.number}: ${problem}`));
      warnings.push(...problems.warnings.map((problem) => `question ${question.number}: ${problem}`));
    }
    if (numbers.length && numbers.length < spec.questionCount) warnings.push(`${numbers.length} of ${spec.questionCount} questions`);
    return {
      title: 'Passage',
      note: ` · fills question${numbers.length === 1 ? '' : 's'} ${first}${numbers.length > 1 ? `–${first + numbers.length - 1}` : ''}${part.passage ? ' · replaces what is there' : ''} · answers ${item.questions.map(answerOf).join(' ')}`,
      text: item.passage,
      errors,
      warnings,
    };
  });
  const [passage] = passages;
  const usable = passage && lines.every((line) => !line.errors.length);
  return {
    part: usable ? { ...withQuestionsAt(part, new Map(passage.questions.map((question, index) => [index, question]))), passage: passage.passage } : part,
    count: passages.reduce((sum, item) => sum + item.questions.length, 0),
    lines,
  };
}

export function lessonPastePlan(part, spec, setName, text) {
  return spec.group.passage
    ? passagePlan(part, spec, parsePastedPassages(text, { blanks: Boolean(spec.group.blanks) }))
    : questionsPlan(part, spec, parsePastedQuestions(text));
}
