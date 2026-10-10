import { useEffect, useState } from 'react';

const storageKey = 'appenglish-theme';

function initialTheme() {
  const saved = localStorage.getItem(storageKey);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Applies the theme the user chose last, else the system preference. Called
// once before the app renders so the page does not flash.
export function applyStoredTheme() {
  document.documentElement.classList.toggle('dark', initialTheme() === 'dark');
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(storageKey, theme);
  }, [theme]);
  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  };
}
