import { EtsSpeakingTask } from '@appenglish/content-contracts';
import { ReviewAction, SW_RAW_MAX, swDefaultConversion } from '@appenglish/learning-contracts';
import { READ_ALOUD_MAX } from '../../student/lib/sw-score.js';

export { READ_ALOUD_MAX };

const isReadAloud = (item) => item.task === EtsSpeakingTask.READ_ALOUD;
const text = (value) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : '');

export function initialSwValues(items) {
  return Object.fromEntries(
    items.map((item) => {
      const ai = item.ai?.stage === 'done' ? item.ai : null;
      return [item.number, isReadAloud(item) ? { pronunciation: text(ai?.pronunciation), intonation: text(ai?.intonation) } : { score: text(ai?.score) }];
    }),
  );
}

function whole(raw, max) {
  if (raw === '' || raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

export function swItemValue(item, value = {}) {
  if (isReadAloud(item)) {
    const pronunciation = whole(value.pronunciation, READ_ALOUD_MAX);
    const intonation = whole(value.intonation, READ_ALOUD_MAX);
    return pronunciation === null || intonation === null ? null : { pronunciation, intonation, score: (pronunciation + intonation) / 2 };
  }
  const score = whole(value.score, item.maxScore);
  return score === null ? null : { score };
}

export function swInvalidNumbers(items, values) {
  return items.filter((item) => swItemValue(item, values[item.number]) === null).map((item) => item.number);
}

export function swRawTotal(items, values) {
  let total = 0;
  for (const item of items) {
    const value = swItemValue(item, values[item.number]);
    if (!value) return null;
    total += value.score;
  }
  return Math.round(total * 10) / 10;
}

export function swApproxScaled(section, raw) {
  if (raw === null || raw === undefined) return null;
  const table = swDefaultConversion()[section];
  if (!table) return null;
  return table[Math.min(table.length - 1, Math.max(0, Math.round(raw)))];
}

export const swRawMax = (section) => SW_RAW_MAX[section];

export function swValuesChanged(items, values) {
  return items.some((item) => {
    const ai = item.ai?.stage === 'done' ? item.ai : null;
    const value = swItemValue(item, values[item.number]);
    if (!ai || !value) return true;
    if (isReadAloud(item)) return value.pronunciation !== ai.pronunciation || value.intonation !== ai.intonation;
    return value.score !== ai.score;
  });
}

export function swActionFor(hasAi, changed) {
  if (!hasAi) return ReviewAction.FROM_SCRATCH;
  return changed ? ReviewAction.EDIT : ReviewAction.CONFIRM;
}

export function swPayloadItems(items, values) {
  return Object.fromEntries(
    items.map((item) => {
      const value = swItemValue(item, values[item.number]);
      return [String(item.number), isReadAloud(item) ? { pronunciation: value.pronunciation, intonation: value.intonation } : value.score];
    }),
  );
}
