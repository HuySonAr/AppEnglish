import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, ChevronLeft, ChevronRight, Eye, Lightbulb, Play, RotateCcw, Volume2, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CourseDictationMode, LearningResponseCode } from '@appenglish/learning-contracts';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Card, CardContent, Tabs, TabsList, TabsTrigger } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { useHeldPlayer } from '../../../hooks/use-held-player.js';
import { useReturnTo } from '../../../hooks/use-return-to.js';
import { checkCourseSentence, completeCourseTopic, getCourseTopic } from '../api/course-api.js';
import { CourseQuestion } from '../components/CourseQuestion.jsx';
import { BlankLine, CheckedWords } from '../components/ListeningMarks.jsx';
import { courseTopicPath, moveItem, orderingResult, unanswered } from '../lib/listening-course.js';

const SPEEDS = [0.75, 1, 1.25];
const Part = Object.freeze({ VOCABULARY: 'vocabulary', QUESTIONS: 'questions', ORDERING: 'ordering', DICTATION: 'dictation', TRANSCRIPT: 'transcript' });
const partLabels = { vocabulary: 'Vocabulary', questions: 'Multiple choice', ordering: 'Put in order', dictation: 'Dictation', transcript: 'Transcript' };

function SpeedButtons({ speed, onChange }) {
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground" role="group" aria-label="Speed">
      <span className="mr-1">Speed</span>
      {SPEEDS.map((value) => (
        <Button key={value} type="button" size="sm" variant={speed === value ? 'secondary' : 'ghost'} aria-pressed={speed === value} onClick={() => onChange(value)}>
          {value}×
        </Button>
      ))}
    </div>
  );
}

