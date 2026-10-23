import { PartOfSpeech } from '@appenglish/content-contracts';
import { newVocabulary } from './lesson-draft.js';

const COLUMNS = [
  ['word', 100],
  ['partOfSpeech', 30],
  ['meaning', 300],
  ['example', 500],
  ['exampleMeaning', 500],
  ['phonetic', 100],
];
const NEEDED = { word: 'word', partOfSpeech: 'part of speech', meaning: 'meaning', example: 'example sentence' };
const SHORT_FORMS = {
  n: PartOfSpeech.NOUN,
  v: PartOfSpeech.VERB,
  adj: PartOfSpeech.ADJECTIVE,
  adv: PartOfSpeech.ADVERB,
  prep: PartOfSpeech.PREPOSITION,
  conj: PartOfSpeech.CONJUNCTION,
  pron: PartOfSpeech.PRONOUN,
  det: PartOfSpeech.DETERMINER,
  interj: PartOfSpeech.INTERJECTION,
  phr: PartOfSpeech.PHRASE,
};

function partOfSpeech(written) {
  const name = written.toLowerCase().replace(/[().]/g, '').trim();
  return Object.values(PartOfSpeech).includes(name) ? name : SHORT_FORMS[name] || null;
}

const keyOf = (item) => `${item.word.trim().toLowerCase()}|${item.partOfSpeech}`;

export function parsePastedVocabulary(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const cells = (line.trim().includes('\t') ? line.split('\t') : line.trim().replace(/^\||\|$/g, '').split('|')).map((cell) => cell.trim());
      return { ...Object.fromEntries(COLUMNS.map(([name], index) => [name, cells[index] ?? ''])), columns: cells.length };
    })
    .filter((item, index) => index > 0 || item.word.toLowerCase() !== 'word');
}

export function vocabularyPastePlan(vocabulary, text) {
  const pasted = parsePastedVocabulary(text);
  const existing = new Map(vocabulary.map((item) => [keyOf(item), item]));
  const seen = new Set();
  const updates = new Map();
  const added = [];
  const lines = pasted.map((written) => {
    const item = { ...written, partOfSpeech: partOfSpeech(written.partOfSpeech) };
    const errors = [];
    for (const [name, label] of Object.entries(NEEDED)) if (!written[name]) errors.push(`no ${label}`);
    if (written.partOfSpeech && !item.partOfSpeech) errors.push(`"${written.partOfSpeech}" is not a part of speech`);
    if (written.columns > COLUMNS.length) errors.push(`more than ${COLUMNS.length} columns`);
    for (const [name, max] of COLUMNS) if (name !== 'partOfSpeech' && written[name].length > max) errors.push(`${name} longer than ${max} characters`);
    if (!errors.length && seen.has(keyOf(item))) errors.push('this word appears twice');
    const old = errors.length ? null : existing.get(keyOf(item));
    if (!errors.length) {
      seen.add(keyOf(item));
      const { columns, ...fields } = item;
      if (old)
        updates.set(old.id, { ...old, ...fields, exampleMeaning: fields.exampleMeaning || old.exampleMeaning, phonetic: fields.phonetic || old.phonetic });
      else added.push({ ...newVocabulary(), ...fields });
    }
    return {
      title: written.word || '(no word)',
      note: ` · ${item.partOfSpeech}${old ? ' · updates the word already there' : ' · new word'}`,
      text: [written.meaning, written.example].filter(Boolean).join(' — '),
      errors,
      warnings: [],
    };
  });
  const usable = lines.every((line) => !line.errors.length);
  return {
    vocabulary: usable ? [...vocabulary.map((item) => updates.get(item.id) || item), ...added] : vocabulary,
    count: pasted.length,
    lines,
  };
}
