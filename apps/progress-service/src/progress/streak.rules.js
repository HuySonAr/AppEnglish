import { STREAK_CALENDAR_WEEKS, STREAK_REST_DAYS_PER_WEEK, STREAK_TIME_ZONE, StreakDayState } from '@appenglish/progress-contracts';

const DAY_MS = 24 * 60 * 60 * 1000;
const formatters = new Map();

export function dayOf(date, timeZone = STREAK_TIME_ZONE) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }));
  return formatters.get(timeZone).format(new Date(date));
}

const toMs = (day) => Date.parse(`${day}T00:00:00Z`);
export const addDays = (day, count) => new Date(toMs(day) + count * DAY_MS).toISOString().slice(0, 10);
export const weekStart = (day) => addDays(day, -((new Date(toMs(day)).getUTCDay() + 6) % 7));

export function streakOf(studiedDays, today, { restPerWeek = STREAK_REST_DAYS_PER_WEEK, from = null } = {}) {
  const studied = new Set(studiedDays.filter((day) => day <= today));
  const first = [...studied].sort()[0] || today;
  const start = from && from < first ? from : first;
  const states = new Map();
  let run = 0;
  let longest = 0;
  let missed = new Map();
  for (let day = start; day <= today; day = addDays(day, 1)) {
    if (studied.has(day)) {
      run += 1;
      longest = Math.max(longest, run);
      states.set(day, StreakDayState.STUDIED);
    } else if (day === today) {
      states.set(day, StreakDayState.TODAY);
    } else if (run > 0) {
      const week = weekStart(day);
      const count = (missed.get(week) || 0) + 1;
      missed.set(week, count);
      if (count > restPerWeek) {
        run = 0;
        missed = new Map();
        states.set(day, StreakDayState.MISSED);
      } else states.set(day, StreakDayState.REST);
    } else states.set(day, StreakDayState.MISSED);
  }
  const stateOf = (day) => (day > today ? StreakDayState.FUTURE : states.get(day) || StreakDayState.MISSED);
  return { current: run, longest, studiedToday: studied.has(today), stateOf };
}

export function streakView(studiedDays, now, { timeZone = STREAK_TIME_ZONE, weeks = STREAK_CALENDAR_WEEKS } = {}) {
  const today = dayOf(now, timeZone);
  const thisWeek = weekStart(today);
  const calendarStart = addDays(thisWeek, -7 * (weeks - 1));
  const { current, longest, studiedToday, stateOf } = streakOf(studiedDays, today, { from: calendarStart });
  const daysFrom = (start, count) => Array.from({ length: count }, (_, index) => addDays(start, index)).map((day) => ({ day, state: stateOf(day) }));
  return {
    timeZone,
    today,
    current,
    longest,
    studiedToday,
    restPerWeek: STREAK_REST_DAYS_PER_WEEK,
    week: daysFrom(thisWeek, 7),
    calendar: Array.from({ length: weeks }, (_, index) => daysFrom(addDays(calendarStart, index * 7), 7)),
  };
}
