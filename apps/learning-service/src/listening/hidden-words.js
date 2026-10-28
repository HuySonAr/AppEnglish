import { LISTENING_HIDE_SHARE } from '@appenglish/learning-contracts';
import { sameWords } from './dictation.rules.js';

const FUNCTION_WORDS = new Set(
  `a an the and or but nor so yet if as of to in on at by for from with about into onto over under than then
  is am are was were be been being do does did has have had will would shall should can could may might must
  i me my mine you your yours he him his she her hers it its we us our ours they them their theirs
  this that these those there here who whom whose which what when where why how not no
  up out off down just very too also all any some each every own such only`
    .split(/\s+/)
    .filter(Boolean),
);

const EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

export const isHideMode = (mode) => mode in LISTENING_HIDE_SHARE;

export function wordTokens(text) {
  return String(text || '')
    .split(/(\s+)/)
    .filter((part) => part !== '')
    .map((raw) => {
      if (/^\s+$/.test(raw)) return { raw, space: true };
      const core = raw.replace(EDGE, '');
      if (!/[\p{L}\p{N}]/u.test(core)) return { raw };
      const at = raw.indexOf(core);
      return { raw, core, before: raw.slice(0, at), after: raw.slice(at + core.length) };
    });
}

const eligibleIndexes = (tokens) => tokens.flatMap((token, index) => (token.core ? [index] : []));

export function hiddenCount(eligible, share) {
  return eligible > 0 ? Math.min(eligible, Math.max(1, Math.round(eligible * share))) : 0;
}

function shuffled(items, random) {
  const list = [...items];
  for (let at = list.length - 1; at > 0; at--) {
    const other = Math.floor(random() * (at + 1));
    [list[at], list[other]] = [list[other], list[at]];
  }
  return list;
}

export function pickHidden(tokens, share, random = Math.random) {
  const eligible = eligibleIndexes(tokens);
  const isContent = (index) => !FUNCTION_WORDS.has(tokens[index].core.toLowerCase());
  const ordered = [...shuffled(eligible.filter(isContent), random), ...shuffled(eligible.filter((index) => !isContent(index)), random)];
  return new Set(ordered.slice(0, hiddenCount(eligible.length, share)));
}

export const blankKey = (segmentId, index) => `${segmentId}:${index}`;

export function hiddenPieces(segment, share, random = Math.random) {
  const tokens = wordTokens(segment.text);
  const hidden = pickHidden(tokens, share, random);
  const pieces = [];
  const addText = (text) => {
    if (!text) return;
    if (pieces.length && 'text' in pieces.at(-1)) pieces.at(-1).text += text;
    else pieces.push({ text });
  };
  tokens.forEach((token, index) => {
    if (!hidden.has(index)) return addText(token.raw);
    addText(token.before);
    pieces.push({ blank: blankKey(segment.id, index), size: token.core.length });
    addText(token.after);
  });
  return pieces;
}

export function checkHiddenLine(segment, answers, share) {
  const tokens = wordTokens(segment.text);
  const prefix = `${segment.id}:`;
  const keys = Object.keys(answers).filter((key) => key.startsWith(prefix));
  const expected = hiddenCount(eligibleIndexes(tokens).length, share);
  const pieces = [];
  for (const key of keys) {
    const index = Number(key.slice(prefix.length));
    const token = Number.isInteger(index) ? tokens[index] : null;
    if (!token?.core) return null;
    const typed = answers[key] || '';
    pieces.push({ blank: key, answer: token.core, typed, correct: sameWords(token.core, typed) });
  }
  if (keys.length !== expected) return null;
  const right = pieces.filter((piece) => piece.correct).length;
  return { pieces, right, count: pieces.length, accuracy: pieces.length ? Math.round((right * 100) / pieces.length) : 100 };
}
