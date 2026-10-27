import { useState } from 'react';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SubmissionStatus, geminiModelLabel } from '@appenglish/learning-contracts';
import { cn } from '../../../lib/utils.js';
import { wordCounts, wordLabels, wordStyles } from '../lib/practice.js';
import { EtsScore, ScoreSummary } from './PracticeScore.jsx';
import { FeedbackSection, LanguageSwitch } from './PracticeFeedback.jsx';
import { OpenSpeakingResult } from './OpenSpeakingResult.jsx';

const metrics = [
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'completeness', label: 'Completeness' },
  { key: 'fluency', label: 'Fluency' },
];

function PointList({ title, items }) {
  if (!items?.length) return null;
  return (
    <FeedbackSection title={title}>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </FeedbackSection>
  );
}

function ReadingFeedback({ submission, hasKey }) {
  const [lang, setLang] = useState('en');
  const { result } = submission;
  const gemini = result.gemini;
  const shown = lang === 'vi' && gemini?.vi ? gemini.vi : gemini;
  if (submission.stage === 'grading')
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>Gemini is writing feedback…</span>
      </div>
    );
  if (result.geminiError) return <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">No feedback this time: {result.geminiError}</p>;
  if (!gemini && hasKey) return null;
  if (!gemini)
    return (
      <p className="flex items-center gap-2 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <KeyRound className="h-4 w-4 text-primary" />
        <span>
          <Link to="/student/gemini-key" className="font-medium text-primary underline-offset-4 hover:underline">
            Add your Gemini key
          </Link>{' '}
          to get feedback.
        </span>
      </p>
    );
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feedback</p>
        {gemini.vi ? <LanguageSwitch lang={lang} onChange={setLang} /> : null}
      </div>
      <p className="leading-relaxed">{shown.feedback}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <PointList title={lang === 'vi' && gemini.vi ? 'Điểm tốt' : 'What went well'} items={shown.strengths} />
        <PointList title={lang === 'vi' && gemini.vi ? 'Cần cải thiện' : 'To score higher'} items={shown.improvements} />
      </div>
      {gemini.practiceWords?.length ? (
        <FeedbackSection title="Words to practise">
          <div className="flex flex-wrap gap-1.5">
            {gemini.practiceWords.map((word) => (
              <span key={word} className="rounded-md border bg-muted/40 px-2 py-1 text-sm font-medium">
                {word}
              </span>
            ))}
          </div>
        </FeedbackSection>
      ) : null}
      <p className="text-xs text-muted-foreground">{gemini.model ? `Written by ${geminiModelLabel(gemini.model)}. ` : ''}Gemini reads what the recogniser heard and cannot hear your voice.</p>
    </div>
  );
}

export function SpeakingResult({ submission, hasKey = false }) {
  if (submission.kind === 'open_speaking') return <OpenSpeakingResult submission={submission} hasKey={hasKey} />;
  if (submission.status === SubmissionStatus.SCORING && submission.stage !== 'grading')
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
      <EtsScore ets={result.ets} />
      <ReadingFeedback submission={submission} hasKey={hasKey} />

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

      {result.heard ? (
        <FeedbackSection title="What we heard">
          <p className="rounded-xl border bg-muted/30 p-4 leading-relaxed">{result.heard}</p>
        </FeedbackSection>
      ) : null}

      {submission.recordingUrl ? <audio controls src={submission.recordingUrl} className="w-full" /> : null}
      <p className="text-xs text-muted-foreground">Automatic scoring can miss small pronunciation mistakes.</p>
    </div>
  );
}
