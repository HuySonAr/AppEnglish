import { LESSON_TEST_PARTS, UNIT_REVIEW_PART_COUNTS, UNIT_REVIEW_PASSAGE_COUNT, UNIT_REVIEW_PASSAGE_QUESTIONS } from './index.js';

const letters = ['A', 'B', 'C', 'D'];
const uuid = () => globalThis.crypto.randomUUID();

const option = (text, isCorrect) => ({ text, audioMediaId: null, transcript: '', isCorrect });
const question = ({ prompt = '', options = [], answer = '', explanation = '' }) => ({
  prompt,
  audioMediaId: null,
  transcript: '',
  imageMediaId: null,
  groupId: null,
  options: options.map((text, index) => option(text, letters[index] === answer)),
  explanation,
});
const part = (fields) => ({ audioMediaId: null, transcript: '', passage: '', imageMediaId: null, questions: [], ...fields });
const lettered = (options) => options.map((text, index) => `(${letters[index]}) ${text}`);
const list = (value) => (Array.isArray(value) ? value : []);

export const part1Transcript = (options) => ['Number 1. Look at the picture marked Number 1.', ...lettered(options)].join('\n');
export const part2Transcript = (items) =>
  items.map((item, index) => [`Number ${2 + index}. ${item.question || ''}`.trimEnd(), ...lettered(item.options || [])].join('\n')).join('\n\n');
const PART3_LEAD = 'Questions 4 through 6 refer to the following conversation.';
const PART4_LEAD = 'Questions 7 through 9 refer to the following talk.';

export function lessonFromAuthoring(lesson) {
  const test = lesson.test || {};
  const p1 = test.part1 || {};
  const p2 = list(test.part2);
  const part1 = part({
    transcript: p1.transcript || part1Transcript(list(p1.options)),
    questions: [question({ options: list(p1.options).map(() => ''), answer: p1.answer, explanation: p1.explanation })],
  });
  const part2 = part({
    transcript: test.part2Transcript || part2Transcript(p2),
    questions: p2.map((item) => question({ options: list(item.options).map(() => ''), answer: item.answer, explanation: item.explanation })),
  });
  const p3 = test.part3 || {};
  const p4 = test.part4 || {};
  const part3 = part({ transcript: p3.transcript ? `${PART3_LEAD}\n\n${p3.transcript}` : '', questions: list(p3.questions).map(question) });
  const part4 = part({ transcript: p4.transcript ? `${PART4_LEAD}\n\n${p4.transcript}` : '', questions: list(p4.questions).map(question) });
  const part5 = part({ questions: list(test.part5).map(question) });
  const p6 = test.part6 || {};
  const p7 = test.part7 || {};
  const part6 = part({ passage: p6.passage || '', questions: list(p6.questions).map((item) => question({ ...item, prompt: '' })) });
  const part7 = part({ passage: p7.passage || '', questions: list(p7.questions).map(question) });
  return {
    vocabulary: list(lesson.vocabulary).map((item) => ({
      word: item.word || '',
      partOfSpeech: item.partOfSpeech || '',
      phonetic: item.phonetic || '',
      audioUkMediaId: null,
      audioUsMediaId: null,
      meaning: item.meaning || '',
      example: item.example || '',
      exampleMeaning: item.exampleMeaning || '',
    })),
    fillIn: { passage: lesson.fillIn?.passage || '', answers: list(lesson.fillIn?.answers) },
    test: { part1, part2, part3, part4, part5, part6, part7 },
  };
}

export function reviewFromAuthoring(review) {
  const passages = list(review.part6);
  const groups = passages.map((passage) => ({ id: uuid(), audioMediaId: null, transcript: '', passage: passage.passage || '', imageMediaId: null }));
  return {
    test: {
      part5: part({ groups: [], questions: list(review.part5).map(question) }),
      part6: part({
        groups,
        questions: passages.flatMap((passage, index) => list(passage.questions).map((item) => ({ ...question({ ...item, prompt: '' }), groupId: groups[index].id }))),
      }),
    },
  };
}

const answerOf = (item) => letters[(item.options || []).findIndex((opt) => opt.isCorrect)] || '';
const authoredQuestion = (item, { prompt = true } = {}) => ({
  ...(prompt ? { prompt: item.prompt || '' } : {}),
  options: (item.options || []).map((opt) => opt.text || ''),
  answer: answerOf(item),
  explanation: item.explanation || '',
});
const spokenOptions = (block) => block.split('\n').map((line) => /^\(([A-D])\)\s*(.*)$/.exec(line.trim())).filter(Boolean).map((match) => match[2]);
const stripLead = (transcript, lead) => (transcript.startsWith(lead) ? transcript.slice(lead.length).replace(/^\s+/, '') : transcript);

