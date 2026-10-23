const KEY = 'appenglish.testPlays';

function readAll(storage) {
  try {
    return JSON.parse(storage?.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function readPlays(playKey, storage = globalThis.sessionStorage) {
  if (!playKey) return 0;
  const value = Number(readAll(storage)[playKey]);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function writePlays(playKey, count, storage = globalThis.sessionStorage) {
  if (!playKey) return;
  try {
    storage?.setItem(KEY, JSON.stringify({ ...readAll(storage), [playKey]: count }));
  } catch {
  }
}

export const playsLeft = (used, limit) => Math.max(0, limit - (used || 0));

export const playKeyOf = (versionId, sectionId) => (versionId && sectionId ? `${versionId}:${sectionId}` : null);
