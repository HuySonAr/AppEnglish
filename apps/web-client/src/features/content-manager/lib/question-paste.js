import { FILL_IN_BLANK } from '@appenglish/content-contracts';
import { tableRowFromTabs } from '../../../lib/passage.js';

const QUESTION = /^(?:question\s+(\d+)\s*[.:]?|(\d+)\s*[.)])\s*(.*)$/i;
const OPTION = /^\(?([A-D])[).]\s*(.*)$/;
const ANSWER = /^(?:correct\s+answer|answer|đáp án)\s*:?\s*\(?([A-D])\)?\.?$/i;
const letters = 'ABCD';

const joined = (before, more) => (before ? `${before} ${more}` : more);

export function parsePastedQuestions(text) {
  const questions = [];
  let current = null;
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

const PASSAGE = /^(?:passage\s+\d+\s*[-–—:]?\s*)?questions\s+(\d+)\s*(?:[-–—]|to|through)\s*(\d+)\b/i;
const DOCUMENT_NAME = /^[a-z]+(?:[ -][a-z]+){0,2}$/i;
const BLANK = /\[(\d+)\]|-{2,}\s*\(?(\d+)\)?\s*-*|\((\d+)\)\s*-{2,}/g;

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
