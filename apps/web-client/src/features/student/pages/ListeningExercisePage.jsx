import { useEffect, useState } from 'react';

import { useParams, useSearchParams } from 'react-router-dom';
import { PageBreadcrumb } from '../../../components/shared/PageBreadcrumb.jsx';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { DetailPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';
import { getListeningPractice } from '../api/practice-api.js';
import { DictationPractice } from '../components/DictationPractice.jsx';
import { isHideMode, kindLabel, resultOf, toeicModeOf } from '../lib/listening-practice.js';
import { ModeSwitch } from '../components/ListeningModeSwitch.jsx';

const instructions = {
  part1: 'Write down the four statements, (A) to (D).',
  part2: 'Write down the question and the three responses.',
  part3: 'Write down each sentence of the conversation.',
  part4: 'Write down each sentence of the talk.',
  conversation: 'Write down each sentence of the conversation.',
  talk: 'Write down each sentence.',
  song: 'Write down each line.',
};
const blanksInstruction = 'Type the missing words you hear.';

export function ListeningExercisePage() {
  const { exerciseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = toeicModeOf(searchParams.get('mode'));
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  async function load() {
    setState('loading');
    try {
      setData((await getListeningPractice(exerciseId, mode)).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the exercise', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, [exerciseId, mode]);

  const topicId = data?.exercise.topic?.id;
  const back = (
    <PageBreadcrumb items={[{ label: 'Practice', to: '/student/practice' }, { label: 'Listening', to: '/student/practice/listening' }, data?.exercise.topic ? { label: data.exercise.topic.name, to: `/student/practice/listening/topics/${topicId}?mode=${mode}` } : null, { label: data?.exercise.title || 'Exercise' }]} />
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

  const { exercise } = data;
  const hidden = isHideMode(data.mode);
  const best = resultOf(data, data.mode);

  return (
    <section className="space-y-6">
      {back}
      <ExerciseHeader
        exercise={exercise}
        source={data.source}
        badges={<span className="text-sm text-muted-foreground">{kindLabel(exercise.kind)}</span>}
        instruction={hidden ? blanksInstruction : instructions[exercise.kind]}
        best={best}
        modes={<ModeSwitch mode={data.mode} onChange={(value) => setSearchParams({ mode: value }, { replace: true })} />}
      />
      <DictationPractice
        key={`${exerciseId}-${data.mode}`}
        exerciseId={exerciseId}
        data={data}
        onScored={(scored) =>
          setData((current) => {
            const latest = { bestAccuracy: scored.bestAccuracy, lastAccuracy: scored.lastAccuracy, checkCount: scored.checkCount };
            return hidden ? { ...current, [current.mode]: latest } : { ...current, ...latest };
          })
        }
      />
    </section>
  );
}

function ExerciseHeader({ exercise, badges, instruction, best, source, modes }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-2">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{exercise.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {exercise.topic ? <Badge variant="secondary">{exercise.topic.name}</Badge> : null}
          {badges}
          <span>{instruction}</span>
        </div>
        {source ? (
          <p className="text-xs text-muted-foreground">
            Source:{' '}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                {source.name}
              </a>
            ) : (
              source.name
            )}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4">
      {modes}
      {best?.checkCount ? (
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-success">{best.bestAccuracy}%</p>
          <p className="text-xs text-muted-foreground">your best</p>
        </div>
      ) : null}
      </div>
    </div>
  );
}
