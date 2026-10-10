import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { useToast } from '../../../hooks/use-toast.js';
import { Button, Input, Label, Skeleton } from '../../../components/ui';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import {
  getPlacementSettings,
  updatePlacementSettings,
} from '../api/placement-settings-api.js';

// Whole percent between 1 and 100, or null.
function percent(text) {
  const value = Number(text);
  return /^\d+$/.test(text) && value >= 1 && value <= 100 ? value : null;
}

// The score thresholds that decide the unit a learner starts at.
export function PlacementSettingsPage() {
  const { toast } = useToast();
  const [state, setState] = useState('loading');
  const [saved, setSaved] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(null);
  const [form, setForm] = useState({ unit2Threshold: '', unit3Threshold: '' });
  const [busy, setBusy] = useState(false);

  function apply(data) {
    setSaved(data.settings);
    setDurationMinutes(data.durationMinutes);
    setForm({
      unit2Threshold: String(data.settings.unit2Threshold),
      unit3Threshold: String(data.settings.unit3Threshold),
    });
  }

  async function load() {
    setState('loading');
    try {
      apply((await getPlacementSettings()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      toast({
        title: 'Could not load the placement settings',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state === 'loading') return <Skeleton className="h-64 w-full" />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  const unit2 = percent(form.unit2Threshold);
  const unit3 = percent(form.unit3Threshold);
  const problem =
    unit2 === null || unit3 === null
      ? 'Enter whole numbers from 1 to 100.'
      : unit2 >= unit3
        ? 'The unit 3 threshold must be higher than the unit 2 threshold.'
        : null;
  const changed = unit2 !== saved.unit2Threshold || unit3 !== saved.unit3Threshold;

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      apply((await updatePlacementSettings({ unit2Threshold: unit2, unit3Threshold: unit3 })).data);
      toast({ title: 'Placement thresholds saved' });
    } catch (error) {
      toast({
        title: 'Could not save the thresholds',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Placement"
        description={`New learners take a ${durationMinutes}-minute placement test once. Their score decides the unit they start at.`}
      />
      <form onSubmit={onSubmit} className="max-w-xl space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="unit2">Start at unit 2 from (%)</Label>
            <Input
              id="unit2"
              inputMode="numeric"
              value={form.unit2Threshold}
              onChange={(event) => setForm({ ...form, unit2Threshold: event.target.value.trim() })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit3">Start at unit 3 from (%)</Label>
            <Input
              id="unit3"
              inputMode="numeric"
              value={form.unit3Threshold}
              onChange={(event) => setForm({ ...form, unit3Threshold: event.target.value.trim() })}
            />
          </div>
        </div>
        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Below {unit2}% a learner starts at unit 1, from {unit2}% at unit 2 and
            from {unit3}% at unit 3. A learner never starts beyond the last
            published unit.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Changes apply to tests finished from now on; earlier results keep
          their starting unit.
        </p>
        <Button type="submit" disabled={busy || Boolean(problem) || !changed}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </section>
  );
}
