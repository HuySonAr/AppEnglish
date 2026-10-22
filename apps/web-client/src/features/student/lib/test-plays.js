// How many times a recording of a course test has been played (D141). Kept
// in sessionStorage per test version and recording, so a reload does not give
// the plays back; storage may be missing (private mode), then plays live in
// the page only.
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
    // Storage unavailable: the count stays in the page.
  }
}

export const playsLeft = (used, limit) => Math.max(0, limit - (used || 0));

// The key of one recording in one test attempt: the version and the section.
export const playKeyOf = (versionId, sectionId) => (versionId && sectionId ? `${versionId}:${sectionId}` : null);
