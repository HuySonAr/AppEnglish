import { AlertCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SubmissionStatus } from '@appenglish/learning-contracts';
import { writingGroups } from '../lib/writing.js';
import { AnnotatedText, BetterVersion, CorrectionList, PromptReference } from './PracticeFeedback.jsx';
import { ScoreSummary } from './PracticeScore.jsx';

export function WritingResult({ submission }) {
  const { status, result } = submission;
  let head = null;
  if (status === SubmissionStatus.SCORING)
    head = (
      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>Gemini is scoring your text…</span>
      </div>
    );
  else if (status === SubmissionStatus.SAVED)
    head = (
      <div className="rounded-xl border bg-muted/40 p-4 text-sm">
        <p className="font-medium">Saved without a score</p>
        <p className="text-muted-foreground">
          <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
            Add your Gemini key
          </Link>{' '}
          to score your next text.
        </p>
      </div>
    );
  else if (status === SubmissionStatus.FAILED)
    head = (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">Could not score this text</p>
          <p className="text-muted-foreground">{submission.error}</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-5">
      {head}
      {status === SubmissionStatus.DONE ? <ScoreSummary total={result.scores.total} max={5} bars={writingGroups.map((group) => ({ label: group.label, value: result.scores[group.key] }))} /> : null}
      {result?.feedback ? <p className="leading-relaxed">{result.feedback}</p> : null}
      <AnnotatedText title={`Your text · ${submission.words} words`} text={submission.answer} errors={result?.errors} />
      <CorrectionList errors={result?.errors} />
      <BetterVersion text={result?.rewrite} />
      <PromptReference sampleAnswer={submission.prompt.sampleAnswer} keyPoints={submission.prompt.keyPoints} />
      {status === SubmissionStatus.DONE ? <p className="text-xs text-muted-foreground">Scored by Gemini; it can be wrong.</p> : null}
    </div>
  );
}
