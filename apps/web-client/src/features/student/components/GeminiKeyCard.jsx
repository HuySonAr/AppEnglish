import { useEffect, useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Label,
  Skeleton,
} from '../../../components/ui';
import { deleteAiKey, getAiKey, saveAiKey } from '../api/writing-api.js';
import { GeminiModelSettings } from './GeminiModelSettings.jsx';

export function GeminiKeyCard({ showGuideLink = true }) {
  const [state, setState] = useState('loading');
  const [key, setKey] = useState(null);
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    setState('loading');
    try {
      setKey((await getAiKey()).data.key);
      setState('ready');
    } catch (error) {
      setState('error');
      notify({ title: 'Could not load your Gemini key', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy('save');
    try {
      setKey((await saveAiKey(value.trim())).data.key);
      setValue('');
      setEditing(false);
      notify({ title: 'Gemini key saved' });
    } catch (error) {
      const issue = error?.response?.data?.data?.issues?.[0]?.message;
      notify({ title: 'Could not save the key', description: issue || getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('remove');
    try {
      await deleteAiKey();
      setKey(null);
      setConfirming(false);
      notify({ title: 'Gemini key removed' });
    } catch (error) {
      notify({ title: 'Could not remove the key', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">Gemini key</h2>
          <p className="text-sm text-muted-foreground">Your own key scores your writing.</p>
        </div>
      </div>

      {state === 'loading' ? (
        <Skeleton className="h-10 w-full" />
      ) : state === 'error' ? (
        <Button variant="outline" onClick={load}>
          Try again
        </Button>
      ) : key && !editing ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-sm">
              Key ending in <span className="font-mono font-semibold">••••{key.last4}</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => setConfirming(true)}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
          <GeminiModelSettings key={`${key.model}:${key.thinkingLevel}`} settings={key} onSaved={setKey} />
        </>
      ) : (
        <form className="space-y-2" onSubmit={save}>
          <Label htmlFor="gemini-key">API key</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="gemini-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Paste your key"
              disabled={Boolean(busy)}
            />
            <div className="flex gap-2">
              <Button type="submit" loading={busy === 'save'} disabled={value.trim().length < 20}>
                Save
              </Button>
              {key ? (
                <Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      )}

      <p className="text-xs text-muted-foreground">On Google&apos;s free plan, what you send may be used to improve Google&apos;s products.</p>
      {showGuideLink ? (
        <Link to="/student/gemini-key" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          How to get a key
        </Link>
      ) : null}

      <AlertDialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove your Gemini key?</AlertDialogTitle>
            <AlertDialogDescription>New writing is saved without a score.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busy)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(busy)}
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              {busy === 'remove' ? 'Removing…' : 'Remove key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
