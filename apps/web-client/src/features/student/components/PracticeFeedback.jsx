import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { errorSegments } from '../lib/writing.js';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
];

export function LanguageSwitch({ lang, onChange }) {
  return (
    <div className="inline-flex rounded-full border bg-muted/40 p-0.5" role="group" aria-label="Feedback language">
      {LANGUAGES.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={lang === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            lang === item.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function FeedbackSection({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function AnnotatedText({ title, text, errors = [] }) {
  const segments = errorSegments(text, errors);
  return (
    <FeedbackSection title={title}>
      <p className="whitespace-pre-line rounded-xl border p-4 leading-relaxed">
        {segments.map((segment, index) =>
          segment.error === undefined ? (
            <span key={index}>{segment.text}</span>
          ) : (
            <mark key={index} className="rounded bg-destructive/10 px-0.5 text-foreground underline decoration-destructive decoration-wavy underline-offset-4" title={errors[segment.error].suggestion}>
              {segment.text}
              <sup className="ml-0.5 text-[10px] font-semibold text-destructive">{segment.error + 1}</sup>
            </mark>
          ),
        )}
      </p>
    </FeedbackSection>
  );
}

export function CorrectionList({ errors = [], lang = 'en' }) {
  if (!errors.length) return null;
  return (
    <FeedbackSection title="Corrections">
      <ol className="space-y-2">
        {errors.map((error, index) => (
          <li key={index} className="flex gap-3 rounded-xl border p-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-xs font-semibold text-destructive">{index + 1}</span>
            <div className="min-w-0 space-y-0.5">
              <p>
                <span className="text-destructive line-through">{error.text}</span> → <span className="font-medium text-success">{error.suggestion}</span>
              </p>
              <p className="text-muted-foreground">{lang === 'vi' && error.explanationVi ? error.explanationVi : error.explanation}</p>
            </div>
          </li>
        ))}
      </ol>
    </FeedbackSection>
  );
}

export function BetterVersion({ text }) {
  if (!text) return null;
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer text-sm font-medium">A better version</summary>
      <p className="mt-3 whitespace-pre-line leading-relaxed">{text}</p>
    </details>
  );
}

export function PromptReference({ sampleAnswer, keyPoints = [] }) {
  return (
    <>
      {sampleAnswer ? (
        <FeedbackSection title="Sample answer">
          <p className="whitespace-pre-line rounded-xl border bg-muted/30 p-4 leading-relaxed">{sampleAnswer}</p>
        </FeedbackSection>
      ) : null}
      {keyPoints.length ? (
        <FeedbackSection title="Key points">
          <ul className="space-y-1.5">
            {keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {point}
              </li>
            ))}
          </ul>
        </FeedbackSection>
      ) : null}
    </>
  );
}
