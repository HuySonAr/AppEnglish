import { FileAudio, FileImage, FileJson, FileText, FileVideo, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { fileKind, formatBytes } from '../../lib/files.js';
import { Button } from '../ui/button.jsx';

const icons = { audio: FileAudio, video: FileVideo, image: FileImage, json: FileJson, text: FileText };

export function FileRow({ name, type, sizeBytes, status = 'done', note, error, onRemove, onRetry, children, className }) {
  const Icon = icons[fileKind(name, type)] || FileText;
  const failed = status === 'failed';
  const detail = failed
    ? error || 'Upload failed'
    : [sizeBytes ? formatBytes(sizeBytes) : null, note || (status === 'done' ? 'Upload successful' : status === 'uploading' ? 'Uploading…' : 'Uploads when you save')]
        .filter(Boolean)
        .join(' · ');
  return (
    <div className={cn('rounded-xl border bg-card p-3 text-sm shadow-sm', failed && 'border-destructive/40', className)}>
      <div className="flex items-center gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', failed ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className={cn('truncate text-xs', failed ? 'text-destructive' : 'text-muted-foreground')}>{detail}</p>
        </div>
        {failed && onRetry ? (
          <Button type="button" variant="ghost" size="icon" aria-label="Try again" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        ) : null}
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${name}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {failed ? null : (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={cn('h-full rounded-full transition-all', status === 'done' ? 'w-full bg-success' : status === 'uploading' ? 'w-2/3 animate-pulse bg-primary' : 'w-1/4 bg-primary/40')}
          />
        </div>
      )}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
