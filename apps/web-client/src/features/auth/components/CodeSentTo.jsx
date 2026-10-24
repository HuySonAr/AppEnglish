import { useState } from 'react';
import { Input } from '../../../components/ui/input.jsx';
import { FieldLabel, authInput } from './AuthCard.jsx';

export function CodeSentTo({ email, onEmail, disabled }) {
  const [editing, setEditing] = useState(!email);
  if (editing)
    return (
      <div className="space-y-1.5">
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className={authInput} value={email} onChange={(event) => onEmail(event.target.value)} required disabled={disabled} />
      </div>
    );
  return (
    <div className="flex items-center justify-between gap-3 rounded-full bg-muted/60 py-2.5 pl-5 pr-4 text-sm">
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">Code sent to</span>
        <span className="block truncate font-medium">{email}</span>
      </span>
      <button type="button" className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50" disabled={disabled} onClick={() => setEditing(true)}>
        Change
      </button>
    </div>
  );
}
