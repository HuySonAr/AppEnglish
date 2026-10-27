import { Children } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils.js';
import { PasswordInput } from '../../../components/shared/PasswordInput.jsx';
import { focusOnEnter } from '../flow/auth-flow.js';

export const authInput = 'h-12 rounded-full border-transparent bg-muted/60 px-5 text-[15px] shadow-none transition-colors hover:bg-muted focus-visible:border-primary/40 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0';
export const authButton = 'h-12 w-full rounded-full text-[15px] font-semibold shadow-sm transition-transform active:scale-[0.99]';

export function AuthCard({ title, description, children, footer, className }) {
  return (
    <div className={cn('w-full max-w-sm', className)}>
      <div className="auth-in space-y-2 pb-6 text-center short:space-y-1 short:pb-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem] short:text-[1.75rem]">{title}</h1>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      </div>
      <div className="auth-in" style={{ animationDelay: '0.08s' }}>
        {children}
      </div>
      {footer ? (
        <div className="auth-in mt-6 short:mt-4 text-center text-sm text-muted-foreground" style={{ animationDelay: '0.16s' }}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function AuthFields({ children }) {
  return (
    <div className="space-y-4 short:space-y-3">
      {Children.toArray(children).map((child, index) => (
        <div key={index} className="auth-in" style={{ animationDelay: `${0.1 + index * 0.06}s` }}>
          {child}
        </div>
      ))}
    </div>
  );
}

export function AuthLink({ children, className, ...props }) {
  return (
    <Link className={cn('font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary', className)} {...props}>
      {children}
    </Link>
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return (
    <p className="px-5 text-sm text-destructive" role="alert">
      {children}
    </p>
  );
}

export function PasswordRule({ value = '', min, invalid = false }) {
  return (
    <FieldRule met={value.length >= min} invalid={invalid}>
      At least {min} characters
    </FieldRule>
  );
}

export function FieldRule({ met, invalid = false, children }) {
  const tone = met ? 'text-success' : invalid ? 'text-destructive' : 'text-muted-foreground';
  return (
    <p className={cn('flex items-center gap-2 px-5 text-xs transition-colors duration-300', tone)} role={invalid && !met ? 'alert' : undefined}>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill={met ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" className="transition-[fill] duration-300" />
        <path d="M5 8.2 7 10.2 11 6" fill="none" stroke="hsl(var(--background))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cn('transition-opacity duration-300', met ? 'opacity-100' : 'opacity-0')} />
      </svg>
      {children}
    </p>
  );
}

export function NewPasswordFields({ min, password = '', confirm = '', label = 'Password', passwordProps, confirmProps, passwordInvalid = false, confirmInvalid = false }) {
  const match = Boolean(confirm) && confirm === password;
  return (
    <div className="space-y-2.5">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="password">{label}</FieldLabel>
          <PasswordInput id="password" autoComplete="new-password" placeholder="Password" className={authInput} onKeyDown={focusOnEnter('confirmPassword')} {...passwordProps} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="confirmPassword">Confirm</FieldLabel>
          <PasswordInput id="confirmPassword" autoComplete="new-password" placeholder="Repeat it" className={authInput} {...confirmProps} />
        </div>
      </div>
      <div className="flex flex-wrap gap-y-1.5">
        <PasswordRule value={password} min={min} invalid={passwordInvalid} />
        <FieldRule met={match} invalid={confirmInvalid}>
          Passwords match
        </FieldRule>
      </div>
    </div>
  );
}

export function FieldLabel({ htmlFor, children, aside }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-5">
      <label htmlFor={htmlFor} className="text-sm text-muted-foreground">
        {children}
      </label>
      {aside}
    </div>
  );
}
