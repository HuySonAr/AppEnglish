import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Going back to the list an item was opened from (D130). A list link passes
// state { from: its URL with the query, focusId: the item's row }; the item
// page returns to `from` (or fallback) and hands focusId back so the list
// scrolls to that row.
export function useReturnTo(fallback) {
  const location = useLocation();
  const from = location.state?.from;
  return {
    to: from || fallback,
    state: location.state?.focusId ? { focusId: location.state.focusId } : undefined,
    // For a link to another page of the same item, so it can return too.
    passThrough: location.state || undefined,
  };
}

// The state a list link passes, for the current list page.
export function useListLinkState() {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  return (focusId) => ({ from, focusId });
}

// On a list page: once `ready`, scrolls to the row the learner came back to
// (element id `focus-<id>`) and clears the state so a reload does not scroll.
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