export function authoringFromLesson(content) {
  const test = content.test || {};
  const p1 = test.part1 || { questions: [] };
  const p1Options = spokenOptions(p1.transcript || '');
  const p1Question = p1.questions?.[0] || {};
  const part1 = { options: p1Options.length === 4 ? p1Options : ['', '', '', ''], answer: answerOf(p1Question), explanation: p1Question.explanation || '' };
  if (p1.transcript && p1.transcript !== part1Transcript(part1.options)) part1.transcript = p1.transcript;
  const p2 = test.part2 || { questions: [] };
  const blocks = (p2.transcript || '').split(/\n\s*\n/);
  const part2 = (p2.questions || []).map((item, index) => {
    const block = blocks[index] || '';
    const options = spokenOptions(block);
    return {
      question: (/^Number \d+\.\s*(.*)$/m.exec(block)?.[1] || '').trim(),
      options: options.length === 3 ? options : ['', '', ''],
      answer: answerOf(item),
      explanation: item.explanation || '',
    };
  });
  const result = {
    vocabulary: (content.vocabulary || []).map((item) => ({
      word: item.word || '',
      partOfSpeech: item.partOfSpeech || '',
      ...(item.phonetic ? { phonetic: item.phonetic } : {}),
      meaning: item.meaning || '',
      example: item.example || '',
      exampleMeaning: item.exampleMeaning || '',
    })),
    fillIn: { passage: content.fillIn?.passage || '', answers: content.fillIn?.answers || [] },
    test: {
      part1,
      part2,
      part3: { transcript: stripLead(test.part3?.transcript || '', PART3_LEAD), questions: (test.part3?.questions || []).map((item) => authoredQuestion(item)) },
      part4: { transcript: stripLead(test.part4?.transcript || '', PART4_LEAD), questions: (test.part4?.questions || []).map((item) => authoredQuestion(item)) },
      part5: (test.part5?.questions || []).map((item) => authoredQuestion(item)),
      part6: { passage: test.part6?.passage || '', questions: (test.part6?.questions || []).map((item) => authoredQuestion(item, { prompt: false })) },
      part7: { passage: test.part7?.passage || '', questions: (test.part7?.questions || []).map((item) => authoredQuestion(item)) },
    },
  };
  if (p2.transcript && p2.transcript !== part2Transcript(part2)) result.test.part2Transcript = p2.transcript;
  return result;
}

export function authoringFromReview(content) {
  const test = content.test || {};
  const part6 = test.part6 || { groups: [], questions: [] };
  return {
    part5: (test.part5?.questions || []).map((item) => authoredQuestion(item)),
    part6: (part6.groups || []).map((group) => ({
      passage: group.passage || '',
      questions: (part6.questions || []).filter((item) => item.groupId === group.id).map((item) => authoredQuestion(item, { prompt: false })),
    })),
  };
}

const counts = Object.fromEntries(LESSON_TEST_PARTS.map((spec) => [spec.key, spec]));

function checkQuestions(items, spec, label, errors, warnings, { prompt = true } = {}) {
  if (items.length !== spec.questionCount) errors.push(`${label}: ${items.length} question${items.length === 1 ? '' : 's'}, ${spec.questionCount} expected`);
  items.forEach((item, index) => {
    const at = `${label} question ${index + 1}`;
    const options = list(item.options);
    if (options.length !== spec.optionCount) errors.push(`${at}: ${options.length} options, ${spec.optionCount} expected`);
    if (!letters.slice(0, spec.optionCount).includes(item.answer)) errors.push(`${at}: answer must be one of ${letters.slice(0, spec.optionCount).join(', ')}`);
    if (prompt && spec.question.prompt && !(item.prompt || '').trim()) errors.push(`${at}: no question text`);
    if (spec.option.text && options.some((text) => !(text || '').trim())) warnings.push(`${at}: an option is empty`);
    if (!(item.explanation || '').trim()) warnings.push(`${at}: no explanation`);
  });
}

const blanksIn = (text) => (text || '').split('___').length - 1;

