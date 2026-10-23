import { useState } from 'react';
import { CartesianGrid, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Button, ChartContainer, ChartTooltip } from '../../../components/ui';
import { SCORE_CHART_LATEST, scoreChartPoints } from '../lib/score-chart.js';

const chartConfig = { scorePercent: { label: 'Score', color: 'hsl(var(--chart-1))' } };
const success = 'hsl(var(--success))';
const POINT_WIDTH = 56;

const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const monthName = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

function AttemptTick({ x, y, payload, points }) {
  const point = points.find((item) => item.attemptNumber === payload.value);
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={11} className="fill-muted-foreground tabular-nums">
      <tspan x={x} dy={12} className={point?.latest ? 'fill-foreground font-semibold' : undefined}>
        #{payload.value}
      </tspan>
      <tspan x={x} dy={13}>
        {point ? shortDate(point.submittedAt) : ''}
      </tspan>
    </text>
  );
}

function PointTooltip({ active, payload, passPercent }) {
  const point = active ? payload?.[0]?.payload : null;
  if (!point) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">Attempt {point.attemptNumber}</p>
      <p className="text-muted-foreground">{new Date(point.submittedAt).toLocaleString()}</p>
      <p className="mt-1 text-sm font-bold tabular-nums">
        {point.scorePercent}%{passPercent ? (point.passed ? ' · passed' : ' · not passed') : ''}
      </p>
    </div>
  );
}

export function ScoreChart({ attempts, passPercent }) {
  const [all, setAll] = useState(false);
  const points = scoreChartPoints(attempts, { all });
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Score of each attempt</p>
        {attempts.length > SCORE_CHART_LATEST ? (
          <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
            {all ? `Show the latest ${SCORE_CHART_LATEST}` : `Show all ${attempts.length} attempts`}
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-60 w-full"
          style={{ minWidth: points.length * POINT_WIDTH }}
          role="img"
          aria-label={`Score of each attempt: ${points.map((point) => `attempt ${point.attemptNumber} ${point.scorePercent}%`).join(', ')}`}
        >
          <LineChart data={points} margin={{ top: 24, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="attemptNumber"
              interval={0}
              height={36}
              tickLine={false}
              axisLine={false}
              padding={{ left: 20, right: 20 }}
              tick={<AttemptTick points={points} />}
            />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={44} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
            {points
              .filter((point) => point.newMonth)
              .map((point) => (
                <ReferenceLine
                  key={point.attemptNumber}
                  x={point.attemptNumber}
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.4}
                  strokeDasharray="2 4"
                  label={{ value: monthName(point.submittedAt), position: 'insideBottomLeft', fontSize: 10, className: 'fill-muted-foreground' }}
                />
              ))}
            {passPercent ? (
              <ReferenceLine
                y={passPercent}
                stroke={success}
                strokeDasharray="6 4"
                label={{ value: `Pass ${passPercent}%`, position: 'insideBottomRight', fontSize: 10, fill: success }}
              />
            ) : null}
            <ChartTooltip cursor={false} content={<PointTooltip passPercent={passPercent} />} />
            <Line
              dataKey="scorePercent"
              type="linear"
              stroke="var(--color-scorePercent)"
              strokeWidth={2}
              isAnimationActive={false}
              dot={({ key, cx, cy, payload }) => (
                <circle
                  key={key}
                  cx={cx}
                  cy={cy}
                  r={payload.latest ? 6 : 4}
                  fill={payload.passed ? success : 'var(--color-scorePercent)'}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              )}
              activeDot={{ r: 6 }}
            >
              <LabelList dataKey="scorePercent" position="top" offset={10} fontSize={11} className="fill-foreground font-semibold" formatter={(value) => `${value}%`} />
            </Line>
          </LineChart>
        </ChartContainer>
      </div>
      {passPercent ? (
        <p className="mt-2 text-xs text-muted-foreground">Green points reached the pass mark of {passPercent}%.</p>
      ) : null}
    </div>
  );
}
