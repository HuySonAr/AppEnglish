import { httpClient } from '../../../lib/api/http-client.js';

export async function getProgress() {
  return (await httpClient.get('/progress')).data;
}

export async function getXp() {
  return (await httpClient.get('/progress/xp')).data;
}
export async function getStreak() {
  return (await httpClient.get('/progress/streak')).data;
}
export async function getLeaderboard() {
  return (await httpClient.get('/progress/leaderboard')).data;
}
export async function getCefrProfile() {
  return (await httpClient.get('/learning/cefr-profile')).data;
}
