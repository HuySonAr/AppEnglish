import { useId, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { notify } from '../../lib/notify.js';
import { cn } from '../../lib/utils.js';
import { fileIssue, formatBytes } from '../../lib/files.js';
import { Button } from '../ui/button.jsx';

export function FileDropzone({ id, accept, maxBytes, kindLabel, onFile, disabled = false, compact = false, title, className }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const input = useRef(null);
  const [over, setOver] = useState(false);

  function take(file) {
    const issue = fileIssue(file, { accept, maxBytes });
    if (issue) {
      notify({ title: 'Could not use this file', description: issue, variant: 'destructive' });
      return;
    }
    onFile(file);
  }

  function onDrop(event) {
    event.preventDefault();
    setOver(false);
    if (disabled) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) take(file);
  }

  const open = () => !disabled && input.current?.click();

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={title || 'Choose a file'}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact ? 'gap-2 px-4 py-4' : 'gap-3 px-6 py-8',
        over ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/60 hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) take(file);
        }}
      />
      <span className={cn('flex items-center justify-center rounded-lg bg-primary/10 text-primary', compact ? 'h-9 w-9' : 'h-12 w-12')}>
        <UploadCloud className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden="true" />
      </span>
      <span className="space-y-0.5">
        <span className={cn('block font-medium', compact ? 'text-sm' : '')}>{title || 'Drag and drop your file here'}</span>
        <span className="block text-xs text-muted-foreground">
          {[kindLabel, maxBytes ? `Max. file size: ${formatBytes(maxBytes)}` : null].filter(Boolean).join(' · ')}
        </span>
      </span>
      <Button
        type="button"
        variant={over ? 'default' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
      >
        Select file
      </Button>
    </div>
  );
}
