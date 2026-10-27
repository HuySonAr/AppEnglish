import { CheckCircle2, Clock, FileText, Timer } from 'lucide-react';
import { PracticePromptKind } from '@appenglish/content-contracts';
import { Badge } from '../ui/badge.jsx';
import { countWords, etsFields, etsTaskLabel, etsTaskOf, etsTimingParts, kindLabels, taskTypeLabels } from '../../lib/practice-prompts.js';
import { PassageText } from './PassageText.jsx';

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function TimingLine({ task }) {
  const parts = etsTimingParts(task);
  if (!parts.length) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <Timer className="h-4 w-4" />
      {parts.map((part) => `${part.label} ${part.value}`).join(' · ')}
    </p>
  );
}

export function PracticePromptView({ kind, content, media = {} }) {
  const url = (id) => (id && media[id]?.url) || null;
  const task = etsTaskOf(kind, content);
  const fields = task && kind !== PracticePromptKind.READ_ALOUD ? etsFields(kind, task) : null;
  const show = (name) => (fields ? fields[name] : !['context', 'info', 'questions', 'keywords', 'email'].includes(name));
  const questions = content.questions || [];
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{kindLabels[kind]}</Badge>
          <Badge variant="outline">{content.level}</Badge>
          {task ? <Badge variant="info">{etsTaskLabel(task)}</Badge> : <Badge variant="warning">No task type</Badge>}
          {content.topic ? <span className="text-sm text-muted-foreground">{content.topic}</span> : null}
          {kind === PracticePromptKind.WRITING && !task && content.taskType ? <span className="text-sm text-muted-foreground">· {taskTypeLabels[content.taskType]}</span> : null}
        </div>
        <h2 className="text-xl font-semibold">{content.title || 'Untitled prompt'}</h2>
        <TimingLine task={task} />
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
            {show('image') && url(content.imageMediaId) ? <img src={url(content.imageMediaId)} alt="" className="max-h-72 rounded-lg border" /> : null}
            {show('image') && fields?.imageRequired && !url(content.imageMediaId) ? <p className="text-sm text-muted-foreground">No picture.</p> : null}
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {kind === PracticePromptKind.WRITING ? (
                <>
                  <FileText className="h-4 w-4" />
                  {content.minWords}–{content.maxWords} words
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  Up to {content.maxSeconds} seconds{task ? ' without timer' : ''}
                </>
              )}
            </p>
          </Section>
          {show('keywords') ? (
            <Section title="Words to use">
              <div className="flex flex-wrap gap-1.5">
                {(content.keywords || []).map((word, index) => (
                  <Badge key={index} variant="outline" className="text-sm">
                    {word || '—'}
                  </Badge>
                ))}
              </div>
            </Section>
          ) : null}
          {show('email') ? (
            <Section title="Email to reply to">
              <p className="whitespace-pre-line rounded-xl border bg-muted/30 p-4 leading-relaxed">{content.email || '—'}</p>
            </Section>
          ) : null}
          {show('context') ? (
            <Section title="Context">
              <p className="whitespace-pre-line leading-relaxed">{content.context || '—'}</p>
            </Section>
          ) : null}
          {show('info') ? (
            <Section title="Information">
              <div className="rounded-xl border bg-muted/30 p-4 text-sm">{content.info ? <PassageText text={content.info} /> : '—'}</div>
            </Section>
          ) : null}
          {show('questions') ? (
            <Section title="Questions">
              <ol className="space-y-3">
                {questions.map((question, index) => (
                  <li key={index} className="space-y-2 rounded-xl border p-4">
                    <p className="font-medium">
                      {index + 1}. {question.text || '—'}
                    </p>
                    {url(question.audioMediaId) ? <audio controls src={url(question.audioMediaId)} className="w-full" /> : <p className="text-sm text-muted-foreground">No audio.</p>}
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sample answer · {countWords(question.sampleAnswer)} words</p>
                    <p className="whitespace-pre-line rounded-lg bg-muted/30 p-3 text-sm leading-relaxed">{question.sampleAnswer || '—'}</p>
                  </li>
                ))}
                {!questions.length ? <li className="text-sm text-muted-foreground">No questions yet.</li> : null}
              </ol>
            </Section>
          ) : null}
          {show('sampleAnswer') ? (
            <Section title={`Sample answer · ${countWords(content.sampleAnswer)} words`}>
              <p className="whitespace-pre-line rounded-xl border bg-muted/30 p-4 leading-relaxed">{content.sampleAnswer || '—'}</p>
            </Section>
          ) : null}
          {show('keyPoints') && content.keyPoints?.length ? (
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
