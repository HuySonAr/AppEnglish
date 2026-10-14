// Scoring of a dictation (F05B-3, D86). Pure functions, no I/O.
//
// A sentence and what the learner typed are compared word by word, ignoring
// case, punctuation and accents ("café" = "cafe"). Contractions count as their full form ("don't" =
// "do not", "she'd" = "she would" or "she had"), and numbers written in words
// count as digits ("twenty-one" = "21", "2,500" = "2500").

// "n't" forms whose first part is not the word itself.
const IRREGULAR_NOT = { "won't": ['will', 'not'], "can't": ['can', 'not'], cannot: ['can', 'not'], "shan't": ['shall', 'not'] };
const SUFFIXES = { "'m": 'am', "'re": 'are', "'ve": 'have', "'ll": 'will', "'d": "'d" };
// Words whose "'s" means "is" or "has"; elsewhere "'s" is a possessive and
// stays part of the word ("John's").
const S_WORDS = new Set(['it', 'he', 'she', 'that', 'there', 'here', 'what', 'where', 'who', 'how', 'when', 'why', 'this']);

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { hundred: 100, thousand: 1000, million: 1000000 };
const isNumberWord = (word) => word in UNITS || word in TENS || word in SCALES;

// The words of a text, split at spaces: { display, plains }, display as
// written (for showing) and plains its parts in lower case without
// punctuation; hyphens, dashes and slashes split a word into parts
// ("twenty-one", "well-known"). A word without a letter or digit is dropped.
const plainOf = (part) =>
  // Digits keep their decimal point and lose thousands separators.
  /^[^a-z0-9]*[0-9][0-9,.:]*[^a-z0-9]*$/.test(part)
    ? part.replace(/^[^0-9]+|[^0-9]+$/g, '').replace(/,(?=\d{3}\b)/g, '')
    : part.replace(/[^\p{L}\p{N}']/gu, '').replace(/^'+|'+$/g, '');
export function words(text) {
  return text
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .split(/\s+/)
    .map((display) => ({
      display: display.replace(/^[^\p{L}\p{N}']+/u, ''),
      plains: display
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .split(/[-\u2013\u2014/]+/)
        .map(plainOf)
        .filter((plain) => /[\p{L}\p{N}]/u.test(plain)),
    }))
    .filter((word) => word.plains.length);
}

// The comparable tokens of a word list: { value, source }, source being the
// index of the word they come from (a number written in several words gives
// one token from several words: source is then the first and `sources` all).
export function tokens(list) {
  const expanded = [];
  const parts = list.flatMap(({ plains }, index) => plains.map((plain) => ({ plain, index })));
  parts.forEach(({ plain, index }) => {
    const push = (value) => expanded.push({ value, sources: [index] });
    if (IRREGULAR_NOT[plain]) return IRREGULAR_NOT[plain].forEach(push);
    if (plain.endsWith("n't") && plain.length > 3) return [plain.slice(0, -3), 'not'].forEach(push);
    if (plain === "let's") return ['let', 'us'].forEach(push);
    const suffix = Object.keys(SUFFIXES).find((ending) => plain.endsWith(ending) && plain.length > ending.length);
    if (suffix) return [plain.slice(0, -suffix.length), SUFFIXES[suffix]].forEach(push);
    if (plain.endsWith("'s") && S_WORDS.has(plain.slice(0, -2))) return [plain.slice(0, -2), "'s"].forEach(push);
    return push(plain);
  });
  // Runs of number words become one number: "two thousand five hundred".
  const result = [];
  for (let at = 0; at < expanded.length; ) {
    if (!isNumberWord(expanded[at].value)) {
      result.push(expanded[at++]);
      continue;
    }
    let total = 0;
    let current = 0;
    const sources = [];
    while (at < expanded.length) {
      const { value } = expanded[at];
      // "and" belongs to a number between a scale and a smaller number.
      const joining = value === 'and' && sources.length && at + 1 < expanded.length && isNumberWord(expanded[at + 1].value) && !(expanded[at + 1].value in SCALES);
      if (!isNumberWord(value) && !joining) break;
      if (value in UNITS) current += UNITS[value];
      else if (value in TENS) current += TENS[value];
      else if (value === 'hundred') current = (current || 1) * 100;
      else if (value in SCALES) {
        total += (current || 1) * SCALES[value];
        current = 0;
      }
      sources.push(...expanded[at].sources);
      at++;
    }
    result.push({ value: String(total + current), sources: [...new Set(sources)] });
  }
  return result;
}

// "'d" stands for "would" or "had", "'s" for "is" or "has".
const SHORT = { "'d": ['would', 'had'], "'s": ['is', 'has'] };
const same = (a, b) => a === b || SHORT[a]?.includes(b) || SHORT[b]?.includes(a);

// The cheapest way to turn the expected tokens into the typed ones: a list
// of steps { type: 'match' | 'sub' | 'del' | 'ins', expected, typed }.
function align(expected, typed) {
  const rows = expected.length + 1;
  const cols = typed.length + 1;
  const cost = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++)
    for (let j = 1; j < cols; j++)
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + (same(expected[i - 1].value, typed[j - 1].value) ? 0 : 1),
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1,
      );
  const steps = [];
  let i = expected.length;
  let j = typed.length;
  while (i > 0 || j > 0) {
    const matched = i > 0 && j > 0 && same(expected[i - 1].value, typed[j - 1].value);
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + (matched ? 0 : 1)) {
      steps.push({ type: matched ? 'match' : 'sub', expected: expected[--i], typed: typed[--j] });
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      steps.push({ type: 'del', expected: expected[--i] });
    } else {
      steps.push({ type: 'ins', typed: typed[--j] });
    }
  }
  return steps.reverse();
}

// One sentence checked: its words as they should be written, each `correct`,
// `wrong` (with what was typed instead) or `missing`, with the typed words
// that do not belong (`extra`) in their place; `total` comparable tokens and
// `errors` (wrong + missing + extra tokens).
export function checkSentence(expectedText, typedText) {
  const expectedWords = words(expectedText);
  const typedWords = words(typedText || '');
  const steps = align(tokens(expectedWords), tokens(typedWords));
  const state = expectedWords.map(() => ({ match: 0, other: 0, deleted: 0, typed: [] }));
  const typedUsed = new Set();
  for (const step of steps) {
    if (step.expected)
      for (const source of step.expected.sources) {
        const entry = state[source];
        if (step.type === 'match') entry.match++;
        else if (step.type === 'del') entry.deleted++;
        else entry.other++;
        if (step.type === 'sub') for (const typedSource of step.typed.sources) if (!entry.typed.includes(typedSource)) entry.typed.push(typedSource);
      }
    if (step.typed && step.type !== 'ins') step.typed.sources.forEach((source) => typedUsed.add(source));
  }
  const result = [];
  const shown = new Set();
  const shownTyped = new Set();
  for (const step of steps) {
    if (step.expected)
      for (const source of step.expected.sources) {
        if (shown.has(source)) continue;
        shown.add(source);
        const entry = state[source];
        const status = !entry.other && !entry.deleted ? 'correct' : !entry.match && !entry.other ? 'missing' : 'wrong';
        result.push({
          text: expectedWords[source].display,
          status,
          ...(status === 'wrong' ? { typed: entry.typed.map((at) => typedWords[at].display).join(' ') || null } : {}),
        });
      }
    if (step.type === 'ins')
      for (const source of step.typed.sources) {
        if (typedUsed.has(source) || shownTyped.has(source)) continue;
        shownTyped.add(source);
        result.push({ text: typedWords[source].display, status: 'extra' });
      }
  }
  const total = steps.filter((step) => step.expected).length;
  const errors = steps.filter((step) => step.type !== 'match').length;
  return { words: result, total, errors };
}

// True when a blank was filled with its word, by the same rules as a
// sentence (case, punctuation, accents, contractions, numbers).
export function sameWords(expected, typed) {
  const checked = checkSentence(expected, typed || '');
  return checked.total > 0 && checked.errors === 0;
}

// Percent of the tokens written right, never below 0.
export function accuracyOf(total, errors) {
  return total ? Math.max(0, Math.round(((total - errors) * 100) / total)) : 0;
}
