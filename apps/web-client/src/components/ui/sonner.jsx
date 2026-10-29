import { useEffect, useState } from 'react';
import { Toaster as Sonner } from 'sonner';

function useDocumentTheme() {
  const read = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export function Toaster(props) {
  const theme = useDocumentTheme();
  return (
    <Sonner
      theme={theme}
      position="top-right"
      richColors
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:rounded-xl group-[.toaster]:border-border group-[.toaster]:shadow-lg pr-11!',
          closeButton:
            'left-auto! right-3! top-1/2! h-6! w-6! -translate-y-1/2! translate-x-0! border-0! bg-transparent! opacity-70 hover:opacity-100 hover:bg-black/10! dark:hover:bg-white/15!',
          description: 'group-[.toast]:opacity-90',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}
