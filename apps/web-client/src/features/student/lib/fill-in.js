
export const emptyPlacement = (blankCount) => Array(blankCount).fill(null);

export function placeChip(placed, blank, chip) {
  return placed.map((current, index) => (index === blank ? chip : current === chip ? null : current));
}

export function clearBlank(placed, blank) {
  return placed.map((current, index) => (index === blank ? null : current));
}

export function availableChips(wordBank, placed) {
  return wordBank.map((word, chip) => ({ chip, word })).filter(({ chip }) => !placed.includes(chip));
}

export function answersOf(wordBank, placed) {
  return placed.map((chip) => (chip === null ? '' : wordBank[chip]));
}

export function tapChip(state, chip) {
  if (state.selectedBlank !== null) {
    return { placed: placeChip(state.placed, state.selectedBlank, chip), selectedChip: null, selectedBlank: null };
  }
  return { ...state, selectedChip: state.selectedChip === chip ? null : chip };
}

export function tapBlank(state, blank) {
  if (state.selectedChip !== null) {
    return { placed: placeChip(state.placed, blank, state.selectedChip), selectedChip: null, selectedBlank: null };
  }
  if (state.placed[blank] !== null) {
    return { placed: clearBlank(state.placed, blank), selectedChip: null, selectedBlank: null };
  }
  return { ...state, selectedBlank: state.selectedBlank === blank ? null : blank };
}
