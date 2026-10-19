// Pure rules of the fill-in exercise (D111): the words of the bank are
// placed into the blanks by tapping. A chip is one word of the bank, known by
// its index there (the same word may appear twice); `placed` holds, per
// blank, the index of the chip in it or null.

export const emptyPlacement = (blankCount) => Array(blankCount).fill(null);

// Puts chip `chip` into blank `blank`. The chip leaves any blank it was in;
// a chip already in the target blank goes back to the bank.
export function placeChip(placed, blank, chip) {
  return placed.map((current, index) => (index === blank ? chip : current === chip ? null : current));
}

// Returns the word of a blank to the bank.
export function clearBlank(placed, blank) {
  return placed.map((current, index) => (index === blank ? null : current));
}

// The chips still in the bank, in bank order, as { chip, word }.
export function availableChips(wordBank, placed) {
  return wordBank.map((word, chip) => ({ chip, word })).filter(({ chip }) => !placed.includes(chip));
}

// The answers to send: the word in each blank, '' where empty.
export function answersOf(wordBank, placed) {
  return placed.map((chip) => (chip === null ? '' : wordBank[chip]));
}

// What a tap does, given what is selected: a chip waiting for a blank
// (`selectedChip`), a blank waiting for a chip (`selectedBlank`), or nothing.
// Returns the next { placed, selectedChip, selectedBlank }.
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
  // A filled blank gives its word back; an empty one waits for a chip.
  if (state.placed[blank] !== null) {
    return { placed: clearBlank(state.placed, blank), selectedChip: null, selectedBlank: null };
  }
  return { ...state, selectedBlank: state.selectedBlank === blank ? null : blank };
}
