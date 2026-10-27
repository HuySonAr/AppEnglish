import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils.js';
import { OTP_LENGTH, cellAt, clearDigit, fillDigits, isComplete } from '../../lib/otp.js';

export function OtpInput({ id, value, onChange, onComplete, disabled = false, autoFocus = false, invalid = false, length = OTP_LENGTH, label = 'Verification code' }) {
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const focus = (index) => {
    const target = refs.current[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select();
  };

  function apply(result) {
    onChange(result.value);
    focus(result.focus);
    if (isComplete(result.value, length)) onComplete?.(result.value);
  }

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2 sm:gap-3">
      {Array.from({ length }, (_, index) => {
        const digit = cellAt(value, index);
        return (
          <input
            key={index}
            ref={(element) => (refs.current[index] = element)}
            id={index === 0 ? id : undefined}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={length}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            value={digit}
            onFocus={(event) => event.target.select()}
            onChange={(event) => apply(fillDigits(value, index, event.target.value.replace(digit, '') || event.target.value, length))}
            onPaste={(event) => {
              event.preventDefault();
              apply(fillDigits(value, index, event.clipboardData.getData('text'), length));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                event.preventDefault();
                apply(clearDigit(value, index, length));
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                focus(index - 1);
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                focus(index + 1);
              }
            }}
            className={cn(
              'h-12 w-full min-w-0 rounded-2xl border bg-muted/60 text-center text-xl font-semibold tabular-nums transition-all sm:h-14 sm:text-2xl short:h-12',
              'focus:-translate-y-0.5 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
              digit ? 'border-primary/30 bg-background' : 'border-transparent',
              invalid && 'border-destructive focus:border-destructive focus:ring-destructive/25',
            )}
          />
        );
      })}
    </div>
  );
}
