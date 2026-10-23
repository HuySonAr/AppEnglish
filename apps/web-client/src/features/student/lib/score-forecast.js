import { FORECAST_MAX_DAYS, FORECAST_POINTS } from '@appenglish/learning-contracts';

const DAY_MS = 86400000;
const MIN_SPAN_DAYS = 3;

export const ForecastStatus = Object.freeze({
  NO_SCORE: 'noScore',
  NEED_MORE: 'needMore',
  REACHED: 'reached',
  FLAT: 'flat',
  FAR: 'far',
  ON_TRACK: 'onTrack',
  LATE: 'late',
});

function slopePerDay(points) {
  const xs = points.map((point) => new Date(point.at).getTime() / DAY_MS);
  const ys = points.map((point) => point.total);
  const mx = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const my = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  const top = xs.reduce((sum, x, index) => sum + (x - mx) * (ys[index] - my), 0);
  const bottom = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  return bottom ? top / bottom : 0;
}

export function scoreForecast(data) {
  if (!data?.goal) return null;
  const target = data.goal.targetScore;
  const examDate = data.goal.examDate || null;
  const history = data.history || [];
  const base = { target, examDate, history, date: null, perWeek: null, projection: [] };
  if (!history.length) return { ...base, status: ForecastStatus.NO_SCORE };
  const last = history.at(-1);
  if (last.total >= target) return { ...base, status: ForecastStatus.REACHED };
  const points = history.slice(-FORECAST_POINTS);
  const span = (new Date(last.at).getTime() - new Date(points[0].at).getTime()) / DAY_MS;
  if (points.length < 2 || span < MIN_SPAN_DAYS) return { ...base, status: ForecastStatus.NEED_MORE };
  const slope = slopePerDay(points);
  const perWeek = Math.round(slope * 7);
  if (slope <= 0) return { ...base, perWeek, status: ForecastStatus.FLAT };
  const days = Math.ceil((target - last.total) / slope);
  if (days > FORECAST_MAX_DAYS) return { ...base, perWeek, status: ForecastStatus.FAR };
  const date = new Date(new Date(last.at).getTime() + days * DAY_MS).toISOString();
  const late = examDate && date.slice(0, 10) > examDate;
  return {
    ...base,
    perWeek,
    date,
    status: late ? ForecastStatus.LATE : ForecastStatus.ON_TRACK,
    projection: [
      { at: last.at, total: last.total },
      { at: date, total: target },
    ],
  };
}

export function forecastMessage(forecast) {
  if (!forecast) return null;
  const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return {
    [ForecastStatus.NO_SCORE]: { tone: 'muted', text: 'Take a full mock test to start your score line.' },
    [ForecastStatus.NEED_MORE]: { tone: 'muted', text: 'Take another full test a few days later to see a forecast.' },
    [ForecastStatus.REACHED]: { tone: 'success', text: 'You have reached your target.' },
    [ForecastStatus.FLAT]: { tone: 'warning', text: 'Your recent scores are not rising yet; follow today’s plan.' },
    [ForecastStatus.FAR]: { tone: 'warning', text: 'At this pace the target is more than a year away.' },
    [ForecastStatus.ON_TRACK]: { tone: 'success', text: `At this pace you reach ${forecast.target} around ${forecast.date ? day(forecast.date) : ''}.` },
    [ForecastStatus.LATE]: { tone: 'warning', text: `At this pace you reach ${forecast.target} around ${forecast.date ? day(forecast.date) : ''}, after your exam.` },
  }[forecast.status];
}
