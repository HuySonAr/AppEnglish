import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { EtsWritingTask, SwSection } from '@appenglish/content-contracts';
import { LearningResponseCode } from '@appenglish/learning-contracts';
import { Button } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { errorCode, getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { countWords } from '../../../lib/practice-prompts.js';
import { cn } from '../../../lib/utils.js';
import { useCountdown } from '../hooks/use-recorder.js';
import { answersFor, groupIndexAfter, recommendedWords, writingGroups } from '../lib/sw-exam.js';
import { saveSwAnswers, submitSwAttempt } from '../api/sw-test-api.js';
import { ConfirmDialog, ExamBar, SwPrompt, TaskHeading, useLeaveDialog } from './SwExamParts.jsx';

const ANSWER_MAX = 8000;
const SAVE_DELAY_MS = 800;
const LOW_TIME_SECONDS = 60;

const guidance = {
  [EtsWritingTask.PICTURE_SENTENCE]: 'Write one sentence about the picture using both words.',
  [EtsWritingTask.RESPOND_EMAIL]: 'Reply to the email.',
  [EtsWritingTask.OPINION_ESSAY]: 'Write your essay.',
};
const rowsFor = { [EtsWritingTask.PICTURE_SENTENCE]: 3, [EtsWritingTask.RESPOND_EMAIL]: 12, [EtsWritingTask.OPINION_ESSAY]: 16 };

function GroupClock({ seconds, onDone, children }) {
  const left = useCountdown(seconds, true, onDone);
  return children(left);
}

export function SwWritingExam({ testId, attempt, onDone, onExpired, onDiscard }) {
  const items = attempt.items;
  const [groups] = useState(() => writingGroups(items));
  const [groupIndex, setGroupIndex] = useState(() => groupIndexAfter(groups, attempt.lockedThrough));
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState(() => ({ ...(attempt.answers || {}) }));
  const [moving, setMoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const groupRef = useRef(groupIndex);
  groupRef.current = groupIndex;
  const serverLocked = useRef(attempt.lockedThrough || 0);
  const movingRef = useRef(false);
  const touched = useRef(false);
  const leave = useLeaveDialog(onDiscard);
  const expired = (error) => errorCode(error) === LearningResponseCode.SW_ATTEMPT_NOT_IN_PROGRESS;

  function save(lockThrough) {
    const group = groups[Math.min(groupRef.current, groups.length - 1)];
    const open = items.map((item) => item.number).filter((number) => number > serverLocked.current && number <= group.lockThrough);
    return saveSwAnswers(testId, answersFor(answersRef.current, open), lockThrough).then((result) => {
      if (typeof result?.data?.lockedThrough === 'number') serverLocked.current = result.data.lockedThrough;
      return result;
    });
  }

  useEffect(() => {
    if (!touched.current || groupIndex >= groups.length) return undefined;
    const timer = setTimeout(() => {
      save().catch((error) => {
        if (expired(error)) onExpired();
      });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [answers]);

  async function finish() {
    setFinishing('sending');
    try {
      await save(groups.at(-1).lockThrough);
      onDone((await submitSwAttempt(testId, SwSection.WRITING)).data);
    } catch (error) {
      if (expired(error)) return onExpired();
      setFinishing('failed');
      notify({ title: 'Could not submit the test', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  async function endGroup() {
    if (movingRef.current) return;
    movingRef.current = true;
    setMoving(true);
    const current = groupRef.current;
    if (current >= groups.length - 1) {
      movingRef.current = false;
      setMoving(false);
      setGroupIndex(groups.length);
      finish();
      return;
    }
    try {
      await save(groups[current].lockThrough);
    } catch (error) {
      if (expired(error)) return onExpired();
      notify({ title: 'Your answers will be sent with the next save', description: getApiErrorMessage(error), variant: 'warning' });
    }
    setGroupIndex(current + 1);
    setPosition(0);
    movingRef.current = false;
    setMoving(false);
    window.scrollTo({ top: 0 });
  }

  useEffect(() => {
    if (groupIndex >= groups.length && !finishing) finish();
  }, []);

  if (finishing || groupIndex >= groups.length)
    return (
      <section className="space-y-6">
        <div className="mx-auto max-w-xl space-y-4 rounded-3xl border bg-card p-6 text-center shadow-xs">
          <p className="font-medium">{finishing === 'failed' ? 'The test was not submitted.' : 'Submitting your test…'}</p>
          {finishing === 'failed' ? <Button onClick={finish}>Try again</Button> : null}
        </div>
        {leave.dialog}
      </section>
    );

  const group = groups[groupIndex];
  const number = group.numbers[Math.min(position, group.numbers.length - 1)];
  const item = items.find((entry) => entry.number === number);
  const answer = String(answers[number] ?? '');
  const words = countWords(answer);
  const aim = recommendedWords(item);
  const lastInGroup = position >= group.numbers.length - 1;
  const lastGroup = groupIndex === groups.length - 1;
  const groupLabel = group.numbers.length > 1 ? `questions ${group.numbers[0]}–${group.numbers.at(-1)}` : `question ${group.numbers[0]}`;

  return (
    <GroupClock key={groupIndex} seconds={group.seconds} onDone={endGroup}>
      {(left) => (
        <section className="space-y-6">
          <ExamBar section="Writing" number={number} total={items.length} clock={left} lowTime={left <= LOW_TIME_SECONDS} onLeave={leave.open} />

          {group.numbers.length > 1 ? (
            <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Questions">
              {group.numbers.map((value, index) => {
                const done = Boolean(String(answers[value] ?? '').trim());
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={index === position}
                    onClick={() => setPosition(index)}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                      index === position ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-primary/40 bg-primary/10 text-primary' : 'hover:bg-accent',
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className={cn('mx-auto grid max-w-5xl gap-6', item.task === EtsWritingTask.RESPOND_EMAIL && 'lg:grid-cols-2')}>
            <div className="space-y-4 rounded-3xl border bg-card p-5 shadow-xs sm:p-6">
              <TaskHeading item={item} total={items.length} />
              <SwPrompt item={item} />
            </div>
            <div className="space-y-3 rounded-3xl border bg-card p-5 shadow-xs sm:p-6">
              <label htmlFor={`sw-answer-${number}`} className="text-sm font-medium">
                {guidance[item.task]}
              </label>
              <Textarea
                id={`sw-answer-${number}`}
                rows={rowsFor[item.task]}
                maxLength={ANSWER_MAX}
                value={answer}
                disabled={moving}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  touched.current = true;
                  const value = event.target.value;
                  setAnswers((current) => ({ ...current, [number]: value }));
                }}
              />
              <p className="text-xs text-muted-foreground" aria-live="polite">
                <span className={cn('font-semibold tabular-nums', aim && words >= aim ? 'text-success' : 'text-foreground')}>
                  {words} {words === 1 ? 'word' : 'words'}
                </span>
                {aim ? ` · Aim for ${aim}+ words` : ''}
              </p>
            </div>
          </div>

          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            {group.numbers.length > 1 ? (
              <Button variant="outline" className="gap-1.5" disabled={position === 0 || moving} onClick={() => setPosition((value) => value - 1)}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            ) : null}
            <div className="ml-auto flex gap-2">
              {lastInGroup ? (
                <Button className="gap-1.5" loading={moving} disabled={moving} onClick={() => setConfirming(true)}>
                  {lastGroup ? <Send className="h-4 w-4" /> : null}
                  {lastGroup ? 'Submit' : 'Continue'}
                  {lastGroup ? null : <ChevronRight className="h-4 w-4" />}
                </Button>
              ) : (
                <Button variant="outline" className="gap-1.5" disabled={moving} onClick={() => setPosition((value) => value + 1)}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={lastGroup ? 'Submit the Writing test?' : 'Move on?'}
            description={lastGroup ? 'You cannot change your answers after this.' : `You cannot come back to ${groupLabel}.`}
            confirmLabel={lastGroup ? 'Submit' : 'Continue'}
            onConfirm={endGroup}
          />
          {leave.dialog}
        </section>
      )}
    </GroupClock>
  );
}
