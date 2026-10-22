import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button, Label, Skeleton } from '../../../components/ui';
import { Textarea } from '../../../components/ui/textarea.jsx';
import { PageHeader } from '../../../components/shared/PageHeader.jsx';
import { getScoreConversion, updateScoreConversion } from '../api/placement-settings-api.js';
import { FormPageSkeleton } from '../../../components/shared/PageSkeleton.jsx';

const sections = [
  { key: 'listening', label: 'Listening' },
  { key: 'reading', label: 'Reading' },
];

// "5, 5, 10, …" -> the 101 scores, or a message saying what is wrong.
function parseTable(text) {
  const values = text.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (values.length !== 101) return { error: `Needs 101 scores (for 0 to 100 right answers); it has ${values.length}.` };
  if (values.some((value) => !Number.isInteger(value) || value < 5 || value > 495 || value % 5))
    return { error: 'Every score must be a multiple of 5 from 5 to 495.' };
  if (values.some((value, index) => index && value < values[index - 1]))
    return { error: 'Scores must not go down as right answers go up.' };
  return { values };
}

// The table that turns right answers of a full mock test into an estimated
// TOEIC section score.
export function ScoreConversionPage() {
  const [state, setState] = useState('loading');
  const [saved, setSaved] = useState(null);
  const [isDefault, setIsDefault] = useState(true);
  const [text, setText] = useState({ listening: '', reading: '' });
  const [busy, setBusy] = useState(false);

  function apply(data) {
    setSaved(data.conversion);
    setIsDefault(data.isDefault);
    setText({ listening: data.conversion.listening.join(', '), reading: data.conversion.reading.join(', ') });
  }

  async function load() {
    setState('loading');
    try {
      apply((await getScoreConversion()).data);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load the score table', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state === 'loading') return <FormPageSkeleton />;
  if (state === 'error')
    return (
      <Button variant="outline" onClick={load}>
        Try again
      </Button>
    );

  const parsed = { listening: parseTable(text.listening), reading: parseTable(text.reading) };
  const valid = parsed.listening.values && parsed.reading.values;
  const changed =
    valid && sections.some(({ key }) => parsed[key].values.join() !== saved[key].join());

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      apply((await updateScoreConversion({ listening: parsed.listening.values, reading: parsed.reading.values })).data);
      notify({ title: 'Score table saved' });
    } catch (error) {
      notify({ title: 'Could not save the score table', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Estimated score table"
        description="Correct answers of a full mock test to an estimated TOEIC section score (5–495)."
        actions={isDefault ? <Badge variant="outline">Default table</Badge> : <Badge variant="info">Edited</Badge>}
      />
      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        {sections.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`table-${key}`}>
              {label}: 101 scores, for 0 right answers up to 100, separated by commas
            </Label>
            <Textarea
              id={`table-${key}`}
              rows={6}
              className="font-mono text-xs"
              value={text[key]}
              onChange={(event) => setText({ ...text, [key]: event.target.value })}
            />
            {parsed[key].error ? (
              <p role="alert" className="text-sm text-destructive">
                {parsed[key].error}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                0 right: {parsed[key].values[0]} · 50 right: {parsed[key].values[50]} · 100 right:{' '}
                {parsed[key].values[100]}
              </p>
            )}
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          A section with another number of questions than 100 is scaled by its share of right
          answers. Changes apply to tests finished from now on; earlier results keep their estimate.
          XP and progress use the share of right answers, not this table.
        </p>
        <Button loading={busy} type="submit" disabled={busy || !changed}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </section>
  );
}