function VocabularyPart({ words }) {
  if (!words.length) return <p className="text-sm text-muted-foreground">This topic has no word list.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {words.map((word) => (
        <Card key={word.id}>
          <CardContent className="flex items-start gap-3 pt-6">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={`Play ${word.word}`}
              disabled={!word.audioUrl}
              onClick={() => new Audio(word.audioUrl).play().catch(() => notify({ title: 'Could not play the word', variant: 'destructive' }))}
            >
              <Volume2 className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-lg font-semibold">{word.word}</p>
              <p className="text-sm text-muted-foreground">{word.phonetic}</p>
              <p className="mt-1">{word.meaning}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Multiple choice, checked on the page: nothing is scored (D144).
function QuestionsPart({ questions }) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const left = unanswered(questions, answers).length;
  const right = questions.filter((question) => answers[question.id] === question.correctOptionId).length;
  return (
    <div className="space-y-6">
      {questions.map((question, index) => (
        <CourseQuestion
          key={question.id}
          number={index + 1}
          question={question}
          chosen={answers[question.id]}
          marked={checked ? { chosenOptionId: answers[question.id] || null, correctOptionId: question.correctOptionId, correct: answers[question.id] === question.correctOptionId, explanation: question.explanation } : null}
          onChoose={(optionId) => setAnswers((current) => ({ ...current, [question.id]: optionId }))}
        />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {checked ? (
          <>
            <Badge variant={right === questions.length ? 'success' : 'secondary'}>
              {right} of {questions.length} right
            </Badge>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setAnswers({});
                setChecked(false);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          </>
        ) : (
          <>
            <Button className="gap-1.5" disabled={left > 0} onClick={() => setChecked(true)}>
              <Check className="h-4 w-4" />
              Check my answers
            </Button>
            {left ? <span className="text-sm text-muted-foreground">{left} question{left === 1 ? '' : 's'} left.</span> : null}
          </>
        )}
      </div>
    </div>
  );
}

// The ideas in the order heard (D143), moved up and down, checked on the page.
function OrderingPart({ ordering }) {
  const [items, setItems] = useState(ordering.items);
  const [result, setResult] = useState(null);
  const byId = new Map(ordering.items.map((item) => [item.id, item]));
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{ordering.prompt || 'Put the ideas in the order you hear them.'}</p>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border bg-background px-3 py-2',
              result && (result.right[index] ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'),
            )}
          >
            <span className="w-6 text-sm font-semibold text-muted-foreground">{index + 1}</span>
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
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">The order in the recording:</p>
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
          <Button className="gap-1.5" onClick={() => setResult(orderingResult(items.map((item) => item.id), ordering.order))}>
            <Check className="h-4 w-4" />
            Check the order
          </Button>
        )}
      </div>
    </div>
  );
}

// Dictation (D143–D145): sentence by sentence, the sentence plays and stops
// at its end; the learner writes the whole sentence or fills its blanks,
// checks it word by word, and can show the sentence as a hint. Nothing kept.
function DictationPart({ topicId, versionId, sentences, player, speed, onSpeed }) {
  const hasBlanks = sentences.some((sentence) => sentence.pieces);
  const [mode, setMode] = useState(hasBlanks ? CourseDictationMode.BLANKS : CourseDictationMode.FULL);
  const [at, setAt] = useState(0);
  const [typed, setTyped] = useState({});
  const [blanks, setBlanks] = useState({});
  const [results, setResults] = useState({});
  const [hints, setHints] = useState({});
  const [busy, setBusy] = useState(false);
  const sentence = sentences[at];
  const key = `${mode}:${sentence.id}`;
  const result = results[key];
  const blankMode = mode === CourseDictationMode.BLANKS;
  const fillable = blankMode && sentence.pieces;

  useEffect(() => {
    player.reset(sentence);
  }, [sentence.id]);

  async function check() {
    setBusy(true);
    try {
      const body = blankMode ? { versionId, segmentId: sentence.id, mode, blanks: blanks[sentence.id] || [] } : { versionId, segmentId: sentence.id, mode, text: typed[sentence.id] || '' };
      const checked = (await checkCourseSentence(topicId, body)).data;
      setResults((current) => ({ ...current, [key]: checked }));
    } catch (error) {
      notify({ title: 'Could not check the sentence', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const go = (index) => setAt(Math.max(0, Math.min(sentences.length - 1, index)));
  const markedPieces = fillable && result ? sentence.pieces.map((piece) => ('blank' in piece ? { ...piece, ...result.blanks.find((blank) => blank.index === piece.blank) } : piece)) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border bg-background p-0.5" role="group" aria-label="Dictation mode">
          {[
            { value: CourseDictationMode.BLANKS, label: 'Fill the blanks', disabled: !hasBlanks },
            { value: CourseDictationMode.FULL, label: 'Write every word', disabled: false },
          ].map((option) => (
            <Button key={option.value} type="button" size="sm" variant={mode === option.value ? 'secondary' : 'ghost'} aria-pressed={mode === option.value} disabled={option.disabled} onClick={() => setMode(option.value)}>
              {option.label}
            </Button>
          ))}
        </div>
        <SpeedButtons speed={speed} onChange={onSpeed} />
      </div>
      <p className="text-sm text-muted-foreground">Switch modes whenever you like: start with the blanks, then try writing every word.</p>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Sentence {at + 1} of {sentences.length}
            </Badge>
            {sentence.speaker ? <span className="text-sm text-muted-foreground">{sentence.speaker}</span> : null}
            <Button size="sm" className="ml-auto gap-1.5" onClick={() => player.playLine(sentence).catch(() => notify({ title: 'Could not play the recording', variant: 'destructive' }))}>
              <Play className="h-4 w-4" />
              {player.started ? 'Play again' : 'Play the sentence'}
            </Button>
          </div>

          {blankMode && !sentence.pieces ? (
            <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">This sentence has no blanks: listen to it, or switch to "Write every word".</p>
          ) : fillable ? (
            <BlankLine
              pieces={markedPieces || sentence.pieces}
              answers={blanks[sentence.id] || []}
              label={`Sentence ${at + 1}`}
              onAnswer={(index, value) => {
                setBlanks((current) => {
                  const list = [...(current[sentence.id] || [])];
                  list[index] = value;
                  return { ...current, [sentence.id]: list };
                });
                setResults((current) => ({ ...current, [key]: undefined }));
              }}
              onEnter={check}
            />
          ) : (
            <>
              <Textarea
                aria-label={`Sentence ${at + 1}`}
                rows={2}
                maxLength={2000}
                autoComplete="off"
                spellCheck={false}
                placeholder="Write what you hear"
                value={typed[sentence.id] || ''}
                onChange={(event) => {
                  setTyped((current) => ({ ...current, [sentence.id]: event.target.value }));
                  setResults((current) => ({ ...current, [key]: undefined }));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    check();
                  }
                }}
              />
              {result ? <CheckedWords words={result.words} /> : null}
            </>
          )}

          {result ? (
            <p className={cn('text-sm font-semibold', result.correct ? 'text-success' : 'text-destructive')}>{result.correct ? 'All right!' : `${result.accuracy}% right. Listen again and fix it, or show the sentence.`}</p>
          ) : null}
          {hints[sentence.id] ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-warning">Hint</span>
              {sentence.text}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-1.5" loading={busy} disabled={busy || (blankMode && !sentence.pieces)} onClick={check}>
              <Check className="h-4 w-4" />
              Check
            </Button>
            <Button variant="outline" className="gap-1.5" disabled={Boolean(hints[sentence.id])} onClick={() => setHints((current) => ({ ...current, [sentence.id]: true }))}>
              <Lightbulb className="h-4 w-4" />
              Show the sentence
            </Button>
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="icon" aria-label="Previous sentence" disabled={at === 0} onClick={() => go(at - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next sentence" disabled={at === sentences.length - 1} onClick={() => go(at + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// The transcript with its translation (D143); each sentence plays on its own.
function TranscriptPart({ sentences, player }) {
  const [translated, setTranslated] = useState(true);
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" className="gap-1.5" aria-pressed={translated} onClick={() => setTranslated(!translated)}>
        <Eye className="h-4 w-4" />
        {translated ? 'Hide the translation' : 'Show the translation'}
      </Button>
      <ol className="divide-y rounded-xl border bg-card">
        {sentences.map((sentence) => (
          <li key={sentence.id} className="flex items-start gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Play this sentence" onClick={() => player.playLine(sentence).catch(() => {})}>
              <Play className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p>
                {sentence.speaker ? <span className="mr-1 font-medium">{sentence.speaker}:</span> : null}
                {sentence.text}
              </p>
              {translated && sentence.translation ? <p className="text-sm text-muted-foreground">{sentence.translation}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// One topic of the Listening course (D143–D145): vocabulary, multiple choice,
// putting ideas in order when the topic has it, dictation and the transcript.
// Nothing is scored; the learner marks the topic done.
export function CourseTopicPage() {
  const { topicId } = useParams();
  const back = useReturnTo('/student/listening-course');
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [part, setPart] = useState(Part.VOCABULARY);
  const [speed, setSpeed] = useState(1);
  const [line, setLine] = useState(null);
  const [completing, setCompleting] = useState(false);
  const audioRef = useRef(null);
  const held = part === Part.DICTATION || part === Part.TRANSCRIPT;
  const player = useHeldPlayer(audioRef, { line, speed, active: held });

  async function load() {
    setState('loading');
    try {
      const topic = (await getCourseTopic(topicId)).data;
      setData(topic);
      setLine(topic.sentences[0] || null);
      setPart(Part.VOCABULARY);
      setState('ready');
    } catch (error) {
      setState(errorCode(error) === LearningResponseCode.COURSE_ITEM_LOCKED ? 'locked' : 'error');
      if (errorCode(error) !== LearningResponseCode.COURSE_ITEM_LOCKED) notify({ title: 'Could not open the topic', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [topicId]);

  // Leaving the dictation or the transcript frees the player for the whole recording.
  useEffect(() => {
    if (!held) player.reset(null);
  }, [held]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  async function complete() {
    setCompleting(true);
    try {
      await completeCourseTopic(topicId);
      setData((current) => ({ ...current, done: true }));
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

  return (
    <section className="space-y-6">
      {backLink}
      <div className="flex flex-wrap items-start justify-between gap-3">
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
      </div>

      <Tabs value={part} onValueChange={setPart}>
        <TabsList className="flex-wrap">
          {parts.map((key, at) => (
            <TabsTrigger key={key} value={key}>
              {at + 1}. {partLabels[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* One recording for every part; it is shown with the exercises (D144). */}
      <div className={cn('space-y-2 rounded-xl border bg-card p-4 shadow-sm', part === Part.VOCABULARY && 'hidden')}>
        <audio ref={audioRef} src={data.audioUrl || undefined} controls={!held} controlsList="nodownload" preload="metadata" className={cn('w-full', held && 'hidden')} />
        {held ? <p className="text-sm text-muted-foreground">Each sentence plays on its own and stops at its end.</p> : <SpeedButtons speed={speed} onChange={setSpeed} />}
      </div>

      {part === Part.VOCABULARY ? <VocabularyPart words={data.vocabulary} /> : null}
      {part === Part.QUESTIONS ? <QuestionsPart questions={data.questions} /> : null}
      {part === Part.ORDERING && data.ordering ? <OrderingPart ordering={data.ordering} /> : null}
      {part === Part.DICTATION ? (
        data.sentences.length ? (
          <DictationPart topicId={topicId} versionId={data.versionId} sentences={data.sentences} player={player} speed={speed} onSpeed={setSpeed} />
        ) : (
          <p className="text-sm text-muted-foreground">This recording has no sentences to write.</p>
        )
      ) : null}
      {part === Part.TRANSCRIPT ? <TranscriptPart sentences={data.sentences} player={player} /> : null}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        {after ? (
          <Button className="gap-1.5" onClick={() => setPart(after)}>
            Next: {partLabels[after]}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : data.done ? (
          <span className="flex items-center gap-1.5 font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            This topic is done.
          </span>
        ) : (
          <Button className="gap-1.5" loading={completing} onClick={complete}>
            <CheckCircle2 className="h-4 w-4" />
            Mark this topic done
          </Button>
        )}
        {data.next && (!after || data.done) ? (
          <Button asChild variant="outline" className="ml-auto gap-1.5">
            <Link to={courseTopicPath(data.next.id)} state={back.passThrough}>
              Next topic: {data.next.title}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
