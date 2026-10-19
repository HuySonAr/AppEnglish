// Progress (F06, D33): what a learner's progress is made of. Browser-safe:
// constants and pure rules only; gRPC helpers are in ./grpc.

// Where a result with per-skill counts comes from. Placement, practice and
// mini tests never reach progress (workflow 07).
export const ProgressSource = Object.freeze({ LESSON_TEST: 'LESSON_TEST', MOCK_TEST: 'MOCK_TEST' });

// The two skills of the product; a question belongs to one of them (D34).
export const ProgressSkill = Object.freeze({ LISTENING: 'listening', READING: 'reading' });

// XP (F07): only the first full attempt of a mock test earns XP (D10, D63),
// right answers over questions scaled to this and rounded; the leaderboard
// shows this many learners (D39: one overall board, no weekly one).
export const XP_MAX_PER_MOCK = 100;
export const LEADERBOARD_SIZE = 50;

// Exact values are stored; the client shows whole percents (D39).
export function wholePercent(ratio) {
  return ratio === null || ratio === undefined ? null : Math.round(ratio * 100);
}

// Progress codes share the numeric space of the other contracts: 0 success,
// 26 forbidden role, 30 validation, 32 system; 70-79 are reserved for
// progress and XP.
export const ProgressResponseCode = Object.freeze({
  SUCCESS: 0,
  FORBIDDEN_ROLE: 26,
  VALIDATION_ERROR: 30,
  SYSTEM_ERROR: 32,
});
