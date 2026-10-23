
const SECTION_MIN = 5;
const SECTION_MAX = 495;
const clampScore = (value) =>
  Math.max(SECTION_MIN, Math.min(SECTION_MAX, Math.round(value / 5) * 5));

export function defaultScoreConversion() {
  const table = (slope, offset) =>
    Array.from({ length: 101 }, (_, raw) => clampScore(raw * slope + offset));
  return { listening: table(5.15, -5), reading: table(5.2, -25) };
}

export function estimatedSectionScore(correctCount, totalCount, table) {
  if (!totalCount) return SECTION_MIN;
  return table[Math.round((correctCount * 100) / totalCount)];
}

export function estimatedScores(score, totals, conversion) {
  const listening = estimatedSectionScore(score.listeningCorrect, totals.listening, conversion.listening);
  const reading = estimatedSectionScore(score.readingCorrect, totals.reading, conversion.reading);
  return { listeningScore: listening, readingScore: reading, totalScore: listening + reading };
}

export function recommendedLevel({ latestTotalScore, startUnit }) {
  if (latestTotalScore !== null && latestTotalScore !== undefined)
    return latestTotalScore < 450 ? 1 : latestTotalScore < 700 ? 2 : 3;
  return Math.max(1, Math.min(3, startUnit || 1));
}
