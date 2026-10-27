import { useState } from 'react';
import { useAuth } from '../../auth/context/AuthContext.jsx';
import { readNoTimer, writeNoTimer } from '../lib/ets-practice.js';

const storage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function useNoTimer() {
  const { account } = useAuth();
  const id = account?.id;
  const [state, setState] = useState(() => ({ id, value: readNoTimer(storage(), id) }));
  const value = state.id === id ? state.value : readNoTimer(storage(), id);
  function change(next) {
    writeNoTimer(storage(), id, next);
    setState({ id, value: next });
  }
  return [value, change];
}
