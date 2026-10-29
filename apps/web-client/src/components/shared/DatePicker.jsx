import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { WEEKDAYS, addMonths, daysBetween, formatLongDay, monthGrid, toIsoDay } from '../../lib/calendar.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog.jsx';

function Calendar({ value, min, today, onPick }) {
  const [view, setView] = useState(() => (value || min || today).slice(0, 7));
  const [year, month] = view.split('-').map(Number);
  const weeks = monthGrid(year, month - 1);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const minMonth = min ? min.slice(0, 7) : null;
  const move = (count) => setView(addMonths(`${view}-01`, count).slice(0, 7));

  useEffect(() => {
    if (value) setView(value.slice(0, 7));
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Previous month" disabled={Boolean(minMonth) && view <= minMonth} onClick={() => move(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button type="button" className="rounded-md px-2 py-1 text-sm font-semibold hover:bg-accent" title="Back to this month" onClick={() => setView(today.slice(0, 7))} aria-live="polite">
          {monthLabel}
        </button>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Next month" onClick={() => move(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-[11px] font-medium uppercase text-muted-foreground">
            {day}
          </span>
        ))}
        {weeks.flat().map((day) => {
          const disabled = Boolean(min) && day.iso < min;
          const selected = day.iso === value;
          const isToday = day.iso === today;
          return (
            <button
              key={day.iso}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={formatLongDay(day.iso)}
              disabled={disabled}
              onClick={() => onPick(day.iso)}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md text-sm tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                !day.inMonth && 'text-muted-foreground/50',
                disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-accent',
                isToday && !selected && 'font-semibold text-primary ring-1 ring-inset ring-primary/40',
                selected && 'bg-primary font-semibold text-primary-foreground hover:bg-primary',
              )}
            >
              {day.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({ id, value, onChange, min, placeholder = 'Pick a date', title = 'Choose a date', shortcuts = [] }) {
  const today = toIsoDay(new Date());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || '');

  const openPicker = () => {
    setDraft(value || '');
    setOpen(true);
  };
  const confirm = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        id={id}
        type="button"
        onClick={openPicker}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn('truncate', !value && 'text-muted-foreground')}>{value ? formatLongDay(value) : placeholder}</span>
        {value ? <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">in {daysBetween(today, value)} days</span> : null}
      </button>
      {value ? (
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Clear the date" onClick={() => onChange('')}>
          <X className="h-4 w-4" />
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-88 gap-4 p-5">
          <DialogHeader className="text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{draft ? `${formatLongDay(draft)} · in ${daysBetween(today, draft)} days` : 'No date chosen yet.'}</DialogDescription>
          </DialogHeader>
          {shortcuts.length ? (
            <div className="flex flex-wrap gap-1.5">
              {shortcuts.map((shortcut) => {
                const iso = addMonths(today, shortcut.months);
                return (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => setDraft(iso)}
                    className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent', draft === iso && 'border-primary bg-primary/10 text-primary')}
                  >
                    {shortcut.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <Calendar key={open ? 'open' : 'closed'} value={draft} min={min} today={today} onPick={setDraft} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!draft} onClick={confirm}>
              Choose this date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
