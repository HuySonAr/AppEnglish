import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarCheck, CalendarDays, Mic, MicVocal, Pencil, PenLine, Target, Timer, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { GOAL_SCORE, SW_GOAL_SCORE } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '../../../components/ui';
import { DatePicker } from '../../../components/shared/DatePicker.jsx';
import { CountUp } from '../../../components/shared/CountUp.jsx';
import { ProgressBar } from '../../../components/shared/ProgressBar.jsx';
import { SectionCard } from '../../../components/shared/SectionCard.jsx';
import { EASE_OUT } from '../../../lib/motion.js';
import { toIsoDay } from '../../../lib/calendar.js';
import { deleteStudyGoal, saveStudyGoal } from '../api/goal-api.js';
import { GOAL_PRESETS, SW_GOAL_PRESETS, goalSummary } from '../lib/study-plan.js';
import { swResultPath } from '../lib/sw-score.js';

const taskIcons = { mock: Timer, lesson: BookOpen, swTest: MicVocal };
const practiceIcons = { speaking: Mic, writing: PenLine };
const EXAM_SHORTCUTS = [
  { label: 'In 1 month', months: 1 },
  { label: 'In 2 months', months: 2 },
  { label: 'In 3 months', months: 3 },
  { label: 'In 6 months', months: 6 },
];

const inRange = (value, range) => Number.isInteger(value) && value >= range.min && value <= range.max && value % range.step === 0;
const swValid = (raw) => raw === '' || inRange(Number(raw), SW_GOAL_SCORE);
const swValue = (raw) => (raw === '' ? null : Number(raw));

function PresetChips({ presets, value, onPick, label }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={value === preset}
          onClick={() => onPick(preset)}
          className={cn(
            'h-9 rounded-md border px-3 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === preset ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
          )}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}

function GroupToggle({ id, checked, onChange, title, detail }) {
  return (
    <label
      htmlFor={id}
      className={cn('flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors', checked ? 'border-primary/40 bg-primary/5' : 'hover:bg-accent/60')}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function SwTargetField({ id, label, value, onChange }) {
  const valid = swValid(value);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} target (optional)</Label>
      <PresetChips presets={SW_GOAL_PRESETS} value={swValue(value)} label={`${label} target`} onPick={(preset) => onChange(swValue(value) === preset ? '' : String(preset))} />
      <Input id={id} inputMode="numeric" className="w-32" placeholder="No target" value={value} onChange={(event) => onChange(event.target.value.trim())} aria-invalid={!valid} />
      {!valid ? <p className="text-xs text-destructive">A multiple of 10 from 10 to 200.</p> : null}
    </div>
  );
}

