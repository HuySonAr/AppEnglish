import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Headphones, RotateCcw } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FILL_IN_BLANK } from '@appenglish/content-contracts';
import { COURSE_FOCUS_ID, CourseLessonStep, courseBlankKey } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { useHeldPlayer } from '../../../hooks/use-held-player.js';
import { Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { checkCourseLessonStep, completeCourseLesson, getCourseLesson } from '../api/course-api.js';
import { CheckedWords } from '../components/ListeningMarks.jsx';
import { BlankedText, CourseQuestion } from '../components/CourseQuestion.jsx';
import { CourseStep, courseStepsOf, nextKind, nextPath, stepAfter, unanswered, unfilledBlanks } from '../lib/listening-course.js';
import { isTimed } from '../lib/listening-practice.js';

const SPEEDS = [0.75, 1, 1.25];

// Where the learner is in the steps of the lesson.
function Stepper({ step, steps }) {
  const at = steps.findIndex((item) => item.key === step);
  return (
    <ol className={cn('grid gap-1.5', steps.length === 6 ? 'grid-cols-6' : 'grid-cols-5')} aria-label="Lesson steps">
      {steps.map((item, index) => (
        <li key={item.key} aria-current={index === at ? 'step' : undefined} className="space-y-1.5">
          <div className={cn('h-1.5 rounded-full', index < at ? 'bg-primary' : index === at ? 'bg-primary/60' : 'bg-muted')} />
          <p className={cn('truncate text-xs', index === at ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
            <span className="tabular-nums">{index + 1}.</span> <span className="hidden sm:inline">{item.label}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

// A Listening course lesson (F05C, D100, D109) in five or six steps: the
// keywords; the whole recording for its main idea; again for details (an
// option chosen or the words heard written in); the Focus on dialogue filled
// from words given, when the lesson has one; some sentences written down one
// at a time with the player held to each (D95); then the review with the
// score, the answers and the transcript. Each step is checked
// as the learner goes; finishing scores the lesson, keeps the best score and
// says what the course opens next (D102).
export function CourseLessonPage() {
  const { unitId, lessonId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [step, setStep] = useState(CourseStep.KEYWORDS);
  // Option id by question id, words by blank key, what was written by sentence id.
  const [answers, setAnswers] = useState({});
  // Checked questions by id, the checked Focus on, checked sentences by id.
  const [marks, setMarks] = useState({});
  const [focusMark, setFocusMark] = useState(null);
  const [written, setWritten] = useState({});
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  const sentence = data?.closeSegments[sentenceIndex] || null;
  const listening = state === 'ready' && [CourseStep.GIST, CourseStep.DETAIL, CourseStep.CLOSE].includes(step);
  // Free over the whole recording for the questions; held to the sentence
  // being written down.
  const { started, playLine, reset } = useHeldPlayer(audioRef, {
    line: step === CourseStep.CLOSE ? sentence : null,
    speed,
    active: listening,
    onStop: () => inputRef.current?.focus(),
  });

  function restart() {
    reset(null);
    setStep(CourseStep.KEYWORDS);
    setAnswers({});
    setMarks({});
    setFocusMark(null);
    setWritten({});
    setSentenceIndex(0);
    setResult(null);
    window.scrollTo({ top: 0 });
  }

  async function load() {
    setState('loading');
    try {
      setData((await getCourseLesson(unitId, lessonId)).data);
      restart();
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the lesson', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [unitId, lessonId]);

  const ask = (body) => checkCourseLessonStep(unitId, lessonId, { versionId: data.versionId, ...body });

  async function checkQuestions(kind) {
    setBusy(true);
    try {
      const checked = (await ask({ step: kind, answers })).data;
      setMarks((current) => ({ ...current, ...Object.fromEntries(checked.questions.map((question) => [question.id, question])) }));
    } catch (error) {
      notify({ title: 'Could not check your answers', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function checkFocus() {
    setBusy(true);
    try {
      setFocusMark((await ask({ step: CourseLessonStep.FOCUS, answers })).data.focus);
    } catch (error) {
      notify({ title: 'Could not check the dialogue', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function checkSentence() {
    if (busy || written[sentence.id]) return;
    setBusy(true);
    try {
      const checked = (await ask({ step: CourseLessonStep.CLOSE, segmentId: sentence.id, answers: { [sentence.id]: answers[sentence.id] || '' } })).data;
      setWritten((current) => ({ ...current, [sentence.id]: checked.sentence }));
    } catch (error) {
      notify({ title: 'Could not check the sentence', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      const scored = (await completeCourseLesson(unitId, lessonId, { versionId: data.versionId, answers })).data;
      reset(null);
      setResult(scored);
      setData((current) => ({ ...current, bestScore: scored.bestScore, attemptCount: scored.attemptCount, passed: scored.lessonPassed }));
      setStep(CourseStep.REVIEW);
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not finish the lesson', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  function goTo(next) {
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  function nextSentence() {
    if (busy) return;
    if (sentenceIndex === data.closeSegments.length - 1) {
      finish();
      return;
    }
    const at = sentenceIndex + 1;
    setSentenceIndex(at);
    if (isTimed(data.closeSegments[at])) playLine(data.closeSegments[at]).catch(() => {});
  }

  // Enter goes on once a sentence is checked.
  const sentenceDone = step === CourseStep.CLOSE && sentence && written[sentence.id];
  useEffect(() => {
    if (!sentenceDone) return undefined;
    const onKey = (event) => {
      if (event.key === 'Enter' && !event.isComposing && !event.defaultPrevented) {
        event.preventDefault();
        nextSentence();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const back = (
    <Link to="/student/listening-course" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      Listening course
    </Link>
  );

  if (state === 'loading') return <DetailPageSkeleton />;
  if (state === 'error')
    return (
      <div className="space-y-4">
        {back}
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      </div>
    );

  const { unit, lesson, keywords, gist, detail, focus, closeSegments } = data;
  const steps = courseStepsOf(Boolean(focus));
  const choose = (questionId) => (optionId) => setAnswers((current) => ({ ...current, [questionId]: optionId }));
  const type = (key, value) => setAnswers((current) => ({ ...current, [key]: value }));
  const focusValues = focus ? Array.from({ length: focus.blankCount }, (_, index) => answers[courseBlankKey(COURSE_FOCUS_ID, index)] || '') : [];
  const gistMarked = marks[gist.id];
  const detailMarked = detail.every((question) => marks[question.id]);
  const timed = sentence ? isTimed(sentence) : false;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {back}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{unit.level}</Badge>
          <Badge variant="outline">
            Lesson {lesson.number} of {lesson.count}
          </Badge>
          {data.passed ? <Badge variant="success">Passed</Badge> : null}
          {data.bestScore !== null ? <span className="text-sm text-muted-foreground">Best {data.bestScore}%</span> : null}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{lesson.title}</h1>
        <p className="text-muted-foreground">{unit.title}</p>
      </div>
      <Stepper step={step} steps={steps} />

      {step === CourseStep.KEYWORDS ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Keywords</h2>
            <p className="text-sm text-muted-foreground">
              {keywords.length ? 'Learn these words first: you will hear them in the recording.' : 'This lesson has no keywords. Go on to the recording.'}
            </p>
          </div>
          {keywords.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {keywords.map((keyword) => (
                <li key={keyword.id} className="rounded-lg border bg-background px-4 py-3">
                  <p className="font-semibold">{keyword.word}</p>
                  <p className="text-sm text-muted-foreground">{keyword.meaning}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <Button className="gap-1.5" onClick={() => goTo(CourseStep.GIST)}>
            Start listening
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {listening ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">
              {step === CourseStep.GIST ? 'Listen for the main idea' : step === CourseStep.DETAIL ? 'Listen for details' : 'Write down what you hear'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {step === CourseStep.GIST
                ? 'Listen to the whole recording once without reading, then answer.'
                : step === CourseStep.DETAIL
                  ? 'Listen again, as many times as you need, and answer every question.'
                  : timed
                    ? `Sentence ${sentenceIndex + 1} of ${closeSegments.length}: press play, it stops at the end of the sentence.`
                    : `Sentence ${sentenceIndex + 1} of ${closeSegments.length}: find it in the recording and write it down.`}
            </p>
          </div>

          {data.audioUrl ? (
            <div className="space-y-2">
              <audio ref={audioRef} src={data.audioUrl} controls controlsList="nodownload" preload="auto" className="w-full" />
              <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                {step === CourseStep.CLOSE && timed ? (
                  <Button variant="ghost" size="sm" className="gap-1.5" disabled={!started} onClick={() => playLine().catch(() => {})}>
                    <RotateCcw className="h-4 w-4" />
                    From the start of the sentence
                  </Button>
                ) : null}
                <span className="ml-auto">Speed</span>
                {SPEEDS.map((value) => (
                  <Button
                    key={value}
                    variant={speed === value ? 'secondary' : 'ghost'}
                    size="sm"
                    aria-pressed={speed === value}
                    onClick={() => setSpeed(value)}
                  >
                    {value}×
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">The recording cannot be played right now.</p>
          )}

          {step === CourseStep.GIST ? (
            <>
              <CourseQuestion question={gist} chosen={answers[gist.id]} marked={gistMarked} onChoose={choose(gist.id)} />
              {gistMarked ? (
                <Button className="gap-1.5" onClick={() => goTo(CourseStep.DETAIL)}>
                  Next: details
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button className="gap-1.5" loading={busy} disabled={busy || !answers[gist.id]} onClick={() => checkQuestions(CourseLessonStep.GIST)}>
                  <Check className="h-4 w-4" />
                  Check
                </Button>
              )}
            </>
          ) : null}

          {step === CourseStep.DETAIL ? (
            <>
              <div className="space-y-6">
                {detail.map((question, index) => (
                  <CourseQuestion
                    key={question.id}
                    number={index + 1}
                    question={question}
                    chosen={answers[question.id]}
                    marked={marks[question.id]}
                    onChoose={choose(question.id)}
                    answers={answers}
                    onType={type}
                  />
                ))}
              </div>
              {detailMarked ? (
                <Button className="gap-1.5" onClick={() => goTo(stepAfter(CourseStep.DETAIL, Boolean(focus)))}>
                  {focus ? 'Next: Focus on' : 'Next: write down'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="gap-1.5"
                    loading={busy}
                    disabled={busy || unanswered(detail, answers).length > 0}
                    onClick={() => checkQuestions(CourseLessonStep.DETAIL)}
                  >
                    <Check className="h-4 w-4" />
                    Check answers
                  </Button>
                  {unanswered(detail, answers).length ? <span className="text-sm text-muted-foreground">Answer every question to check.</span> : null}
                </div>
              )}
            </>
          ) : null}

          {step === CourseStep.CLOSE && sentence ? (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((sentenceIndex + (written[sentence.id] ? 1 : 0)) * 100) / closeSegments.length}%` }}
                />
              </div>
              {written[sentence.id] ? (
                <div className="space-y-1">
                  <div className="text-lg">
                    <CheckedWords words={written[sentence.id].words} />
                  </div>
                  <p className="text-sm text-muted-foreground">You wrote: {written[sentence.id].typed || '(nothing)'}</p>
                  <p className={cn('font-semibold', written[sentence.id].accuracy === 100 ? 'text-success' : 'text-destructive')}>
                    {written[sentence.id].accuracy === 100 ? 'All right!' : `${written[sentence.id].accuracy}% right.`}
                  </p>
                </div>
              ) : (
                <Input
                  ref={inputRef}
                  aria-label={`Sentence ${sentenceIndex + 1}: what you hear`}
                  className="h-11 text-base"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={2000}
                  value={answers[sentence.id] || ''}
                  onChange={(event) => setAnswers((current) => ({ ...current, [sentence.id]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      checkSentence();
                    }
                  }}
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                {written[sentence.id] ? (
                  <Button className="gap-1.5" loading={busy} disabled={busy} onClick={nextSentence}>
                    {sentenceIndex === closeSegments.length - 1 ? 'Finish the lesson' : 'Next sentence'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button className="gap-1.5" loading={busy} disabled={busy} onClick={checkSentence}>
                    <Check className="h-4 w-4" />
                    Check
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">Enter {written[sentence.id] ? 'goes on' : 'checks the sentence'}</span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {step === CourseStep.FOCUS && focus ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Focus on{focus.title ? `: ${focus.title}` : ''}</h2>
            <p className="text-sm text-muted-foreground">Complete the dialogue with the words below. Each blank takes one of them.</p>
          </div>
          <div className="rounded-xl border bg-background p-4 sm:p-5">
            {focusMark ? (
              <BlankedText
                id={COURSE_FOCUS_ID}
                pieces={focus.passage.split(FILL_IN_BLANK)}
                values={focusValues}
                marked={focusMark.blanks}
                onType={() => {}}
                inline={false}
              />
            ) : (
              <span className="block whitespace-pre-wrap leading-[2.8]">
                {focus.passage.split(FILL_IN_BLANK).map((piece, index) => (
                  <span key={index}>
                    {piece}
                    {index < focus.blankCount ? (
                      <span className="mx-1 inline-block w-40 max-w-full align-middle">
                        <Select value={focusValues[index] || undefined} onValueChange={(word) => word && type(courseBlankKey(COURSE_FOCUS_ID, index), word)}>
                          <SelectTrigger
                            aria-label={`Blank ${index + 1}`}
                            className={cn('h-9 font-medium', focusValues[index] && 'border-primary/50 bg-primary/5')}
                          >
                            <SelectValue placeholder={`(${index + 1}) choose…`} />
                          </SelectTrigger>
                          <SelectContent>
                            {focus.words.map((word) => (
                              <SelectItem key={word} value={word}>
                                {word}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </span>
                    ) : null}
                  </span>
                ))}
              </span>
            )}
          </div>
          {focusMark ? (
            <>
              <p className={cn('font-semibold', focusMark.correct ? 'text-success' : 'text-destructive')}>
                {focusMark.correct ? 'All right!' : `${focusMark.accuracy}% right. Crossed out: the word that was expected.`}
              </p>
              <Button className="gap-1.5" onClick={() => goTo(CourseStep.CLOSE)}>
                Next: write down
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                className="gap-1.5"
                loading={busy}
                disabled={busy || unfilledBlanks(COURSE_FOCUS_ID, focus.blankCount, answers).length > 0}
                onClick={checkFocus}
              >
                <Check className="h-4 w-4" />
                Check
              </Button>
              {unfilledBlanks(COURSE_FOCUS_ID, focus.blankCount, answers).length ? (
                <span className="text-sm text-muted-foreground">Fill every blank to check.</span>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {step === CourseStep.REVIEW && result ? (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your score</p>
            <p className={cn('mt-2 text-5xl font-bold tracking-tight', result.passed ? 'text-success' : 'text-foreground')}>{result.score}%</p>
            <p className="mt-2 font-semibold">{result.passed ? 'Lesson passed!' : `Not passed yet: ${result.passPercent}% is needed.`}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Best {result.bestScore}% · {result.attemptCount} time{result.attemptCount === 1 ? '' : 's'}. Each question counts as one point (a completed
              sentence by its blanks right), the Focus on dialogue as one, and each sentence by how much of it is right.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant={result.passed ? 'outline' : 'default'} className="gap-1.5" onClick={restart}>
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
              {/* What the course opens next; this lesson again while it is not passed. */}
              {result.next && result.next.lessonId !== lesson.id ? (
                <Button variant={result.passed ? 'default' : 'outline'} className="gap-1.5" onClick={() => navigate(nextPath(result.next))}>
                  {nextKind[result.next.type]}: {result.next.title}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button asChild variant={result.passed ? 'default' : 'outline'}>
                  <Link to="/student/listening-course">Back to the course</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Questions</h2>
            {result.questions.map((question, index) => (
              <CourseQuestion key={question.id} number={index + 1} question={question} marked={question} onChoose={() => {}} />
            ))}
          </div>

          {result.focus ? (
            <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Focus on{result.focus.title ? `: ${result.focus.title}` : ''}</h2>
                <span className={cn('ml-auto font-semibold tabular-nums', result.focus.correct ? 'text-success' : 'text-destructive')}>
                  {result.focus.accuracy}%
                </span>
              </div>
              <div className="rounded-xl border bg-background p-4 text-sm">
                <BlankedText
                  id={COURSE_FOCUS_ID}
                  pieces={result.focus.passage.split(FILL_IN_BLANK)}
                  values={result.focus.blanks.map((blank) => blank.typed)}
                  marked={result.focus.blanks}
                  onType={() => {}}
                  inline={false}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Sentences you wrote</h2>
            <ol className="space-y-3">
              {result.sentences.map((item, index) => (
                <li key={item.id} className="space-y-1 rounded-xl border bg-background p-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Sentence {index + 1}</span>
                    <span className={cn('ml-auto font-semibold tabular-nums', item.accuracy === 100 ? 'text-success' : 'text-destructive')}>
                      {item.accuracy}%
                    </span>
                  </div>
                  <CheckedWords words={item.words} />
                  <p className="text-muted-foreground">You wrote: {item.typed || '(nothing)'}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Transcript</h2>
            </div>
            {data.audioUrl ? <audio src={data.audioUrl} controls controlsList="nodownload" preload="none" className="w-full" /> : null}
            <ol className="space-y-2 text-sm">
              {result.transcript.map((segment) => (
                <li key={segment.id} className={cn('rounded-lg px-3 py-2', segment.writtenDown ? 'bg-primary/5 font-medium' : '')}>
                  {segment.speaker ? <span className="mr-2 text-muted-foreground">{segment.speaker}:</span> : null}
                  {segment.text}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">Highlighted: the sentences you wrote down.</p>
          </div>

          {keywords.length ? (
            <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Keywords</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {keywords.map((keyword) => (
                  <li key={keyword.id} className="rounded-lg border bg-background px-4 py-3">
                    <p className="font-semibold">{keyword.word}</p>
                    <p className="text-sm text-muted-foreground">{keyword.meaning}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
