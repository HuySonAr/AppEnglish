const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86400000;
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

const dayOf = (date) => dayFormatter.format(date);
const addDays = (day, count) => new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10);
const weekStartOf = (day) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
export const startOfDay = (day) => new Date(`${day}T00:00:00+07:00`);

export function lastWeeks(now) {
  const thisWeek = weekStartOf(dayOf(now));
  const lastWeek = addDays(thisWeek, -7);
  return { thisWeek, lastWeek, weekBefore: addDays(lastWeek, -7) };
}

export function newLearnersNotice({ lastWeek, thisWeek }, newLearners, before) {
  return {
    id: `auth:week:${lastWeek}`,
    kind: 'NEW_LEARNERS',
    data: { weekStart: lastWeek, weekEnd: addDays(thisWeek, -1), newLearners, change: newLearners - before },
    createdAt: startOfDay(thisWeek).toISOString(),
  };
}