export function lessonAuthoringProblems(lesson) {
  const errors = [];
  const warnings = [];
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) return { errors: ['The file is not a lesson object'], warnings, summary: [] };
  const vocabulary = list(lesson.vocabulary);
  if (!vocabulary.length) errors.push('No vocabulary');
  vocabulary.forEach((item, index) => {
    if (!(item.word || '').trim()) errors.push(`Word ${index + 1}: no word`);
    if (!(item.meaning || '').trim()) warnings.push(`Word ${index + 1} "${item.word}": no meaning`);
  });
  const blanks = blanksIn(lesson.fillIn?.passage);
  const answers = list(lesson.fillIn?.answers);
  if (!lesson.fillIn?.passage) warnings.push('Fill-in: no passage');
  else if (blanks !== answers.length) errors.push(`Fill-in: ${blanks} blanks but ${answers.length} answers`);
  const test = lesson.test || {};
  if (!test.part1) errors.push('Part 1 is missing');
  else {
    const options = list(test.part1.options);
    if (options.length !== 4 && !test.part1.transcript) errors.push(`Part 1: ${options.length} options, 4 expected`);
    if (!letters.includes(test.part1.answer)) errors.push('Part 1: answer must be one of A, B, C, D');
  }
  const part2 = list(test.part2);
  if (part2.length !== 2) errors.push(`Part 2: ${part2.length} questions, 2 expected`);
  part2.forEach((item, index) => {
    if (list(item.options).length !== 3 && !test.part2Transcript) errors.push(`Part 2 question ${index + 1}: 3 options expected`);
    if (!letters.slice(0, 3).includes(item.answer)) errors.push(`Part 2 question ${index + 1}: answer must be one of A, B, C`);
  });
  checkQuestions(list(test.part3?.questions), counts.part3, 'Part 3', errors, warnings);
  checkQuestions(list(test.part4?.questions), counts.part4, 'Part 4', errors, warnings);
  if (!(test.part3?.transcript || '').trim()) warnings.push('Part 3: no transcript (add it in the editor)');
  if (!(test.part4?.transcript || '').trim()) warnings.push('Part 4: no transcript (add it in the editor)');
  checkQuestions(list(test.part5), counts.part5, 'Part 5', errors, warnings);
  checkQuestions(list(test.part6?.questions), counts.part6, 'Part 6', errors, warnings, { prompt: false });
  if (blanksIn(test.part6?.passage) !== 3) errors.push(`Part 6: the passage has ${blanksIn(test.part6?.passage)} blanks (___), 3 expected`);
  checkQuestions(list(test.part7?.questions), counts.part7, 'Part 7', errors, warnings);
  if (!(test.part7?.passage || '').trim()) errors.push('Part 7: no passage');
  const summary = [
    `${vocabulary.length} word${vocabulary.length === 1 ? '' : 's'}`,
    `fill-in with ${blanks} blank${blanks === 1 ? '' : 's'}`,
    `test with ${1 + part2.length + ['part3', 'part4', 'part6', 'part7'].reduce((sum, key) => sum + list(test[key]?.questions).length, 0) + list(test.part5).length} questions`,
  ];
  return { errors, warnings, summary };
}

export function reviewAuthoringProblems(review) {
  const errors = [];
  const warnings = [];
  if (!review || typeof review !== 'object' || Array.isArray(review)) return { errors: ['The file is not a unit review object'], warnings, summary: [] };
  const part5 = list(review.part5);
  const spec5 = { ...counts.part5, questionCount: UNIT_REVIEW_PART_COUNTS.part5 };
  checkQuestions(part5, spec5, 'Part 5', errors, warnings);
  const passages = list(review.part6);
  if (passages.length !== UNIT_REVIEW_PASSAGE_COUNT) errors.push(`Part 6: ${passages.length} passages, ${UNIT_REVIEW_PASSAGE_COUNT} expected`);
  passages.forEach((passage, index) => {
    const label = `Part 6 passage ${index + 1}`;
    if (blanksIn(passage.passage) !== UNIT_REVIEW_PASSAGE_QUESTIONS)
      errors.push(`${label}: ${blanksIn(passage.passage)} blanks (___), ${UNIT_REVIEW_PASSAGE_QUESTIONS} expected`);
    checkQuestions(list(passage.questions), { ...counts.part6, questionCount: UNIT_REVIEW_PASSAGE_QUESTIONS }, label, errors, warnings, { prompt: false });
  });
  const total = part5.length + passages.reduce((sum, passage) => sum + list(passage.questions).length, 0);
  return { errors, warnings, summary: [`${total} questions: ${part5.length} in Part 5, ${passages.length} passages in Part 6`] };
}
