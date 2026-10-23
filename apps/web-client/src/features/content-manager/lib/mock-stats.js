import { MockQuestionFlag } from '@appenglish/learning-contracts';
import { matchesSearch } from '../../../lib/list.js';

export const StatSort = Object.freeze({ NUMBER: 'number', HARDEST: 'hardest', EASIEST: 'easiest', SKIPPED: 'skipped' });
export const statSortOptions = [
  { value: StatSort.NUMBER, label: 'Question number' },
  { value: StatSort.HARDEST, label: 'Hardest first' },
  { value: StatSort.EASIEST, label: 'Easiest first' },
  { value: StatSort.SKIPPED, label: 'Most skipped' },
];

const flagOrder = [MockQuestionFlag.CHECK_KEY, MockQuestionFlag.HARD, MockQuestionFlag.EASY];

export const flagInfo = {
  [MockQuestionFlag.CHECK_KEY]: { label: 'Check the answer', variant: 'destructive' },
  [MockQuestionFlag.HARD]: { label: 'Very hard', variant: 'warning' },
  [MockQuestionFlag.EASY]: { label: 'Very easy', variant: 'info' },
};

export function flaggedQuestions(questions) {
  return questions
    .filter((question) => question.flag)
    .sort((a, b) => flagOrder.indexOf(a.flag) - flagOrder.indexOf(b.flag) || (a.rate ?? 0) - (b.rate ?? 0) || a.number - b.number);
}

export function filterStatQuestions(questions, { search = '', part = 'all', sort = StatSort.NUMBER }) {
  const rateOf = (question) => question.rate ?? -1;
  const compare = {
    [StatSort.NUMBER]: (a, b) => a.number - b.number,
    [StatSort.HARDEST]: (a, b) => rateOf(a) - rateOf(b) || a.number - b.number,
    [StatSort.EASIEST]: (a, b) => rateOf(b) - rateOf(a) || a.number - b.number,
    [StatSort.SKIPPED]: (a, b) => b.skipped - a.skipped || a.number - b.number,
  }[sort];
  return questions
    .filter((question) => (part === 'all' || question.partKey === part) && matchesSearch(`${question.number} ${question.prompt} ${question.options.map((option) => option.text).join(' ')}`, search))
    .sort(compare);
}
