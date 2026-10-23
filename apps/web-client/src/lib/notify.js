import { toast } from 'sonner';

const methods = {
  success: 'success',
  destructive: 'error',
  info: 'info',
  warning: 'warning',
  loading: 'loading',
};

export function notify({ title, description, variant = 'success' }) {
  const id = toast[methods[variant] || 'success'](title, { description });
  return { dismiss: () => toast.dismiss(id) };
}
