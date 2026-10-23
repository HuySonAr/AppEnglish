import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../ui/input.jsx';
import { cn } from '../../lib/utils.js';

export const PasswordInput = forwardRef(function PasswordInput({ className, disabled, value, defaultValue, onChange, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState(Boolean(defaultValue));
  const hasText = value !== undefined ? String(value).length > 0 : typed;
  const showEye = hasText && !disabled;
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={cn(showEye && 'pr-10', className)}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => {
          setTyped(event.target.value.length > 0);
          if (event.target.value.length === 0) setVisible(false);
          onChange?.(event);
        }}
        {...props}
      />
      {showEye && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
});
