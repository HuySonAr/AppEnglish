import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Cloud, CloudUpload } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/button.jsx';

// The publish action of an editor (D126): "Publish" with a cloud, then
// "Publishing…" with an arrow rising into the cloud while the request runs,
// then "Done" with a tick for a moment, then "Publish" again. run(action)
// drives it: action resolves to true on success (then Done), anything else
// goes straight back to idle (the caller already told the user what failed).
export function usePublishAction({ doneMs = 1800 } = {}) {
  const [state, setState] = useState('idle');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function run(action) {
    clearTimeout(timer.current);
    setState('loading');
    let ok = false;
    try {
      ok = (await action()) === true;
    } finally {
      setState(ok ? 'done' : 'idle');
      if (ok) timer.current = setTimeout(() => setState('idle'), doneMs);
    }
    return ok;
  }
  return { state, run };
}

export function PublishButton({ state = 'idle', disabled = false, onClick, label = 'Publish', size, className }) {
  const loading = state === 'loading';
  const done = state === 'done';
  return (
    <Button
      size={size}
      disabled={disabled || loading || done}
      aria-busy={loading || undefined}
      aria-live="polite"
      onClick={onClick}
      className={cn('min-w-[7.5rem] gap-2 transition-all', done && 'disabled:opacity-100', className)}
    >
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
        {done ? (
          <span className="publish-pop flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/25">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : loading ? (
          <>
            <Cloud className="publish-cloud absolute h-5 w-5 opacity-60" />
            <ArrowUp className="publish-arrow absolute h-3 w-3" strokeWidth={3} />
          </>
        ) : (
          <CloudUpload className="h-5 w-5" />
        )}
      </span>
      <span>{done ? 'Done' : loading ? 'Publishing…' : label}</span>
    </Button>
  );
}
