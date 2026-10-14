import test from 'node:test';
import assert from 'node:assert/strict';
import { QuizLight, checkedLights, lightOf, withAnswerChanged } from './quiz-lights.js';

test('a word is lit right or wrong by the check, and unlit again when its answer changes', () => {
  const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(lightOf({}, 'a'), QuizLight.UNCHECKED);
  const lights = checkedLights(questions, ['b']);
  assert.deepEqual(questions.map((question) => lightOf(lights, question.id)), ['right', 'wrong', 'right']);
  const changed = withAnswerChanged(lights, 'b');
  assert.deepEqual(questions.map((question) => lightOf(changed, question.id)), ['right', 'unchecked', 'right']);
  assert.equal(withAnswerChanged(changed, 'b'), changed);
});
