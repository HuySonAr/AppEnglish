import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const toast = useCallback((message, type = 'info') => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => remove(id), 4500);
  }, [remove]);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`flex items-start justify-between gap-3 rounded-lg border p-4 text-sm shadow-xl ${item.type === 'error' ? 'border-rose-500/40 bg-rose-950 text-rose-100' : 'border-cyan-500/40 bg-slate-900 text-slate-100'}`}>
            <span>{item.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => remove(item.id)}><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
