import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, ChevronLeft, ChevronRight, Eye, GripVertical, Lightbulb, Play, RotateCcw, Trophy, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CourseDictationMode, LearningResponseCode } from '@appenglish/learning-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Card, CardContent, Input } from '../../../components/ui';
import { StepNav, StepState } from '../../../components/shared/StepNav.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { useHeldPlayer } from '../../../hooks/use-held-player.js';
import { useReturnTo } from '../../../hooks/use-return-to.js';
import { completeCourseTopic, getCourseTopic } from '../api/course-api.js';
import { CourseQuestion } from '../components/CourseQuestion.jsx';
import { RecordingPanel, useAudioState } from '../components/RecordingPanel.jsx';
import { Pronunciation } from '../components/VocabularyStudy.jsx';
import { WordFlipCard } from '../components/WordFlipCard.jsx';
import { activeSentence, blankMark, courseTopicPath, moveItem, orderingResult, splitWords, typingMarks } from '../lib/listening-course.js';

const Part = Object.freeze({ VOCABULARY: 'vocabulary', QUESTIONS: 'questions', ORDERING: 'ordering', DICTATION: 'dictation', TRANSCRIPT: 'transcript' });
const partLabels = { vocabulary: 'Vocabulary', questions: 'Questions', ordering: 'Order', dictation: 'Dictation', transcript: 'Transcript' };

const knownKey = (topicId) => `appenglish.course.known.${topicId}`;

