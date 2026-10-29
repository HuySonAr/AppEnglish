import { BookOpen, Headphones } from 'lucide-react';
import { ScoreRing } from './ScoreRing.jsx';
import { TestReview } from './TestReview.jsx';

const TOTAL_MIN = 10;
const TOTAL_MAX = 990;
const SECTION_MAX = 495;
const share = (value, min, max) => `${Math.max(0, Math.min(100, ((value - min) * 100) / (max - min)))}%`;

function SectionScore({ icon: Icon, label, score, margin, correct, total }) {
  return (
    <div className="space-y-2 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </p>
        {total ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            {correct}/{total} correct
          </p>
        ) : null}
      </div>
      <p className="text-3xl font-bold tabular-nums">
        {score}
        {margin ? <span className="text-base font-semibold text-primary"> ±{margin}</span> : null}
        <span className="text-base font-normal text-muted-foreground"> / {SECTION_MAX}</span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: share(score, 5, SECTION_MAX) }} />
      </div>
    </div>
  );
}

function ToeicScore({ label, attempt }) {
  const { estimated } = attempt;
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="space-y-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              {label} · attempt {attempt.attemptNumber}
            </p>
            <p className="mt-1 text-sm font-medium">Estimated TOEIC score</p>
            <p className="text-sm text-muted-foreground">Điểm TOEIC ước tính của cả bài thi (Listening + Reading)</p>
          </div>
          <p className="rounded-full bg-muted px-3 py-1 text-sm tabular-nums text-muted-foreground">
            {attempt.correctCount}/{attempt.totalCount} correct · {attempt.scorePercent}%
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <p className="text-7xl font-extrabold leading-none tracking-tight text-primary tabular-nums sm:text-8xl">{estimated.totalScore}</p>
          <p className="pb-2 text-2xl font-medium text-muted-foreground">/ {TOTAL_MAX}</p>
        </div>

        <div className="space-y-1">
          <div className="relative h-3 rounded-full bg-muted" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: share(estimated.totalScore, TOTAL_MIN, TOTAL_MAX) }} />
          </div>
          <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>{TOTAL_MIN}</span>
            <span>{TOTAL_MAX}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SectionScore icon={Headphones} label="Listening" score={estimated.listeningScore} margin={estimated.margin} correct={attempt.listeningCorrect} total={attempt.listeningTotal} />
          <SectionScore icon={BookOpen} label="Reading" score={estimated.readingScore} margin={estimated.margin} correct={attempt.readingCorrect} total={attempt.readingTotal} />
        </div>
        <p className="text-xs text-muted-foreground">An estimate on the TOEIC scale, not an official score.</p>
      </div>
    </div>
  );
}

function PercentScore({ label, attempt }) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card p-6 shadow-xs sm:flex-row sm:p-8">
      <ScoreRing percent={attempt.scorePercent} label="correct" />
      <div className="text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {label} · attempt {attempt.attemptNumber}
        </p>
        <p className="mt-1 text-lg font-semibold">
          {attempt.correctCount} of {attempt.totalCount} correct
        </p>
      </div>
    </div>
  );
}

export function MockAttemptResult({ label, attempt, parts }) {
  return (
    <div className="space-y-6">
      {attempt.estimated ? <ToeicScore label={label} attempt={attempt} /> : <PercentScore label={label} attempt={attempt} />}
      <h2 className="text-lg font-semibold">Answers and explanations</h2>
      <TestReview parts={parts} />
    </div>
  );
}
