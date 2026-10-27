import { useState } from 'react';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SubmissionStatus, geminiModelLabel } from '@appenglish/learning-contracts';
import { AnnotatedText, BetterVersion, CorrectionList, LanguageSwitch } from './PracticeFeedback.jsx';
import { EtsScore, ScoreBar, ScoreSummary } from './PracticeScore.jsx';

const geminiBars = [
  { key: 'task', label: 'Task' },
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'grammar', label: 'Grammar' },
  { key: 'coherence', label: 'Coherence' },
];

function WhisperBars({ scores }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ScoreBar label="Fluency" value={scores.fluency} />
      <ScoreBar label="Pronunciation" value={scores.pronunciation} />
    </div>
  );
}

export function OpenSpeakingResult({ submission, hasKey = false }) {
  const [lang, setLang] = useState('en');
  const { status, result } = submission;
  if (status === SubmissionStatus.SCORING && submission.stage !== 'grading')
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>Listening to your answer…</span>
      </div>
    );

  const gemini = result?.gemini;
  const scores = result?.scores;
  return (
    <div className="space-y-5">
      {status === SubmissionStatus.SCORING ? (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Gemini is scoring your answer…</span>
        </div>
      ) : null}
      {status === SubmissionStatus.FAILED ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Could not score this answer</p>
            <p className="text-muted-foreground">{submission.error}</p>
          </div>
        </div>
      ) : null}

      {status === SubmissionStatus.DONE && scores?.total !== null && scores?.total !== undefined ? (
        <>
          <ScoreSummary total={scores.total} bars={geminiBars.map((bar) => ({ label: bar.label, value: scores[bar.key], max: 5 }))} />
          <WhisperBars scores={scores} />
          <EtsScore ets={result.ets} />
        </>
      ) : scores ? (
        <WhisperBars scores={scores} />
      ) : null}
      {status === SubmissionStatus.DONE && !gemini && !hasKey ? (
        <p className="flex items-center gap-2 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          <KeyRound className="h-4 w-4 text-primary" />
          <span>
            <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
              Add your Gemini key
            </Link>{' '}
            to get a full score.
          </span>
        </p>
      ) : null}

      {gemini?.feedback ? (
        <div className="space-y-2">
          {gemini.feedbackVi ? (
            <div className="flex justify-end">
              <LanguageSwitch lang={lang} onChange={setLang} />
            </div>
          ) : null}
          <p className="leading-relaxed">{lang === 'vi' && gemini.feedbackVi ? gemini.feedbackVi : gemini.feedback}</p>
        </div>
      ) : null}
      {result?.transcript ? <AnnotatedText title="What we heard" text={result.transcript} errors={gemini?.errors} /> : null}
      {result ? (
        <p className="text-xs text-muted-foreground">
          {result.wordsPerMinute} words per minute · {result.pauses} long pause{result.pauses === 1 ? '' : 's'} · {result.fillers} filler{result.fillers === 1 ? '' : 's'}
        </p>
      ) : null}
      <CorrectionList errors={gemini?.errors} lang={lang} />
      <BetterVersion text={gemini?.rewrite} />
      {submission.recordingUrl ? <audio controls src={submission.recordingUrl} className="w-full" /> : null}
      {result ? <p className="text-xs text-muted-foreground">{gemini?.model ? `Scored by ${geminiModelLabel(gemini.model)}. ` : ''}Gemini reads a transcript and cannot hear your voice.</p> : null}
    </div>
  );
}
