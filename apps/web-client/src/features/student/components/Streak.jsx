import { Check, Flame } from 'lucide-react';
import { StreakDayState } from '@appenglish/progress-contracts';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils.js';
import { CountUp } from '../../../components/shared/CountUp.jsx';

const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const stateLabels = {
  [StreakDayState.STUDIED]: 'studied',
  [StreakDayState.REST]: 'day off',
  [StreakDayState.MISSED]: 'not studied',
  [StreakDayState.TODAY]: 'today',
  [StreakDayState.FUTURE]: 'to come',
};

function dayClass(state, size) {
  return cn(
    'flex items-center justify-center rounded-full border text-[10px] font-semibold',
    size === 'sm' ? 'h-4 w-4 rounded-[5px]' : 'h-8 w-8',
    state === StreakDayState.STUDIED && 'border-success bg-success text-white',
    state === StreakDayState.REST && 'border-dashed border-muted-foreground/50 bg-muted',
    state === StreakDayState.MISSED && 'border-border bg-background',
    state === StreakDayState.TODAY && 'border-2 border-primary bg-background text-primary',
    state === StreakDayState.FUTURE && 'border-border/60 bg-background opacity-50',
  );
}

export function StreakWeek({ week, animated = false }) {
  return (
    <ol className="flex gap-1.5" aria-label="This week">
      {week.map((item, index) => (
        <motion.li
          key={item.day}
          className="flex flex-col items-center gap-1"
          initial={animated ? { opacity: 0, scale: 0.6 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.3 + index * 0.05 }}
        >
          <span className={dayClass(item.state)} title={`${item.day}: ${stateLabels[item.state]}`}>
            {item.state === StreakDayState.STUDIED ? <Check className="h-4 w-4" /> : null}
          </span>
          <span className="text-[10px] text-muted-foreground">{weekdays[index]}</span>
        </motion.li>
      ))}
    </ol>
  );
}

export function StreakNumber({ streak }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', streak.current ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground')}>
        <Flame className="h-6 w-6" />
      </span>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-tight">
          <CountUp value={streak.current} /> <span className="text-base font-medium">day{streak.current === 1 ? '' : 's'}</span>
        </p>
        <p className="text-xs text-muted-foreground">Best {streak.longest}</p>
      </div>
    </div>
  );
}

export function StreakCard({ streak, className }) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-3xl border bg-card p-5 sm:p-6', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Your streak</h2>
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', streak.studiedToday ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
          {streak.studiedToday ? 'Done today' : 'Not yet today'}
        </span>
      </div>
      <StreakNumber streak={streak} />
      <StreakWeek week={streak.week} animated />
      <p className="mt-auto text-sm text-muted-foreground">{streak.studiedToday ? 'Come back tomorrow to keep it going.' : 'Study one step today to keep your streak.'}</p>
    </section>
  );
}

export function StreakCalendar({ streak }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StreakNumber streak={streak} />
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {[StreakDayState.STUDIED, StreakDayState.REST, StreakDayState.MISSED].map((state) => (
            <li key={state} className="flex items-center gap-1.5">
              <span className={dayClass(state, 'sm')} />
              {stateLabels[state]}
            </li>
          ))}
        </ul>
      </div>
      <div className="inline-grid grid-flow-col grid-rows-7 gap-1" aria-label="Last weeks">
        {streak.calendar.flat().map((item) => (
          <span key={item.day} className={dayClass(item.state, 'sm')} title={`${item.day}: ${stateLabels[item.state]}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">One day off a week keeps the streak.</p>
    </div>
  );
}
