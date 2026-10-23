import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useReturnTo(fallback) {
  const location = useLocation();
  const from = location.state?.from;
  return {
    to: from || fallback,
    state: location.state?.focusId ? { focusId: location.state.focusId } : undefined,
    passThrough: location.state || undefined,
  };
}

export function useListLinkState() {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  return (focusId) => ({ from, focusId });
}

export function useFocusReturn(ready) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const id = location.state?.focusId;
    if (!ready || !id) return;
    document.getElementById(`focus-${id}`)?.scrollIntoView({ block: 'start' });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [ready]);
}
