import test from 'node:test';
import assert from 'node:assert/strict';
import { answersOf, availableChips, clearBlank, emptyPlacement, placeChip, tapBlank, tapChip } from './fill-in.js';

const bank = ['platform', 'train', 'train'];

test('placing a chip moves it out of any other blank and returns the replaced chip to the bank', () => {
  let placed = emptyPlacement(2);
  assert.deepEqual(placed, [null, null]);
  placed = placeChip(placed, 0, 1);
  assert.deepEqual(placed, [1, null]);
  assert.deepEqual(availableChips(bank, placed), [{ chip: 0, word: 'platform' }, { chip: 2, word: 'train' }]);
  placed = placeChip(placed, 1, 1);
  assert.deepEqual(placed, [null, 1]);
  placed = placeChip(placed, 1, 0);
  assert.deepEqual(placed, [null, 0]);
  assert.deepEqual(availableChips(bank, placed).map((item) => item.chip), [1, 2]);
  assert.deepEqual(answersOf(bank, placed), ['', 'platform']);
  assert.deepEqual(clearBlank(placed, 1), [null, null]);
});

test('tapping a chip then a blank places it; tapping a blank then a chip does too', () => {
  const start = { placed: emptyPlacement(2), selectedChip: null, selectedBlank: null };
  let state = tapChip(start, 2);
  assert.deepEqual(state, { ...start, selectedChip: 2 });
  assert.deepEqual(tapChip(state, 2), start);
  state = tapBlank(state, 1);
  assert.deepEqual(state, { placed: [null, 2], selectedChip: null, selectedBlank: null });

  state = tapBlank(state, 0);
  assert.deepEqual(state, { placed: [null, 2], selectedChip: null, selectedBlank: 0 });
  assert.deepEqual(tapBlank(state, 0), { placed: [null, 2], selectedChip: null, selectedBlank: null });
  state = tapChip(state, 0);
  assert.deepEqual(state, { placed: [0, 2], selectedChip: null, selectedBlank: null });
  assert.deepEqual(answersOf(bank, state.placed), ['platform', 'train']);

  assert.deepEqual(tapBlank(state, 1), { placed: [0, null], selectedChip: null, selectedBlank: null });
  assert.deepEqual(tapBlank({ ...state, selectedChip: 1 }, 0), { placed: [1, 2], selectedChip: null, selectedBlank: null });
});
