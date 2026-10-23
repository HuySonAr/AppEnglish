import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Headphones, Pencil, Target, Timer, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GOAL_SCORE } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '../../../components/ui';
import { DatePicker } from '../../../components/shared/DatePicker.jsx';
import { toIsoDay } from '../../../lib/calendar.js';
import { deleteStudyGoal, saveStudyGoal } from '../api/goal-api.js';
import { GOAL_PRESETS, goalSummary } from '../lib/study-plan.js';

const taskIcons = { mock: Timer, lesson: BookOpen, listening: Headphones };
const EXAM_SHORTCUTS = [
  { label: 'In 1 month', months: 1 },
  { label: 'In 2 months', months: 2 },
  { label: 'In 3 months', months: 3 },
  { label: 'In 6 months', months: 6 },
];

function GoalDialog({ open, onOpenChange, goal, onSaved }) {
  const [target, setTarget] = useState('650');
  const [examDate, setExamDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget(String(goal?.targetScore ?? 650));
    setExamDate(goal?.examDate || '');
  }, [open]);

  const value = Number(target);
  const valid = Number.isInteger(value) && value >= GOAL_SCORE.min && value <= GOAL_SCORE.max && value % GOAL_SCORE.step === 0;

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

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveStudyGoal({ targetScore: value, examDate: examDate || null }), 'Goal saved');
          }}
        >
          <DialogHeader>
            <DialogTitle>Your TOEIC goal</DialogTitle>
            <DialogDescription>Your daily plan follows this target.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="goal-target">Target score</Label>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={value === preset}
                  onClick={() => setTarget(String(preset))}
                  className={cn(
                    'h-9 rounded-md border px-3 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    value === preset ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Input id="goal-target" inputMode="numeric" className="w-32" value={target} onChange={(event) => setTarget(event.target.value.trim())} aria-invalid={!valid} />
            {!valid ? <p className="text-xs text-destructive">A multiple of 5 from 10 to 990.</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-date">Exam date (optional)</Label>
            <DatePicker id="goal-date" value={examDate} min={toIsoDay(new Date())} onChange={setExamDate} placeholder="No exam date" title="Exam date" shortcuts={EXAM_SHORTCUTS} />
          </div>
          <DialogFooter className={goal ? 'sm:justify-between' : undefined}>
            {goal ? (
              <Button type="button" variant="ghost" className="text-destructive" disabled={busy} onClick={() => run(deleteStudyGoal, 'Goal removed')}>
                Remove goal
              </Button>
            ) : null}
            <Button type="submit" loading={busy} disabled={busy || !valid}>
              Save goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanList({ tasks }) {
  if (!tasks.length) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing to suggest yet.</p>;
  return (
    <ol className="space-y-2">
      {tasks.map((task, index) => {
        const Icon = taskIcons[task.kind] || BookOpen;
        return (
          <li key={task.key}>
            <Link
              to={task.to}
              state={task.state}
              className="group flex items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {task.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{task.detail}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function GoalPlanCard({ data, tasks, failed, onChange }) {
  const [editing, setEditing] = useState(false);
  const summary = goalSummary(data);
  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="space-y-4 lg:border-r lg:pr-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Target className="h-4 w-4 text-primary" />
            Your goal
          </h2>
          {summary ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : null}
        </div>
        {failed ? (
          <p className="text-sm text-muted-foreground">Could not load your goal.</p>
        ) : summary ? (
          <>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Now</p>
                <p className="text-3xl font-bold tabular-nums">{summary.current ?? '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="text-3xl font-bold tabular-nums text-primary">{summary.targetScore}</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className={cn('h-full rounded-full', summary.reached ? 'bg-success' : 'bg-primary')} style={{ width: `${summary.percent}%` }} />
            </div>
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
            {summary.examDate ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Exam on {summary.examDate} · {summary.daysLeft} day{summary.daysLeft === 1 ? '' : 's'} left
              </p>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Set a target score to get a plan for each day.</p>
            <Button className="gap-1.5" onClick={() => setEditing(true)}>
              <Target className="h-4 w-4" />
              Set my goal
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <h2 className="font-semibold">Today&apos;s plan</h2>
        <PlanList tasks={tasks} />
      </div>
      <GoalDialog open={editing} onOpenChange={setEditing} goal={data?.goal || null} onSaved={onChange} />
    </div>
  );
}
