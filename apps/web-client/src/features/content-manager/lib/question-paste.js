import { FILL_IN_BLANK } from '@appenglish/content-contracts';
import { tableRowFromTabs } from '../../../lib/passage.js';

// Reads questions pasted as text, in the layout of test books:
//   Question 38
//   What industry do the speakers most likely work in?
//   (A) Shipping
//   (B) Manufacturing
//   (C) Hospitality
//   (D) Meteorology
//   Correct Answer: A
// "38." also starts a question, options may be written "A." or "A)", and the
// answer line may be "Answer: A" or "Đáp án: A".
const QUESTION = /^(?:question\s+(\d+)\s*[.:]?|(\d+)\s*[.)])\s*(.*)$/i;
const OPTION = /^\(?([A-D])[).]\s*(.*)$/;
const ANSWER = /^(?:correct\s+answer|answer|đáp án)\s*:?\s*\(?([A-D])\)?\.?$/i;
const letters = 'ABCD';

const joined = (before, more) => (before ? `${before} ${more}` : more);

// The questions found in the text, in order: { number, prompt, options,
// correct }. options holds the texts by letter ('' for a letter left out);
// correct is the index of the right option, null when no answer line was
// given. Lines before the first question and after an answer line (headings
// such as "Questions 38-40 refer to…") are left out.
export function parsePastedQuestions(text) {
  const questions = [];
  let current = null;
  // What a line without a marker continues: 'prompt', an option index, or
  // null once the answer was read.
  let open = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const header = QUESTION.exec(line);
    if (header) {
      current = { number: Number(header[1] ?? header[2]), prompt: header[3], options: [], correct: null };
      questions.push(current);
      open = 'prompt';
      continue;
    }
    if (!current) continue;
    const answer = ANSWER.exec(line);
    const option = OPTION.exec(line);
    if (answer) {
      current.correct = letters.indexOf(answer[1].toUpperCase());
      open = null;
    } else if (option) {
      open = letters.indexOf(option[1]);
      current.options[open] = option[2];
    } else if (open === 'prompt') {
      current.prompt = joined(current.prompt, line);
    } else if (open !== null) {
      current.options[open] = joined(current.options[open], line);
    }
  }
  return questions.map((question) => ({ ...question, options: Array.from(question.options, (option) => option ?? '') }));
}

// "Passage 1 – Questions 131–134" or "Questions 131-134 refer to the
// following e-mail." starts a passage of Part 6 or 7.
const PASSAGE = /^(?:passage\s+\d+\s*[-–—:]?\s*)?questions\s+(\d+)\s*(?:[-–—]|to|through)\s*(\d+)\b/i;
// A first line that only names the document: "Letter", "E-mail", "Press release".
const DOCUMENT_NAME = /^[a-z]+(?:[ -][a-z]+){0,2}$/i;
// A numbered blank: "[131]", "---131---", "-------(131)" or "(131) -------".
const BLANK = /\[(\d+)\]|-{2,}\s*\(?(\d+)\)?\s*-*|\((\d+)\)\s*-{2,}/g;

// The passages found in the text, in order: { from, to, passage, blanks,
// questions }. from and to are the question numbers of the heading. passage
// is the text up to the first of those questions, its line breaks kept, the
// line naming the document left out and every numbered blank replaced by the
// blank mark; blanks are the numbers those blanks had. questions are read as
// by parsePastedQuestions. Text before the first heading is left out.
// With blanks false (Part 7) the passage is kept whole: the line naming the
// document stays, bracketed numbers stay, and lines copied from a table
// become table rows.
export function parsePastedPassages(text, { blanks: withBlanks = true } = {}) {
  const passages = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = PASSAGE.exec(line);
    if (heading) {
      current = { from: Number(heading[1]), to: Number(heading[2]), lines: [], questionLines: [] };
      passages.push(current);
      continue;
    }
    if (!current) continue;
    const question = QUESTION.exec(line);
    const number = question ? Number(question[1] ?? question[2]) : null;
    const inQuestions = current.questionLines.length || (question && number >= current.from && number <= current.to);
    if (inQuestions) current.questionLines.push(line);
    else current.lines.push(withBlanks ? line : tableRowFromTabs(raw));
  }
  return passages.map(({ from, to, lines, questionLines }) => {
    const questions = parsePastedQuestions(questionLines.join('\n'));
    if (!withBlanks) return { from, to, passage: lines.join('\n').trim(), blanks: [], questions };
    const written = lines.join('\n').trim().split('\n');
    const blanks = [];
    const passage = written
      .slice(DOCUMENT_NAME.test(written[0]) ? 1 : 0)
      .join('\n')
      .trim()
      .replace(BLANK, (match, bracketed, dashed, leading) => {
        blanks.push(Number(bracketed ?? dashed ?? leading));
        return FILL_IN_BLANK;
      });
    return { from, to, passage, blanks, questions };
  });
}

const PROMPT_MAX_LENGTH = 1000;
const OPTION_MAX_LENGTH = 300;
export const PASSAGE_MAX_LENGTH = 10000;

// What is wrong with one pasted question: `errors` (the paste cannot be
// used) and `warnings` (to complete in the editor afterwards).
export function pastedQuestionProblems(item, spec) {
  const errors = [];
  const warnings = [];
  if (item.prompt.length > PROMPT_MAX_LENGTH) errors.push(`question text longer than ${PROMPT_MAX_LENGTH} characters`);
  if (item.options.some((option) => option.length > OPTION_MAX_LENGTH)) errors.push(`an option longer than ${OPTION_MAX_LENGTH} characters`);
  if (spec.question.prompt && !item.prompt) warnings.push('no question text');
  const written = item.options.filter(Boolean).length;
  if (written < spec.optionCount) warnings.push(`${written} of ${spec.optionCount} options`);
  if (item.correct === null) warnings.push('no correct answer');
  return { errors, warnings };
}

// A question with the text, options and correct answer of a pasted one; it
// keeps the rest (id, explanation, graphic).
export function withPastedText(question, item) {
  return {
    ...question,
    prompt: item.prompt,
    options: question.options.map((option, index) => ({
      ...option,
      text: item.options[index] ?? '',
      isCorrect: index === item.correct,
    })),
  };
}
