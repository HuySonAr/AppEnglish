import { LineChart as LineIcon } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { cn } from '../../../lib/utils.js';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../../components/ui';
import { forecastMessage, scoreForecast } from '../lib/score-forecast.js';

const chartConfig = {
  score: { label: 'Estimated score', color: 'hsl(var(--chart-1))' },
  forecast: { label: 'Forecast', color: 'hsl(var(--chart-2))' },
};
const toneText = { success: 'text-success', warning: 'text-warning', muted: 'text-muted-foreground' };
const shortDay = (value) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function ScoreForecastCard({ data }) {
  const forecast = scoreForecast(data);
  if (!forecast) return null;
  const message = forecastMessage(forecast);
  const examTime = forecast.examDate ? new Date(`${forecast.examDate}T00:00:00`).getTime() : null;
  const rows = [
    ...forecast.history.map((point) => ({ t: new Date(point.at).getTime(), score: point.total, forecast: null })),
    ...forecast.projection.map((point, index) => ({ t: new Date(point.at).getTime(), score: index === 0 ? forecast.history.at(-1).total : null, forecast: point.total })),
  ].sort((a, b) => a.t - b.t);
  const merged = rows.reduce((list, row) => {
    const same = list.find((item) => item.t === row.t);
    if (same) Object.assign(same, { score: row.score ?? same.score, forecast: row.forecast ?? same.forecast });
    else list.push({ ...row });
    return list;
  }, []);
  const times = merged.map((row) => row.t).concat(examTime ? [examTime] : []);
  const values = merged.flatMap((row) => [row.score, row.forecast]).filter((value) => value !== null).concat(forecast.target);
  const low = Math.max(10, Math.floor((Math.min(...values) - 50) / 50) * 50);
  const high = Math.min(990, Math.ceil((Math.max(...values) + 50) / 50) * 50);

  return (
    <div className="space-y-3 rounded-3xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <LineIcon className="h-4 w-4 text-primary" />
            Your score path
          </h2>
          <p className={cn('text-sm', toneText[message.tone])}>{message.text}</p>
        </div>
        {forecast.perWeek !== null ? (
          <p className="rounded-full bg-muted px-3 py-1 text-xs tabular-nums text-muted-foreground">
            {forecast.perWeek > 0 ? '+' : ''}
            {forecast.perWeek} points a week lately
          </p>
        ) : null}
      </div>
      {forecast.history.length ? (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-56 w-full"
          role="img"
          aria-label={`Estimated scores: ${forecast.history.map((point) => `${shortDay(point.at)} ${point.total}`).join(', ')}. Target ${forecast.target}.`}
        >
          <LineChart data={merged} margin={{ top: 16, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={[Math.min(...times), Math.max(...times)]} tickFormatter={shortDay} tickLine={false} axisLine={false} fontSize={11} minTickGap={24} />
            <YAxis domain={[low, high]} tickLine={false} axisLine={false} fontSize={11} width={40} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => (payload?.[0] ? shortDay(payload[0].payload.t) : '')} />} />
            <ReferenceLine y={forecast.target} stroke="hsl(var(--success))" strokeDasharray="4 4" label={{ value: `Target ${forecast.target}`, position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--success))' }} />
            {examTime ? <ReferenceLine x={examTime} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" label={{ value: 'Exam', position: 'insideTopLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /> : null}
            <Line dataKey="score" type="monotone" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
            <Line dataKey="forecast" type="linear" stroke="var(--color-forecast)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      ) : null}
    </div>
  );
}

export function SwForecastCard() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <LineIcon className="h-4 w-4 text-primary" />
        Speaking & Writing score path
      </h2>
      <p className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Appears after scoring</p>
    </div>
  );
}
