import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Button, Label, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue, Skeleton } from '../../../components/ui';
import { getAiModels, saveAiSettings } from '../api/writing-api.js';

const DEFAULT = 'default';
const levelLabels = { minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High' };

export function GeminiModelSettings({ settings, onSaved }) {
  const [models, setModels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState(settings.model);
  const [level, setLevel] = useState(settings.thinkingLevel || DEFAULT);
  const [saving, setSaving] = useState(false);

  async function load(fresh = false) {
    setLoading(true);
    try {
      setModels((await getAiModels(fresh)).data.models);
    } catch (error) {
      setModels([]);
      notify({ title: 'Could not load your Gemini models', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const list = models || [];
  const current = list.find((item) => item.id === model) || null;
  const recommended = list.filter((item) => item.recommended);
  const others = list.filter((item) => !item.recommended);
  const changed = model !== settings.model || (level === DEFAULT ? null : level) !== (settings.thinkingLevel || null);
  const missing = models && !current;

  function pickModel(next) {
    setModel(next);
    const found = list.find((item) => item.id === next);
    if (level !== DEFAULT && !found?.levels.includes(level)) setLevel(DEFAULT);
  }

  async function save() {
    setSaving(true);
    try {
      const { key } = (await saveAiSettings({ model, thinkingLevel: level === DEFAULT ? null : level })).data;
      onSaved(key);
      notify({ title: 'Gemini settings saved' });
    } catch (error) {
      const issue = error?.response?.data?.data?.issues?.[0]?.message;
      notify({ title: 'Could not save the settings', description: issue || getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="gemini-model">Model</Label>
            <button type="button" onClick={() => load(true)} disabled={loading} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50" aria-label="Refresh the model list">
              <RefreshCw className={loading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
              Refresh
            </button>
          </div>
          {loading && !models ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={model} onValueChange={pickModel} disabled={saving || !list.length}>
              <SelectTrigger id="gemini-model">
                <SelectValue placeholder="No models found" />
              </SelectTrigger>
              <SelectContent>
                {missing ? (
                  <SelectItem value={model} disabled>
                    {model} (not on this key)
                  </SelectItem>
                ) : null}
                {recommended.length ? (
                  <SelectGroup>
                    <SelectLabel>Recommended</SelectLabel>
                    {recommended.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {recommended.length && others.length ? <SelectSeparator /> : null}
                {others.length ? (
                  <SelectGroup>
                    <SelectLabel>More on your key</SelectLabel>
                    {others.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gemini-thinking">Thinking</Label>
          <Select value={level} onValueChange={setLevel} disabled={saving || !current?.levels.length}>
            <SelectTrigger id="gemini-thinking">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>{current?.defaultLevel ? `Model default (${levelLabels[current.defaultLevel]})` : 'Model default'}</SelectItem>
              {(current?.levels || []).map((item) => (
                <SelectItem key={item} value={item}>
                  {levelLabels[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{current && !current.recommended ? 'Not tested with AppEnglish yet; results may vary.' : 'More thinking scores more carefully but takes longer.'}</p>
        <Button size="sm" variant="outline" loading={saving} disabled={!changed || missing} onClick={save}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
