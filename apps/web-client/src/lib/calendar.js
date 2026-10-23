const DAY_MS = 86400000;

export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const toIsoDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function parseIsoDay(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addMonths(iso, count) {
  const date = parseIsoDay(iso);
  const target = new Date(date.getFullYear(), date.getMonth() + count, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return toIsoDay(new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last)));
}

export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const days = [];
  for (let index = 0; index < 42; index++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    days.push({ iso: toIsoDay(date), day: date.getDate(), inMonth: date.getMonth() === month });
  }
  const weeks = [];
  for (let index = 0; index < 42; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks[5].every((day) => !day.inMonth) ? weeks.slice(0, 5) : weeks;
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseIsoDay(toIso).getTime() - parseIsoDay(fromIso).getTime()) / DAY_MS);
}

export function formatLongDay(iso) {
  return parseIsoDay(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}
