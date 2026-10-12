// Pure rules of mock tests: the estimated TOEIC score and the suggested level.

const SECTION_MIN = 5;
const SECTION_MAX = 495;
const clampScore = (value) =>
  Math.max(SECTION_MIN, Math.min(SECTION_MAX, Math.round(value / 5) * 5));

// The default conversion from right answers (0-100) to an estimated section
// score (5-495). The official tables are not public and differ per test form,
// so this is an approximation an Admin can replace (D64).
export function defaultScoreConversion() {
  const table = (slope, offset) =>
    Array.from({ length: 101 }, (_, raw) => clampScore(raw * slope + offset));
  return { listening: table(5.15, -5), reading: table(5.2, -25) };
}

// The estimated score of one section for correctCount right answers out of
// totalCount. A section with another number of questions than 100 is scaled
// to the table by its share of right answers.
export function estimatedSectionScore(correctCount, totalCount, table) {
  if (!totalCount) return SECTION_MIN;
  return table[Math.round((correctCount * 100) / totalCount)];
}

export function estimatedScores(score, totals, conversion) {
  const listening = estimatedSectionScore(score.listeningCorrect, totals.listening, conversion.listening);
  const reading = estimatedSectionScore(score.readingCorrect, totals.reading, conversion.reading);
  return { listeningScore: listening, readingScore: reading, totalScore: listening + reading };
}

// The level (1-3) suggested to a learner (D64): from the estimated total of
// the latest full mock test (below 450: 1, below 700: 2, else 3); before any
// mock test, from the starting unit the placement gave; else 1.
export function recommendedLevel({ latestTotalScore, startUnit }) {
  if (latestTotalScore !== null && latestTotalScore !== undefined)
    return latestTotalScore < 450 ? 1 : latestTotalScore < 700 ? 2 : 3;
  return Math.max(1, Math.min(3, startUnit || 1));
}
