import { httpClient } from '../../../lib/api/http-client.js';

// Progress (F06, D33): lessons completed over the published lessons, and the
// Reading and Listening mastery from the lesson tests and full mock tests.
export async function getProgress() {
  return (await httpClient.get('/progress')).data;
}

// XP (F07, D63): the learner's total, rank and the mock tests it came from;
// and the overall leaderboard (D39).
export async function getXp() {
  return (await httpClient.get('/progress/xp')).data;
}
export async function getLeaderboard() {
  return (await httpClient.get('/progress/leaderboard')).data;
}
