import { ArrowDown, ArrowUp, BookOpen, Flag, Headphones, Minus, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { TestTrend } from '@appenglish/learning-contracts';
import { cn } from '../../../lib/utils.js';
import { ScoreChart } from './ScoreChart.jsx';

const trends = {
  [TestTrend.IMPROVED]: {
    icon: TrendingUp,
    tone: 'border-success/40 bg-success/10 text-success',
    title: 'You are improving',
  },
  [TestTrend.DECLINED]: {
    icon: TrendingDown,
    tone: 'border-destructive/40 bg-destructive/10 text-destructive',
    title: 'Your last result went down',
  },
  [TestTrend.UNCHANGED]: {
    icon: Minus,
    tone: 'border-border bg-muted/50 text-muted-foreground',
    title: 'Your result stayed the same',
  },
};

const signed = (value) => (value > 0 ? `+${value}` : String(value));

function Change({ icon: Icon, label, value }) {
  const Direction = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('flex items-center gap-1 text-lg font-bold tabular-nums', tone)}>
          <Direction className="h-4 w-4" />
          {signed(value)}
        </p>
      </div>
    </div>
  );
}

export function TestProgression({ attempts, progression, passPercent }) {
  if (!progression) return null;
  const trend = trends[progression.trend];
  const latest = attempts.at(-1);
  const previous = attempts.at(-2);
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', trend.tone)}>
        <trend.icon className="h-6 w-6 shrink-0" />
        <div>
          <p className="font-semibold">{trend.title}</p>
          <p className="text-sm text-foreground">
            Attempt {latest.attemptNumber}: {latest.scorePercent}% · attempt {previous.attemptNumber}:{' '}
            {previous.scorePercent}% ({signed(progression.changeFromPrevious)} right answer
            {Math.abs(progression.changeFromPrevious) === 1 ? '' : 's'})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Change icon={Headphones} label="Listening vs last time" value={progression.listeningChange} />
        <Change icon={BookOpen} label="Reading vs last time" value={progression.readingChange} />
        <Change icon={Target} label="Total vs last time" value={progression.changeFromPrevious} />
        <Change icon={Flag} label="Total vs first attempt" value={progression.changeFromFirst} />
      </div>

      <ScoreChart attempts={attempts} passPercent={passPercent} />
    </div>
  );
}
