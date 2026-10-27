import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { cn } from '../../../lib/utils.js';
import { Badge, Button, Input } from '../../../components/ui';
import { updateSwScoreConversion } from '../api/placement-settings-api.js';
import { SW_SCALED_MAX, SW_SCALED_STEP, checkSwTable, sameTable, toSwInputs } from '../lib/sw-conversion.js';

const sections = [
  { key: 'speaking', label: 'Speaking' },
  { key: 'writing', label: 'Writing' },
];

export function SwConversionForm({ initial }) {
  const [saved, setSaved] = useState(initial);
  const [inputs, setInputs] = useState(() => toSwInputs(initial.conversion));
  const [busy, setBusy] = useState(false);

  const checked = Object.fromEntries(sections.map(({ key }) => [key, checkSwTable(key, inputs[key])]));
  const valid = sections.every(({ key }) => checked[key].values);
  const changed = sections.some(({ key }) => !sameTable(inputs[key], saved.conversion[key]));
  const atDefaults = sections.every(({ key }) => sameTable(inputs[key], saved.defaults[key]));

  function setValue(key, index, value) {
    setInputs((current) => ({ ...current, [key]: current[key].map((item, at) => (at === index ? value.trim() : item)) }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const data = (await updateSwScoreConversion({ speaking: checked.speaking.values, writing: checked.writing.values })).data;
      setSaved(data);
      setInputs(toSwInputs(data.conversion));
      notify({ title: 'S&W score table saved' });
    } catch (error) {
      notify({ title: 'Could not save the S&W score table', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Speaking & Writing</h2>
          <p className="text-sm text-muted-foreground">Raw score to an estimated score from 0 to {SW_SCALED_MAX}, in steps of {SW_SCALED_STEP}.</p>
        </div>
        {saved.isDefault ? <Badge variant="outline">Default table</Badge> : <Badge variant="info">Edited</Badge>}
      </div>
      {sections.map(({ key, label }) => {
        const bad = new Set(checked[key].bad);
        return (
          <fieldset key={key} className="space-y-3">
            <legend className="text-sm font-medium">
              {label}: raw 0–{inputs[key].length - 1}
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-9">
              {inputs[key].map((value, index) => (
                <label key={index} className="space-y-1">
                  <span className="block text-xs tabular-nums text-muted-foreground">Raw {index}</span>
                  <Input
                    inputMode="numeric"
                    className={cn('h-9 tabular-nums', bad.has(index) && 'border-destructive')}
                    aria-invalid={bad.has(index)}
                    value={value}
                    disabled={busy}
                    onChange={(event) => setValue(key, index, event.target.value)}
                  />
                </label>
              ))}
            </div>
            {checked[key].error ? (
              <p role="alert" className="text-sm text-destructive">
                {checked[key].error}
              </p>
            ) : null}
          </fieldset>
        );
      })}
      <div className="flex flex-wrap gap-3">
        <Button loading={busy} type="submit" disabled={busy || !valid || !changed}>
          Save
        </Button>
        <Button type="button" variant="outline" className="gap-1.5" disabled={busy || atDefaults} onClick={() => setInputs(toSwInputs(saved.defaults))}>
          <RotateCcw className="h-4 w-4" />
          Reset to defaults
        </Button>
      </div>
    </form>
  );
}
