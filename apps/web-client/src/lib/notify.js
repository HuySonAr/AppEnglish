import { toast } from 'sonner';

// The Sonner call each variant uses.
const methods = {
  success: 'success',
  destructive: 'error',
  info: 'info',
  warning: 'warning',
  loading: 'loading',
};

// Shows one notification (Sonner).
//   notify({ title: 'Draft saved' })
//   notify({ title: 'Could not save', description: reason, variant: 'destructive' })
// variant: 'success' (default), 'destructive', 'info', 'warning' or 'loading'.
// Returns { dismiss } to close it early, e.g. a 'loading' one when the work ends.
export function notify({ title, description, variant = 'success' }) {
  const id = toast[methods[variant] || 'success'](title, { description });
  return { dismiss: () => toast.dismiss(id) };
}
