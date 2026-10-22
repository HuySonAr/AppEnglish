import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Trophy } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button } from '../../../components/ui';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getCourseTest, submitCourseTest } from '../api/course-api.js';
import { CourseTestSection, firstNumbers } from '../components/CourseTestSection.jsx';
import { unanswered } from '../lib/listening-course.js';

// The level test of a level of the Listening course (D145): recordings with
// multiple-choice questions, untimed, each recording heard at its own speed
// at most twice; every question answered, then the answers are scored and the
// best score kept. Passing opens the next level; the review shows the
// answers, the explanations and the transcripts.
export function CourseTestPage() {
  const { itemId } = useParams();
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  // Option id by question id.
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setState('loading');
    try {
      setData((await getCourseTest(itemId)).data);
      setAnswers({});
      setResult(null);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not open the test', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [itemId]);


  async function submit() {
    setBusy(true);
    try {
      const scored = (await submitCourseTest(itemId, { versionId: data.versionId, answers })).data;
      document.querySelectorAll('audio').forEach((audio) => audio.pause());
      setResult(scored);
      setData((current) => ({ ...current, bestScore: scored.bestScore, attemptCount: scored.attemptCount, passed: scored.testPassed }));
      window.scrollTo({ top: 0 });
    } catch (error) {
      notify({ title: 'Could not submit your answers', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setAnswers({});
    setResult(null);
    window.scrollTo({ top: 0 });
  }

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

  const { test } = data;
  const questions = data.sections.flatMap((section) => section.questions);
  const missing = unanswered(questions, answers).length;
  const sections = result ? result.sections : data.sections;
  const firsts = firstNumbers(sections);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {back}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{test.level}</Badge>
          <Badge variant="outline">Level test</Badge>
          {data.passed ? <Badge variant="success">Passed</Badge> : null}
          {data.bestScore !== null ? <span className="text-sm text-muted-foreground">Best {data.bestScore}%</span> : null}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{test.title}</h1>
        {!result ? (
          <p className="text-muted-foreground">
            {questions.length} questions on {data.sections.length} recording{data.sections.length === 1 ? '' : 's'}, no time limit. Pass with{' '}
            {data.passPercent}% to open {test.nextLevel || 'the next level'}. Each recording plays at its own speed, at most twice.
          </p>
        ) : null}
      </div>

      {result ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          {result.levelUp ? (
            <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-success/10 px-4 py-3 font-semibold text-success">
              <Trophy className="h-5 w-5" />
              {`${result.levelUp.to} is open!`}
            </div>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your score</p>
          <p className={cn('mt-2 text-5xl font-bold tracking-tight', result.passed ? 'text-success' : 'text-foreground')}>{result.score}%</p>
          <p className="mt-2 font-semibold">
            {result.rightCount} of {result.questionCount} right · {result.passed ? 'passed' : `${result.passPercent}% is needed`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Best {result.bestScore}% · {result.attemptCount} time{result.attemptCount === 1 ? '' : 's'}.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant={result.passed ? 'outline' : 'default'} className="gap-1.5" onClick={again}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button asChild variant={result.passed ? 'default' : 'outline'} className="gap-1.5">
              <Link to={result.levelUp ? `/student/listening-course?level=${result.levelUp.to}` : '/student/listening-course'}>
                {result.levelUp ? `Go to ${result.levelUp.to}` : 'Back to the course'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {sections.map((section, index) => (
        <CourseTestSection
          key={`${result ? 'review' : 'test'}-${section.id}`}
          index={index}
          section={section}
          first={firsts[index]}
          versionId={data.versionId}
          answers={result ? null : answers}
          onChoose={(questionId, optionId) => setAnswers((current) => ({ ...current, [questionId]: optionId }))}
        />
      ))}

      {!result ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button className="gap-1.5" loading={busy} disabled={busy || missing > 0} onClick={submit}>
            <Check className="h-4 w-4" />
            Submit answers
          </Button>
          {missing ? (
            <span className="text-sm text-muted-foreground">
              {missing} question{missing === 1 ? '' : 's'} left to answer.
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
