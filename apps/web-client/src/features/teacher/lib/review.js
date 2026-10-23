import { ReviewAction, reviewScores } from '@appenglish/learning-contracts';

export const reviewKindLabels = { read_aloud: 'Read aloud', open_speaking: 'Open speaking', writing: 'Writing' };

export function initialScores(criteria, ai) {
  return Object.fromEntries(criteria.map(({ key, min }) => [key, ai && typeof ai[key] === 'number' ? ai[key] : min]));
}

export function scoresChanged(criteria, ai, scores) {
  if (!ai) return true;
  return criteria.some(({ key }) => Number(scores[key]) !== ai[key]);
}

export function actionFor(ai, changed) {
  if (!ai) return ReviewAction.FROM_SCRATCH;
  return changed ? ReviewAction.EDIT : ReviewAction.CONFIRM;
}

export function previewTotal(kind, criteria, scores) {
  const valid = criteria.every(({ key, min, max }) => {
    const value = Number(scores[key]);
    return Number.isFinite(value) && value >= min && value <= max;
  });
  return valid ? reviewScores(kind, Object.fromEntries(criteria.map(({ key }) => [key, Number(scores[key])]))).total : null;
}

export function hoursLeft(iso, now = new Date()) {
  return Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 3600000));
}
