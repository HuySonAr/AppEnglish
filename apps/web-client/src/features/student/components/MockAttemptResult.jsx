import { Headphones, BookOpen, Sigma } from 'lucide-react';
import { ScoreRing } from './ScoreRing.jsx';
import { TestReview } from './TestReview.jsx';

function ScoreTile({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function MockAttemptResult({ label, attempt, parts }) {
  const { estimated } = attempt;
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col items-center gap-6 bg-card p-6 sm:flex-row sm:p-8">
          <ScoreRing percent={attempt.scorePercent} label="correct" />
          <div className="min-w-0 flex-1 space-y-4 text-center sm:text-left">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                {label} · attempt {attempt.attemptNumber}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {attempt.correctCount} of {attempt.totalCount} correct
              </p>
            </div>
            {estimated ? (
              <div className="grid grid-cols-3 gap-3">
                <ScoreTile icon={Sigma} label="Estimated" value={estimated.totalScore} detail="of 990" />
                <ScoreTile icon={Headphones} label="Listening" value={estimated.listeningScore} detail={attempt.listeningTotal ? `${attempt.listeningCorrect}/${attempt.listeningTotal}` : undefined} />
                <ScoreTile icon={BookOpen} label="Reading" value={estimated.readingScore} detail={attempt.readingTotal ? `${attempt.readingCorrect}/${attempt.readingTotal}` : undefined} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <h2 className="text-lg font-semibold">Answers and explanations</h2>
      <TestReview parts={parts} />
    </div>
  );
}
