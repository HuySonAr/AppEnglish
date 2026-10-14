import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceInstruction, practiceScore } from './vocabulary-practice.js';

test('the practice score counts the answered questions and lists the wrong ones in order', () => {
  const questions = [
    { id: 'a', direction: 'MEANING', answer: 'vé' },
    { id: 'b', direction: 'WORD', answer: 'ticket' },
    { id: 'c', direction: 'MEANING', answer: 'ga' },
  ];
  assert.deepEqual(practiceScore(questions, {}), { answered: 0, correct: 0, wrong: [] });
  const score = practiceScore(questions, { a: 'vé', b: 'platform' });
  assert.deepEqual([score.answered, score.correct, score.wrong.map((question) => question.id)], [2, 1, ['b']]);
  assert.deepEqual(questions.map(practiceInstruction), [
    'Choose the meaning of this word',
    'Choose the word for this meaning',
    'Choose the meaning of this word',
  ]);
});
