import { ArrowDown, ArrowUp, BookOpen, Flag, Headphones, Minus, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { TestTrend } from '@appenglish/learning-contracts';
import { cn } from '../../../lib/utils.js';
import { ScoreChart } from './ScoreChart.jsx';
import { SectionTrend, overallSectionTrend, sectionTrendLabel } from '../lib/mock-exam.js';

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

const sectionTrends = {
  [SectionTrend.UP]: { trend: TestTrend.IMPROVED, title: 'Your estimate went up' },
  [SectionTrend.DOWN]: { trend: TestTrend.DECLINED, title: 'Your estimate went down' },
  [SectionTrend.SAME]: { trend: TestTrend.UNCHANGED, title: 'Your estimate is about the same' },
};
const trendDirection = { [SectionTrend.UP]: 1, [SectionTrend.DOWN]: -1, [SectionTrend.SAME]: 0 };

const signed = (value) => (value > 0 ? `+${value}` : String(value));

function Change({ icon: Icon, label, value, direction = value, text, note }) {
  const Direction = direction > 0 ? ArrowUp : direction < 0 ? ArrowDown : Minus;
  const tone = direction > 0 ? 'text-success' : direction < 0 ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('flex items-center gap-1 text-lg font-bold tabular-nums', tone)}>
          <Direction className="h-4 w-4" />
          {text ?? signed(value)}
        </p>
        {note ? <p className="text-xs tabular-nums text-muted-foreground">{note}</p> : null}
      </div>
    </div>
  );
}

export function TestProgression({ attempts, progression, passPercent }) {
  if (!progression) return null;
  const section = overallSectionTrend(progression);
  const trend = section ? { ...trends[sectionTrends[section].trend], title: sectionTrends[section].title } : trends[progression.trend];
  const latest = attempts.at(-1);
  const previous = attempts.at(-2);
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
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
        {section ? (
          <>
            <Change
              icon={Headphones}
              label="Listening vs last time"
              direction={trendDirection[progression.listeningTrend]}
              text={sectionTrendLabel(progression.listeningTrend)}
              note={`${signed(progression.listeningScoreChange)} points`}
            />
            <Change
              icon={BookOpen}
              label="Reading vs last time"
              direction={trendDirection[progression.readingTrend]}
              text={sectionTrendLabel(progression.readingTrend)}
              note={`${signed(progression.readingScoreChange)} points`}
            />
          </>
        ) : (
          <>
            <Change icon={Headphones} label="Listening vs last time" value={progression.listeningChange} />
            <Change icon={BookOpen} label="Reading vs last time" value={progression.readingChange} />
          </>
        )}
        <Change icon={Target} label="Total vs last time" value={progression.changeFromPrevious} />
        <Change icon={Flag} label="Total vs first attempt" value={progression.changeFromFirst} />
      </div>

      <ScoreChart attempts={attempts} passPercent={passPercent} />
    </div>
  );
}