function readKnown(topicId) {
  try {
    const value = JSON.parse(window.localStorage.getItem(knownKey(topicId)) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function writeKnown(topicId, known) {
  try {
    window.localStorage.setItem(knownKey(topicId), JSON.stringify([...known]));
  } catch {
    return;
  }
}

function WordCard({ word, known, onKnown }) {
  return (
    <div className="space-y-2">
      <WordFlipCard
        label={`${word.word}: show or hide the meaning`}
        highlight={known}
        front={
          <>
            <span className="text-2xl font-bold">{word.word}</span>
            <span className="text-sm text-muted-foreground">{word.phonetic}</span>
            <span className="mt-2 text-xs text-muted-foreground">Tap to see the meaning</span>
          </>
        }
        back={
          <>
            <span className="text-lg font-semibold">{word.meaning}</span>
            <span className="text-sm text-muted-foreground">{word.word}</span>
          </>
        }
      />
      <div className="flex items-center gap-2">
        <Pronunciation label="Listen" url={word.audioUrl} />
        <Button variant={known ? 'secondary' : 'ghost'} size="sm" className={cn('ml-auto gap-1.5', known && 'text-success')} aria-pressed={known} onClick={onKnown}>
          <Check className="h-4 w-4" />
          {known ? 'Known' : 'I know it'}
        </Button>
      </div>
    </div>
  );
}

function VocabularyPart({ words, known, onKnown }) {
  if (!words.length) return <p className="text-sm text-muted-foreground">This topic has no word list.</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(known.size * 100) / words.length}%` }} />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {known.size} of {words.length} known
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {words.map((word) => (
          <WordCard key={word.id} word={word} known={known.has(word.id)} onKnown={() => onKnown(word.id)} />
        ))}
      </div>
    </div>
  );
}

function QuestionsPart({ questions, answers, onAnswer, onReset }) {
  const [at, setAt] = useState(0);
  if (!questions.length) return <p className="text-sm text-muted-foreground">This topic has no questions.</p>;
  const question = questions[at];
  const chosen = answers[question.id];
  const answered = questions.filter((item) => answers[item.id]).length;
  const right = questions.filter((item) => answers[item.id] === item.correctOptionId).length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Questions">
        {questions.map((item, index) => {
          const value = answers[item.id];
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Question ${index + 1}`}
              aria-current={index === at ? 'step' : undefined}
              onClick={() => setAt(index)}
              className={cn(
                'h-3 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                index === at ? 'w-8' : 'w-3',
                !value ? (index === at ? 'bg-primary' : 'bg-muted-foreground/25') : value === item.correctOptionId ? 'bg-success' : 'bg-destructive',
              )}
            />
          );
        })}
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {right} of {questions.length} right
        </span>
      </div>
      <Card>
        <CardContent className="space-y-5 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Question {at + 1} of {questions.length}
          </p>
          <CourseQuestion
            key={question.id}
            question={question}
            chosen={chosen}
            marked={chosen ? { chosenOptionId: chosen, correctOptionId: question.correctOptionId, correct: chosen === question.correctOptionId, explanation: question.explanation } : null}
            onChoose={(optionId) => onAnswer(question.id, optionId)}
          />
          <div className="flex items-center gap-2 border-t pt-4">
            {answered === questions.length ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  onReset();
                  setAt(0);
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="ml-auto gap-1" disabled={at === 0} onClick={() => setAt(at - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button variant={chosen ? 'default' : 'outline'} size="sm" className="gap-1" disabled={at === questions.length - 1} onClick={() => setAt(at + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OrderingPart({ ordering, onResult }) {
  const [items, setItems] = useState(ordering.items);
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(null);
  const byId = new Map(ordering.items.map((item) => [item.id, item]));

  function dragOver(event, index) {
    event.preventDefault();
    if (dragging === null || dragging === index) return;
    const next = [...items];
    const [moved] = next.splice(dragging, 1);
    next.splice(index, 0, moved);
    setItems(next);
    setDragging(index);
  }

  function check() {
    const checked = orderingResult(items.map((item) => item.id), ordering.order);
    setResult(checked);
    onResult(checked.correct);
  }

  return (
    <div className="space-y-4">
      <p className="font-medium">{ordering.prompt || 'Put the items in the correct order.'}</p>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable={!result}
            onDragStart={() => setDragging(index)}
            onDragOver={(event) => dragOver(event, index)}
            onDragEnd={() => setDragging(null)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(null);
            }}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-card px-3 py-3 shadow-sm transition-colors',
              !result && 'cursor-grab active:cursor-grabbing',
              dragging === index && 'border-primary bg-primary/5 opacity-80',
              result && (result.right[index] ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'),
            )}
          >
            {result ? null : <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">{index + 1}</span>
            <span className="flex-1">{item.text}</span>
            {result ? (
              result.right[index] ? <Check className="h-4 w-4 text-success" aria-label="Right place" /> : <X className="h-4 w-4 text-destructive" aria-label="Wrong place" />
            ) : (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move "${item.text}" up`} disabled={index === 0} onClick={() => setItems(moveItem(items, index, -1))}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move "${item.text}" down`} disabled={index === items.length - 1} onClick={() => setItems(moveItem(items, index, 1))}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ol>
      {result && !result.correct ? (
        <div className="rounded-xl border bg-muted/30 p-3 text-sm">
          <p className="font-medium">The correct order:</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            {ordering.order.map((id) => (
              <li key={id}>{byId.get(id)?.text}</li>
            ))}
          </ol>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {result ? (
          <>
            <span className={cn('font-semibold', result.correct ? 'text-success' : 'text-destructive')}>{result.correct ? 'All in the right order.' : 'Not quite.'}</span>
            <Button variant="outline" className="gap-1.5" onClick={() => setResult(null)}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          </>
        ) : (
          <Button className="gap-1.5" onClick={check}>
            <Check className="h-4 w-4" />
            Check the order
          </Button>
        )}
      </div>
    </div>
  );
}

const markStyles = {
  right: 'text-success',
  typing: 'text-foreground',
  wrong: 'text-destructive',
  extra: 'text-destructive line-through',
};

const slotStyles = {
  right: 'border-success',
  typing: 'border-primary',
  wrong: 'border-destructive bg-destructive/10',
};

const blankStyles = {
  right: 'border-success bg-success/10',
  wrong: 'border-destructive bg-destructive/10',
};

function sentenceDone(sentence, mode, typed, blanks) {
  if (mode === CourseDictationMode.FULL) return typingMarks(sentence.text, typed).done;
  const pieces = (sentence.pieces || []).filter((piece) => 'blank' in piece);
  return pieces.length > 0 && pieces.every((piece) => blankMark(piece.answer, blanks[piece.blank] || '') === 'right');
}

function WordSlots({ text, typed }) {
  const expected = splitWords(text);
  const { marks } = typingMarks(text, typed);
  return (
    <p className="flex flex-wrap items-end gap-x-2 gap-y-3 text-lg leading-none" aria-live="polite">
      {expected.map((word, index) => {
        const mark = marks[index];
        return (
          <span
            key={index}
            className={cn('inline-flex h-8 items-end justify-center rounded-t border-b-2 px-0.5 pb-1 font-medium', mark ? slotStyles[mark.status] : 'border-muted-foreground/40')}
            style={{ minWidth: `${Math.max(2, word.key.length) * 0.62 + 0.5}em` }}
          >
            {mark ? <span className={markStyles[mark.status]}>{mark.text}</span> : null}
          </span>
        );
      })}
      {marks.slice(expected.length).map((mark, index) => (
        <span key={`extra-${index}`} className={cn('inline-flex h-8 items-end pb-1 font-medium', markStyles.extra)}>
          {mark.text}
        </span>
      ))}
    </p>
  );
}

function CurrentSentence({ sentence, number, total, mode, typed, blanks, hint, done, inputRef, onType, onBlank, onPlay, onHint, onMove }) {
  const keyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onPlay();
    }
  };
  const blankMode = mode === CourseDictationMode.BLANKS;
  let firstBlank = true;
  return (
    <Card className={cn('border-2 transition-colors', done ? 'border-success/60' : 'border-primary/30')}>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            Sentence {number} <span className="font-normal text-muted-foreground">of {total}</span>
          </span>
          {sentence.speaker ? <Badge variant="secondary">{sentence.speaker}</Badge> : null}
          {done ? (
            <span className="flex items-center gap-1 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Done
            </span>
          ) : null}
          <Button variant={hint ? 'secondary' : 'ghost'} size="sm" className="ml-auto gap-1.5" aria-pressed={hint} onClick={onHint}>
            <Lightbulb className="h-4 w-4" />
            Hint
          </Button>
        </div>

        {blankMode ? (
          sentence.pieces ? (
            <p className="text-lg leading-[3rem]">
              {sentence.pieces.map((piece, index) => {
                if (!('blank' in piece)) return <span key={index}>{piece.text}</span>;
                const state = blankMark(piece.answer, blanks[piece.blank] || '');
                const ref = firstBlank ? inputRef : undefined;
                firstBlank = false;
                return (
                  <Input
                    key={index}
                    ref={ref}
                    aria-label={`Blank ${piece.blank + 1}`}
                    className={cn('mx-1 inline-flex h-10 align-middle text-base', blankStyles[state])}
                    style={{ width: `${Math.max(5, piece.answer.length + 2)}ch` }}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={80}
                    value={blanks[piece.blank] || ''}
                    readOnly={state === 'right'}
                    onKeyDown={keyDown}
                    onChange={(event) => onBlank(piece.blank, event.target.value)}
                  />
                );
              })}
            </p>
          ) : (
            <p className="text-lg text-muted-foreground">{sentence.text}</p>
          )
        ) : (
          <div className="space-y-4">
            <WordSlots text={sentence.text} typed={typed} />
            <Input
              ref={inputRef}
              aria-label={`Sentence ${number}`}
              autoComplete="off"
              spellCheck={false}
              maxLength={2000}
              placeholder="Type what you hear"
              className={cn('h-12 text-base', done && 'border-success')}
              value={typed}
              readOnly={done}
              onKeyDown={keyDown}
              onChange={(event) => onType(event.target.value)}
            />
          </div>
        )}

        {hint ? <p className="rounded-lg border border-warning/40 bg-warning/10 p-3">{sentence.text}</p> : null}

        <div className="flex items-center gap-2 border-t pt-4">
          <span className="text-xs text-muted-foreground">Enter plays the sentence again.</span>
          <Button variant="outline" size="sm" className="ml-auto gap-1" disabled={number === 1} onClick={() => onMove(-1)}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant={done ? 'default' : 'outline'} size="sm" className="gap-1" disabled={number === total} onClick={() => onMove(1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DictationPart({ sentences, current, onCurrent, onPlay, dictation }) {
  const { mode, setMode, typed, blanks, hints, setTyped, setBlanks, setHints, doneIds } = dictation;
  const hasBlanks = sentences.some((sentence) => sentence.pieces);
  const input = useRef(null);
  const sentence = sentences[current];
  const done = doneIds.has(sentence.id);
  const wasDone = useRef(done);

  useEffect(() => {
    input.current?.focus();
    wasDone.current = doneIds.has(sentence.id);
  }, [current, mode]);

  useEffect(() => {
    if (done && !wasDone.current && current < sentences.length - 1) {
      const timer = setTimeout(() => onCurrent(current + 1), 700);
      wasDone.current = true;
      return () => clearTimeout(timer);
    }
    wasDone.current = done;
    return undefined;
  }, [done]);

  const hideHint = (id) => setHints((state) => (state[id] ? { ...state, [id]: false } : state));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border bg-muted/40 p-0.5" role="group" aria-label="Dictation mode">
          {[
            { value: CourseDictationMode.BLANKS, label: 'Fill the blanks', disabled: !hasBlanks },
            { value: CourseDictationMode.FULL, label: 'Write every word', disabled: false },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              disabled={option.disabled}
              onClick={() => setMode(option.value)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                mode === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {doneIds.size} of {sentences.length} done
        </span>
      </div>

      <CurrentSentence
        key={`${mode}:${sentence.id}`}
        sentence={sentence}
        number={current + 1}
        total={sentences.length}
        mode={mode}
        typed={typed[sentence.id] || ''}
        blanks={blanks[sentence.id] || []}
        hint={Boolean(hints[sentence.id])}
        done={done}
        inputRef={input}
        onType={(value) => {
          hideHint(sentence.id);
          setTyped((state) => ({ ...state, [sentence.id]: value }));
        }}
        onBlank={(blank, value) => {
          hideHint(sentence.id);
          setBlanks((state) => {
            const list = [...(state[sentence.id] || [])];
            list[blank] = value;
            return { ...state, [sentence.id]: list };
          });
        }}
        onPlay={() => onPlay(sentence)}
        onHint={() => {
          if (!hints[sentence.id]) dictation.onHintUsed(sentence.id);
          setHints((state) => ({ ...state, [sentence.id]: !state[sentence.id] }));
        }}
        onMove={(by) => onCurrent(current + by)}
      />

      <ol className="divide-y overflow-hidden rounded-xl border bg-card">
        {sentences.map((item, index) => {
          const itemDone = doneIds.has(item.id);
          const draft = mode === CourseDictationMode.FULL ? typed[item.id] : (blanks[item.id] || []).filter(Boolean).join(' · ');
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onCurrent(index)}
                aria-current={index === current ? 'step' : undefined}
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', index === current && 'bg-primary/5')}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
                    itemDone ? 'border-success bg-success text-white' : index === current ? 'border-primary text-primary' : 'text-muted-foreground',
                  )}
                >
                  {itemDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={cn('min-w-0 flex-1 truncate', itemDone ? 'text-foreground' : 'text-muted-foreground')}>{itemDone ? item.text : draft || '—'}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TranscriptPart({ sentences, active, playing, onPlay }) {
  const [translated, setTranslated] = useState(true);
  const rows = useRef([]);
  useEffect(() => {
    if (playing && active >= 0) rows.current[active]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active, playing]);
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" className="gap-1.5" aria-pressed={translated} onClick={() => setTranslated(!translated)}>
        <Eye className="h-4 w-4" />
        {translated ? 'Hide the translation' : 'Show the translation'}
      </Button>
      <ol className="space-y-1">
        {sentences.map((sentence, index) => {
          const now = index === active;
          return (
            <li key={sentence.id} ref={(element) => (rows.current[index] = element)}>
              <button
                type="button"
                onClick={() => onPlay(sentence)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  now ? 'border-primary/40 bg-primary/10 shadow-sm' : 'border-transparent hover:bg-accent',
                )}
              >
                <Play className={cn('mt-1 h-4 w-4 shrink-0', now ? 'text-primary' : 'text-muted-foreground')} />
                <span className="min-w-0">
                  <span className={cn('block', now ? 'text-lg font-medium' : 'text-base')}>
                    {sentence.speaker ? <span className="mr-1 font-semibold">{sentence.speaker}:</span> : null}
                    {sentence.text}
                  </span>
                  {translated && sentence.translation ? <span className="block text-sm text-muted-foreground">{sentence.translation}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-bold tabular-nums', tone)}>{value}</p>
    </div>
  );
}

function TopicSummary({ data, known, right, orderCorrect, doneCount, hintsUsed, completing, onComplete, back }) {
  return (
    <Card className={cn('overflow-hidden', data.done && 'border-success/50')}>
      <div className={cn('flex items-center gap-3 px-6 py-4', data.done ? 'bg-success/10' : 'bg-primary/5')}>
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', data.done ? 'bg-success text-white' : 'bg-primary text-primary-foreground')}>
          {data.done ? <CheckCircle2 className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
        </span>
        <div>
          <p className="font-semibold">{data.done ? 'Topic done' : 'Last step'}</p>
          <p className="text-sm text-muted-foreground">{data.topic.title}</p>
        </div>
      </div>
      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Words known" value={`${known}/${data.vocabulary.length}`} />
          <Stat label="Questions right" value={`${right}/${data.questions.length}`} />
          <Stat label="Sentences written" value={`${doneCount}/${data.sentences.length}`} tone={doneCount === data.sentences.length && doneCount ? 'text-success' : undefined} />
          <Stat label="Hints used" value={hintsUsed} />
        </div>
        {data.ordering ? <p className="text-sm text-muted-foreground">Order: {orderCorrect === null ? 'not checked' : orderCorrect ? 'right' : 'not quite'}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          {data.done ? null : (
            <Button className="gap-1.5" loading={completing} onClick={onComplete}>
              <CheckCircle2 className="h-4 w-4" />
              Mark this topic done
            </Button>
          )}
          {data.next ? (
            <Button asChild variant={data.done ? 'default' : 'outline'} className="gap-1.5">
              <Link to={courseTopicPath(data.next.id)} state={back.passThrough}>
                Next topic: {data.next.title}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <Link to={back.to} state={back.state}>
              Back to the course
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CourseTopicPage() {
  const { topicId } = useParams();
  const back = useReturnTo('/student/listening-course');
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [part, setPart] = useState(Part.VOCABULARY);
  const [visited, setVisited] = useState(() => new Set());
  const [speed, setSpeed] = useState(1);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState(CourseDictationMode.BLANKS);
  const [typed, setTyped] = useState({});
  const [blanks, setBlanks] = useState({});
  const [hints, setHints] = useState({});
  const [hintsUsed, setHintsUsed] = useState(() => new Set());
  const [answers, setAnswers] = useState({});
  const [known, setKnown] = useState(() => new Set());
  const [orderCorrect, setOrderCorrect] = useState(null);
  const [completing, setCompleting] = useState(false);
  const audioRef = useRef(null);
  const held = part === Part.DICTATION;
  const line = data?.sentences[current] || null;
  const player = useHeldPlayer(audioRef, { line, speed, active: held });
  const play = (sentence) => player.playLine(sentence).catch(() => notify({ title: 'Could not play the recording', variant: 'destructive' }));
  const audio = useAudioState(audioRef, data?.audioUrl);
  const active = part === Part.TRANSCRIPT ? activeSentence(data?.sentences || [], audio.time) : current;
  const doneIds = new Set((data?.sentences || []).filter((sentence) => sentenceDone(sentence, mode, typed[sentence.id] || '', blanks[sentence.id] || [])).map((sentence) => sentence.id));

  async function load() {
    setState('loading');
    try {
      const topic = (await getCourseTopic(topicId)).data;
      setData(topic);
      setCurrent(0);
      setMode(topic.sentences.some((sentence) => sentence.pieces) ? CourseDictationMode.BLANKS : CourseDictationMode.FULL);
      setTyped({});
      setBlanks({});
      setHints({});
      setHintsUsed(new Set());
      setAnswers({});
      setKnown(readKnown(topicId));
      setOrderCorrect(null);
      setPart(Part.VOCABULARY);
      setVisited(new Set());
      setState('ready');
    } catch (error) {
      setState(errorCode(error) === LearningResponseCode.COURSE_ITEM_LOCKED ? 'locked' : 'error');
      if (errorCode(error) !== LearningResponseCode.COURSE_ITEM_LOCKED) notify({ title: 'Could not open the topic', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [topicId]);

  useEffect(() => {
    if (!held) player.reset(null);
  }, [held]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  function openPart(next) {
    setVisited((state) => new Set(state).add(part));
    setPart(next);
  }

  function playFrom(sentence) {
    const element = audioRef.current;
    if (!element) return;
    if (sentence.start !== null) element.currentTime = sentence.start;
    element.play().catch(() => notify({ title: 'Could not play the recording', variant: 'destructive' }));
  }

  function toggleKnown(id) {
    setKnown((state) => {
      const next = new Set(state);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeKnown(topicId, next);
      return next;
    });
  }

  function select(index, { play: andPlay = false } = {}) {
    const next = Math.max(0, Math.min(data.sentences.length - 1, index));
    if (!held) {
      if (andPlay) playFrom(data.sentences[next]);
      else if (audioRef.current && data.sentences[next]?.start != null) audioRef.current.currentTime = data.sentences[next].start;
      return;
    }
    setCurrent(next);
    if (andPlay) play(data.sentences[next]);
  }

  async function complete() {
    setCompleting(true);
    try {
      await completeCourseTopic(topicId);
      setData((value) => ({ ...value, done: true }));
      notify({ title: 'Topic done', description: data.next ? `Next: ${data.next.title}` : 'You finished the topics of this level.' });
    } catch (error) {
      notify({ title: 'Could not mark the topic done', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setCompleting(false);
    }
  }

  const backLink = (
    <Link to={back.to} state={back.state} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Listening course
    </Link>
  );

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'locked')
    return (
      <section className="space-y-6">
        {backLink}
        <EmptyState icon={ArrowLeft} title="This level is locked" description="Pass the test of the level before it to open this topic." />
      </section>
    );
  if (state === 'error')
    return (
      <section className="space-y-6">
        {backLink}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </section>
    );

  const parts = [Part.VOCABULARY, Part.QUESTIONS, ...(data.ordering ? [Part.ORDERING] : []), Part.DICTATION, Part.TRANSCRIPT];
  const index = parts.indexOf(part);
  const after = parts[index + 1];
  const dictation = { mode, setMode, typed, blanks, hints, setTyped, setBlanks, setHints, doneIds, onHintUsed: (id) => setHintsUsed((state) => new Set(state).add(id)) };
  const right = data.questions.filter((question) => answers[question.id] === question.correctOptionId).length;

  return (
    <section className="space-y-6">
      {backLink}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Badge variant="info">{data.topic.level}</Badge>
          {data.done ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{data.topic.title}</h1>
        {data.topic.description ? <p className="max-w-2xl text-muted-foreground">{data.topic.description}</p> : null}
      </div>

      <StepNav
        label="Topic steps"
        active={part}
        onSelect={openPart}
        steps={parts.map((key) => ({
          key,
          label: partLabels[key],
          state: (
            key === Part.DICTATION
              ? data.sentences.length > 0 && doneIds.size === data.sentences.length
              : key === Part.QUESTIONS
                ? data.questions.length > 0 && data.questions.every((question) => answers[question.id])
                : key === Part.ORDERING
                  ? orderCorrect !== null
                  : visited.has(key)
          )
            ? StepState.DONE
            : StepState.TODO,
        }))}
      />

      <div className={cn('space-y-6', part !== Part.VOCABULARY && 'lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0')}>
        <RecordingPanel
          className={cn('lg:sticky lg:top-20 lg:self-start', part === Part.VOCABULARY && 'hidden')}
          audioRef={audioRef}
          audioUrl={data.audioUrl}
          held={held}
          follow={part === Part.TRANSCRIPT}
          sentences={data.sentences}
          current={active}
          doneIds={doneIds}
          showSentence={part === Part.DICTATION}
          onSelect={select}
          onPlayLine={play}
          speed={speed}
          onSpeed={setSpeed}
        />
        <div className="min-w-0 space-y-6">
          {part === Part.VOCABULARY ? <VocabularyPart words={data.vocabulary} known={known} onKnown={toggleKnown} /> : null}
          {part === Part.QUESTIONS ? (
            <QuestionsPart questions={data.questions} answers={answers} onAnswer={(id, optionId) => setAnswers((state) => ({ ...state, [id]: optionId }))} onReset={() => setAnswers({})} />
          ) : null}
          {part === Part.ORDERING && data.ordering ? <OrderingPart ordering={data.ordering} onResult={setOrderCorrect} /> : null}
          {part === Part.DICTATION ? (
            data.sentences.length ? (
              <DictationPart sentences={data.sentences} current={current} onCurrent={(next) => select(next)} onPlay={play} dictation={dictation} />
            ) : (
              <p className="text-sm text-muted-foreground">This recording has no sentences to write.</p>
            )
          ) : null}
          {part === Part.TRANSCRIPT ? (
            <TranscriptPart sentences={data.sentences} active={active} playing={audio.playing} onPlay={playFrom} />
          ) : null}
        </div>
      </div>

      {after ? (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button className="gap-1.5" onClick={() => openPart(after)}>
            Next: {partLabels[after]}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <TopicSummary
          data={data}
          known={known.size}
          right={right}
          orderCorrect={orderCorrect}
          doneCount={doneIds.size}
          hintsUsed={hintsUsed.size}
          completing={completing}
          onComplete={complete}
          back={back}
        />
      )}
    </section>
  );
}
