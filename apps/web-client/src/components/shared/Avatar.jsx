import { avatarInitialOf } from '@appenglish/auth-contracts';
import { cn } from '../../lib/utils.js';

const sizes = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-24 w-24 text-3xl',
};

export function Avatar({ account, size = 'sm', className }) {
  const name = account?.displayName || account?.email || '';
  if (account?.avatarUrl)
    return (
      <img
        src={account.avatarUrl}
        alt={name ? `${name}'s avatar` : 'Avatar'}
        className={cn('shrink-0 rounded-full border bg-muted object-cover', sizes[size], className)}
      />
    );
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold uppercase text-primary',
        sizes[size],
        className,
      )}
    >
      {avatarInitialOf(account || {}) || '?'}
    </span>
  );
}
