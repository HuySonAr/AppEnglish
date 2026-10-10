import { useEffect, useState } from 'react';
import { ClipboardCheck, Clock, ListChecks, Repeat } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LESSON_TEST_QUESTION_COUNT } from '@appenglish/content-contracts';
import { PlacementStatus } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { useToast } from '../../../hooks/use-toast.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Skeleton,
} from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import {
  getPlacement,
  skipPlacement,
  startPlacement,
  submitPlacement,
} from '../api/placement-api.js';
import { PlacementExam } from '../components/PlacementExam.jsx';

function Fact({ icon: Icon, title, text }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}

// The result shows the score and the starting unit only.
function PlacementResult({ placement }) {
  const skipped = placement.status === PlacementStatus.SKIPPED;
  return (
    <section className="mx-auto max-w-xl space-y-6 text-center">
      <div className="rounded-2xl border bg-card p-8 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Placement test
        </p>
        {skipped ? (
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">You skipped the placement test</h1>
        ) : (
          <>
            <p className="mt-4 text-6xl font-bold tracking-tight text-primary">
              {placement.scorePercent}%
            </p>
            <p className="mt-2 text-muted-foreground">
              {placement.correctCount} of {placement.totalCount} correct
            </p>
          </>
        )}
        <div className="mt-8 rounded-xl bg-primary/10 p-5">
          <p className="text-sm text-muted-foreground">You start at</p>
          <p className="mt-1 text-2xl font-bold">Unit {placement.startUnit}</p>
        </div>
      </div>
      <Button asChild variant="outline">
        <Link to="/student">Back to home</Link>
      </Button>
    </section>
  );
}

export function PlacementPage() {
  const { toast } = useToast();
  const [state, setState] = useState('loading');
  const [placement, setPlacement] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  async function load() {
    setState('loading');
    try {
      setPlacement((await getPlacement()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      toast({
        title: 'Could not load the placement test',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Runs one placement action and shows the state it returns.
  async function run(action, failure) {
    setBusy(true);
    try {
      setPlacement((await action()).data);
    } catch (error) {
      toast({ title: failure, description: getApiErrorMessage(error), variant: 'destructive' });
      // The state may have changed on the server (e.g. the time ran out).
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <Skeleton className="h-96 w-full" />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  if (placement.status === PlacementStatus.IN_PROGRESS)
    return (
      <PlacementExam
        attempt={placement}
        submitting={busy}
        onSubmit={(answers) => run(() => submitPlacement(answers), 'Could not submit the test')}
      />
    );
  if (placement.status !== PlacementStatus.NOT_STARTED)
    return <PlacementResult placement={placement} />;

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Before lesson 1"
        title="Placement test"
        description="A short Reading and Listening test that decides the unit you start at."
      />
      {placement.available ? (
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <ul className="grid gap-5 sm:grid-cols-3">
            <Fact
              icon={ListChecks}
              title={`${LESSON_TEST_QUESTION_COUNT} questions`}
              text="Parts 1–4 are Listening, Parts 5–7 are Reading."
            />
            <Fact
              icon={Clock}
              title={`${placement.durationMinutes} minutes`}
              text="The clock starts when you begin and does not pause."
            />
            <Fact
              icon={Repeat}
              title="One attempt"
              text="You can take the test only once."
            />
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              disabled={busy}
              onClick={() => run(startPlacement, 'Could not start the test')}
            >
              Start the test
            </Button>
            <Button size="lg" variant="ghost" disabled={busy} onClick={() => setConfirmingSkip(true)}>
              Skip and start at unit 1
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={ClipboardCheck}
          title="The placement test is not available yet"
          description="You can wait for it, or skip it and start at unit 1."
          action={
            <Button variant="outline" disabled={busy} onClick={() => setConfirmingSkip(true)}>
              Skip and start at unit 1
            </Button>
          }
        />
      )}

      <AlertDialog open={confirmingSkip} onOpenChange={setConfirmingSkip}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip the placement test?</AlertDialogTitle>
            <AlertDialogDescription>
              You will start at unit 1 and cannot take the placement test later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(skipPlacement, 'Could not skip the test')}>
              Skip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
