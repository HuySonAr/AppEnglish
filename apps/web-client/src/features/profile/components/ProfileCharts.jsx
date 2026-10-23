import { Bar, BarChart, CartesianGrid, Cell, LabelList, PolarAngleAxis, RadialBar, RadialBarChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '../../../components/ui';

const listening = 'hsl(var(--chart-1))';
const reading = 'hsl(var(--chart-2))';
const track = 'hsl(var(--muted))';

function TipBox({ title, lines }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

export function SkillsChart({ bars }) {
  const data = bars.map((bar) => ({ ...bar, value: bar.percent ?? 0, fill: bar.key === 'listening' ? listening : reading }));
  return (
    <ChartContainer
      config={{ listening: { label: 'Listening', color: listening }, reading: { label: 'Reading', color: reading } }}
      className="aspect-auto h-36 w-full"
      role="img"
      aria-label={`Mastery: ${bars.map((bar) => `${bar.label} ${bar.percent === null ? 'no data' : `${bar.percent}%`}`).join(', ')}`}
    >
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 0 }} barCategoryGap={12}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} fontSize={11} />
        <YAxis type="category" dataKey="label" width={72} tickLine={false} axisLine={false} fontSize={12} className="fill-foreground" />
        <ChartTooltip
          cursor={false}
          content={({ active, payload }) => {
            const bar = active ? payload?.[0]?.payload : null;
            if (!bar) return null;
            return <TipBox title={bar.label} lines={[bar.percent === null ? 'No test yet' : `${bar.percent}% · best of ${bar.tests} test${bar.tests === 1 ? '' : 's'}`]} />;
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} background={{ fill: track, radius: 4 }} isAnimationActive={false} barSize={18}>
          {data.map((bar) => (
            <Cell key={bar.key} fill={bar.fill} />
          ))}
          <LabelList dataKey="percent" position="right" offset={8} fontSize={12} className="fill-foreground font-semibold" formatter={(value) => (value === null ? 'No data yet' : `${value}%`)} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function LessonsRing({ ring }) {
  const data = [{ name: 'Lessons', value: ring.percent ?? 0, fill: listening }];
  return (
    <ChartContainer
      config={{ value: { label: 'Lessons completed', color: listening } }}
      className="mx-auto aspect-square h-40"
      role="img"
      aria-label={ring.total ? `Lessons completed: ${ring.completed} of ${ring.total}` : 'No lesson is published yet'}
    >
      <RadialBarChart data={data} startAngle={90} endAngle={-270} innerRadius={56} outerRadius={76} barSize={14}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar dataKey="value" cornerRadius={8} background={{ fill: track }} isAnimationActive={false} />
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold tabular-nums">
          {ring.percent === null ? '—' : `${ring.percent}%`}
        </text>
        <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
          {ring.total ? `${ring.completed} of ${ring.total} lessons` : 'no lessons yet'}
        </text>
      </RadialBarChart>
    </ChartContainer>
  );
}

export function XpChart({ bars }) {
  return (
    <div className="overflow-x-auto">
      <ChartContainer
        config={{ xp: { label: 'XP', color: listening } }}
        className="aspect-auto h-56 w-full"
        style={{ minWidth: Math.max(bars.length * 72, 240) }}
        role="img"
        aria-label={`XP per mock test: ${bars.map((bar) => `${bar.title} ${bar.xp} XP`).join(', ')}`}
      >
        <BarChart data={bars} margin={{ top: 20, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="short" interval={0} tickLine={false} axisLine={false} fontSize={11} height={28} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} width={32} tickLine={false} axisLine={false} fontSize={11} />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              const bar = active ? payload?.[0]?.payload : null;
              if (!bar) return null;
              return <TipBox title={bar.title} lines={[`${bar.xp} XP · ${bar.correctCount}/${bar.totalCount} right`, new Date(bar.earnedAt).toLocaleDateString()]} />;
            }}
          />
          <Bar dataKey="xp" fill="var(--color-xp)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            <LabelList dataKey="xp" position="top" offset={6} fontSize={11} className="fill-foreground font-semibold" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