function GoalDialog({ open, onOpenChange, goal, onSaved }) {
  const [withLr, setWithLr] = useState(true);
  const [withSw, setWithSw] = useState(false);
  const [target, setTarget] = useState('650');
  const [examDate, setExamDate] = useState('');
  const [speaking, setSpeaking] = useState('');
  const [writing, setWriting] = useState('');
  const [swExamDate, setSwExamDate] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWithLr(goal ? Boolean(goal.lr) : true);
    setWithSw(Boolean(goal?.sw));
    setTarget(String(goal?.lr?.targetScore ?? 650));
    setExamDate(goal?.lr?.examDate || '');
    setSpeaking(goal?.sw?.speakingTarget ? String(goal.sw.speakingTarget) : '');
    setWriting(goal?.sw?.writingTarget ? String(goal.sw.writingTarget) : '');
    setSwExamDate(goal?.sw?.examDate || '');
    setTried(false);
  }, [open]);

  const value = Number(target);
  const lrValid = !withLr || inRange(value, GOAL_SCORE);
  const swFieldsValid = !withSw || (swValid(speaking) && swValid(writing));
  const noGroup = !withLr && !withSw;
  const swMissing = withSw && speaking === '' && writing === '';
  const today = toIsoDay(new Date());

  async function run(action, title) {
    setBusy(true);
    try {
      onSaved((await action()).data);
      notify({ title });
      onOpenChange(false);
    } catch (error) {
      notify({ title: 'Could not save your goal', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    setTried(true);
    if (noGroup || swMissing || !lrValid || !swFieldsValid) return;
    run(
      () =>
        saveStudyGoal({
          lr: withLr ? { targetScore: value, examDate: examDate || null } : null,
          sw: withSw ? { speakingTarget: swValue(speaking), writingTarget: swValue(writing), examDate: swExamDate || null } : null,
        }),
      'Goal saved',
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form className="space-y-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Your TOEIC goal</DialogTitle>
            <DialogDescription>Choose the tests you prepare for and set your targets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <GroupToggle id="goal-lr" checked={withLr} onChange={setWithLr} title="Listening & Reading" detail="Score 10–990" />
              <GroupToggle id="goal-sw" checked={withSw} onChange={setWithSw} title="Speaking & Writing" detail="Score up to 200 each" />
            </div>
            {tried && noGroup ? <p className="text-xs text-destructive">Choose at least one test.</p> : null}
          </div>
          {withLr ? (
            <fieldset className="space-y-4 rounded-2xl border p-4">
              <legend className="px-1 text-sm font-semibold">Listening & Reading</legend>
              <div className="space-y-2">
                <Label htmlFor="goal-target">Target score</Label>
                <PresetChips presets={GOAL_PRESETS} value={value} label="Target score" onPick={(preset) => setTarget(String(preset))} />
                <Input id="goal-target" inputMode="numeric" className="w-32" value={target} onChange={(event) => setTarget(event.target.value.trim())} aria-invalid={!lrValid} />
                {!lrValid ? <p className="text-xs text-destructive">A multiple of 5 from 10 to 990.</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-date">Exam date (optional)</Label>
                <DatePicker id="goal-date" value={examDate} min={today} onChange={setExamDate} placeholder="No exam date" title="Exam date" shortcuts={EXAM_SHORTCUTS} />
              </div>
            </fieldset>
          ) : null}
          {withSw ? (
            <fieldset className="space-y-4 rounded-2xl border p-4">
              <legend className="px-1 text-sm font-semibold">Speaking & Writing</legend>
              <SwTargetField id="goal-speaking" label="Speaking" value={speaking} onChange={setSpeaking} />
              <SwTargetField id="goal-writing" label="Writing" value={writing} onChange={setWriting} />
              {tried && swMissing ? <p className="text-xs text-destructive">Set a Speaking or a Writing target.</p> : null}
              <div className="space-y-2">
                <Label htmlFor="goal-sw-date">Exam date (optional)</Label>
                <DatePicker id="goal-sw-date" value={swExamDate} min={today} onChange={setSwExamDate} placeholder="No exam date" title="Exam date" shortcuts={EXAM_SHORTCUTS} />
              </div>
            </fieldset>
          ) : null}
          <DialogFooter className={goal ? 'sm:justify-between' : undefined}>
            {goal ? (
              <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={() => run(deleteStudyGoal, 'Goal removed')}>
                Remove goal
              </Button>
            ) : null}
            <Button type="submit" loading={busy} disabled={busy || !lrValid || !swFieldsValid}>
              Save goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TodayPlanCard({ tasks }) {
  return (
    <SectionCard title="Today's plan" icon={CalendarCheck} className="h-full">
      {tasks.length ? (
        <ol className="space-y-2">
          {tasks.map((task, index) => {
            const Icon = (task.kind === 'swPractice' ? practiceIcons[task.skill] : taskIcons[task.kind]) || BookOpen;
            return (
              <motion.li key={task.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.25 + index * 0.08 }}>
                <Link
                  to={task.to}
                  state={task.state}
                  className="group flex items-center gap-3 rounded-2xl border bg-background p-3 transition-colors hover:border-primary/30 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {task.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{task.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </motion.li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing to suggest yet.</p>
      )}
    </SectionCard>
  );
}

function ExamDays({ examDate, daysLeft }) {
  if (!examDate) return null;
  return (
    <p className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
      <CalendarDays className="h-3.5 w-3.5" />
      Exam on {examDate} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left
    </p>
  );
}

function GroupTitle({ children }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

function LrGoal({ summary, titled }) {
  return (
    <div className="space-y-4">
      {titled ? <GroupTitle>Listening & Reading</GroupTitle> : null}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Now</p>
          <p className="text-3xl font-bold tabular-nums">{summary.current === null ? '—' : <CountUp value={summary.current} />}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Target</p>
          <p className="text-3xl font-bold tabular-nums text-primary">
            <CountUp value={summary.targetScore} />
          </p>
        </div>
      </div>
      <ProgressBar value={summary.percent} barClassName={summary.reached ? 'bg-success' : undefined} />
      <p className="text-sm">
        {summary.reached ? (
          <span className="flex items-center gap-1.5 font-medium text-success">
            <Trophy className="h-4 w-4" />
            Target reached. Set a higher one?
          </span>
        ) : summary.current === null ? (
          'Take a full mock test to get your score.'
        ) : (
          <>
            <span className="font-semibold tabular-nums">{summary.gap}</span> points to go
            {summary.perWeek ? (
              <span className="text-muted-foreground">
                {' '}
                · about <span className="tabular-nums">{summary.perWeek}</span> a week
              </span>
            ) : null}
          </>
        )}
      </p>
      <ExamDays examDate={summary.examDate} daysLeft={summary.daysLeft} />
    </div>
  );
}

function SwGoal({ summary }) {
  const parts = [
    { key: 'speaking', label: 'Speaking', icon: Mic, target: summary.speakingTarget, now: summary.speakingNow },
    { key: 'writing', label: 'Writing', icon: PenLine, target: summary.writingTarget, now: summary.writingNow },
  ].filter((part) => part.target !== null);
  return (
    <div className="space-y-3">
      <GroupTitle>Speaking & Writing</GroupTitle>
      <div className={cn('grid gap-2', parts.length > 1 && 'grid-cols-2')}>
        {parts.map(({ key, label, icon: Icon, target, now }) => (
          <div key={key} className="rounded-2xl border bg-background p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {label} target
            </p>
            <p className="text-2xl font-bold tabular-nums text-primary">
              <CountUp value={target} />
            </p>
            {now ? (
              <Link
                to={swResultPath(now.swTestId, key, now.attemptNumber)}
                className="block rounded-md text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Now: <span className="font-semibold tabular-nums text-foreground">{now.scaled}</span>
                {now.reviewed ? ' · Reviewed by teacher' : ''}
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">Now: Appears after scoring</p>
            )}
          </div>
        ))}
      </div>
      <ExamDays examDate={summary.examDate} daysLeft={summary.daysLeft} />
    </div>
  );
}

export function GoalCard({ data, failed, onChange }) {
  const [editing, setEditing] = useState(false);
  const summary = goalSummary(data);
  return (
    <SectionCard
      title="Your goal"
      icon={Target}
      className="h-full"
      aside={
        summary ? (
          <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-full px-3" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : null
      }
    >
      {failed ? (
        <p className="text-sm text-muted-foreground">Could not load your goal.</p>
      ) : summary ? (
        <div className="space-y-5">
          {summary.lr ? <LrGoal summary={summary.lr} titled={Boolean(summary.sw)} /> : null}
          {summary.sw ? (
            <div className={cn(summary.lr && 'border-t pt-5')}>
              <SwGoal summary={summary.sw} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Set a target score to get a plan for each day.</p>
          <Button className="gap-1.5 rounded-full" onClick={() => setEditing(true)}>
            <Target className="h-4 w-4" />
            Set my goal
          </Button>
        </div>
      )}
      <GoalDialog open={editing} onOpenChange={setEditing} goal={data?.goal || null} onSaved={onChange} />
    </SectionCard>
  );
}
