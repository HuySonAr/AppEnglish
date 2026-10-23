import { AlertCircle, Loader2 } from 'lucide-react';
import { SubmissionStatus } from '@appenglish/learning-contracts';
import { cn } from '../../../lib/utils.js';
import { wordCounts, wordLabels, wordStyles } from '../lib/practice.js';
import { ScoreSummary } from './PracticeScore.jsx';
import { OpenSpeakingResult } from './OpenSpeakingResult.jsx';

const metrics = [
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'completeness', label: 'Completeness' },
  { key: 'fluency', label: 'Fluency' },
];

export function SpeakingResult({ submission }) {
  if (submission.kind === 'open_speaking') return <OpenSpeakingResult submission={submission} />;
  if (submission.status === SubmissionStatus.SCORING)
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>Scoring your reading…</span>
      </div>
    );

  if (submission.status === SubmissionStatus.FAILED)
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">Could not score this recording</p>
          <p className="text-muted-foreground">{submission.error || 'Record again and submit.'}</p>
        </div>
      </div>
    );

  const { result } = submission;
  const counts = wordCounts(result.words);

  return (
    <div className="space-y-5">
      <ScoreSummary total={result.scores.total} bars={metrics.map((metric) => ({ label: metric.label, value: result.scores[metric.key] }))} />

      <div className="space-y-2">
        <p className="text-lg leading-loose">
          {result.words.map((word, index) => (
            <span key={index}>
              <span className={cn(word.status ? wordStyles[word.status] : '')} title={word.status ? wordLabels[word.status] : undefined}>
                {word.text}
              </span>{' '}
            </span>
          ))}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {Object.entries(counts).map(([status, count]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={cn('font-semibold', wordStyles[status])}>Aa</span>
              {wordLabels[status]} {count}
            </span>
          ))}
          <span>{result.wordsPerMinute} words per minute</span>
          <span>
            {result.pauses} long pause{result.pauses === 1 ? '' : 's'}
          </span>
        </div>
        {result.extra.length ? <p className="text-sm text-muted-foreground">Extra words heard: {result.extra.join(', ')}</p> : null}
      </div>

      {submission.recordingUrl ? <audio controls src={submission.recordingUrl} className="w-full" /> : null}
      <p className="text-xs text-muted-foreground">Automatic scoring can miss small pronunciation mistakes.</p>
    </div>
  );
}
