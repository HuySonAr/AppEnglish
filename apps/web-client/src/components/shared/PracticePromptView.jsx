import { CheckCircle2, Clock, FileText } from 'lucide-react';
import { PracticePromptKind } from '@appenglish/content-contracts';
import { Badge } from '../ui/badge.jsx';
import { countWords, kindLabels, taskTypeLabels } from '../../lib/practice-prompts.js';

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function PracticePromptView({ kind, content, media = {} }) {
  const url = (id) => (id && media[id]?.url) || null;
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{kindLabels[kind]}</Badge>
          <Badge variant="outline">{content.level}</Badge>
          {content.topic ? <span className="text-sm text-muted-foreground">{content.topic}</span> : null}
          {kind === PracticePromptKind.WRITING ? <span className="text-sm text-muted-foreground">· {taskTypeLabels[content.taskType]}</span> : null}
        </div>
        <h2 className="text-xl font-semibold">{content.title || 'Untitled prompt'}</h2>
      </div>

      {kind === PracticePromptKind.READ_ALOUD ? (
        <Section title="Text to read">
          <p className="rounded-xl border bg-muted/30 p-4 text-lg leading-relaxed">{content.text || '—'}</p>
          {url(content.audioMediaId) ? <audio controls src={url(content.audioMediaId)} className="w-full" /> : <p className="text-sm text-muted-foreground">No model audio.</p>}
        </Section>
      ) : (
        <>
          <Section title="Instructions">
            <p className="whitespace-pre-line leading-relaxed">{content.instructions || '—'}</p>
            {url(content.imageMediaId) ? <img src={url(content.imageMediaId)} alt="" className="max-h-72 rounded-lg border" /> : null}
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {kind === PracticePromptKind.WRITING ? (
                <>
                  <FileText className="h-4 w-4" />
                  {content.minWords}–{content.maxWords} words
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  Up to {content.maxSeconds} seconds
                </>
              )}
            </p>
          </Section>
          <Section title={`Sample answer · ${countWords(content.sampleAnswer)} words`}>
            <p className="whitespace-pre-line rounded-xl border bg-muted/30 p-4 leading-relaxed">{content.sampleAnswer || '—'}</p>
          </Section>
          {content.keyPoints?.length ? (
            <Section title="Key points">
              <ul className="space-y-1.5">
                {content.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {point}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
