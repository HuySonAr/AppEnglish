// Where a learner stands with the placement test. NOT_STARTED has no stored
// attempt; the other three are stored.
export const PlacementStatus = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED'
});

// Time allowed for the placement test; the server keeps the clock (D57).
export const PLACEMENT_DURATION_MINUTES = 25;

// Minimum score (percent) to start at unit 2 and at unit 3 (D35). An Admin
// can change them.
export const DEFAULT_PLACEMENT_THRESHOLDS = Object.freeze({
  unit2Threshold: 60,
  unit3Threshold: 80
});

// The unit a learner starts at for correctCount right answers out of
// totalCount. Compares exact fractions, so 59.9% stays below a 60 threshold.
// The result never exceeds the number of published units.
export function placementStartUnit(correctCount, totalCount, thresholds, publishedUnitCount) {
  const reaches = (threshold) => totalCount > 0 && correctCount * 100 >= threshold * totalCount;
  const unit = reaches(thresholds.unit3Threshold) ? 3 : reaches(thresholds.unit2Threshold) ? 2 : 1;
  return Math.max(1, Math.min(unit, publishedUnitCount));
}

// Learning codes share the numeric space of @appenglish/auth-contracts
// ResponseCode and @appenglish/content-contracts ContentResponseCode:
// 0 success, 26 forbidden role, 30 validation, 32 system; 50-59 are learning.
export const LearningResponseCode = Object.freeze({
  SUCCESS: 0,
  FORBIDDEN_ROLE: 26,
  VALIDATION_ERROR: 30,
  SYSTEM_ERROR: 32,
  PLACEMENT_NOT_AVAILABLE: 50,
  PLACEMENT_ALREADY_TAKEN: 51,
  PLACEMENT_NOT_IN_PROGRESS: 52
});
