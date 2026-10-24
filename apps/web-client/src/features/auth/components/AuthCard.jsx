import { Children } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils.js';

export const authInput = 'h-12 rounded-full border-transparent bg-muted/60 px-5 text-[15px] shadow-none transition-colors hover:bg-muted focus-visible:border-primary/40 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0';
export const authButton = 'h-12 w-full rounded-full text-[15px] font-semibold shadow-sm transition-transform active:scale-[0.99]';

export function AuthCard({ title, description, children, footer, className }) {
  return (
    <div className={cn('w-full max-w-sm', className)}>
      <div className="auth-in space-y-2 pb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">{title}</h1>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      </div>
      <div className="auth-in" style={{ animationDelay: '0.08s' }}>
        {children}
      </div>
      {footer ? (
        <div className="auth-in mt-8 text-center text-sm text-muted-foreground" style={{ animationDelay: '0.16s' }}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function AuthFields({ children }) {
  return (
    <div className="space-y-4">
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
