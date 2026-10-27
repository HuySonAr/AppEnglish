import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { SCORING_POLL_LIMIT, SCORING_POLL_MS, isScoring } from '../lib/practice.js';

export function useSubmissionGroup(fetchSubmission, { onSettled } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const replace = (next) => setItems((current) => current.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
  const add = (submission) => setItems((current) => [...current.filter((item) => item.id !== submission.id), submission]);
  const update = (id, change) => setItems((current) => current.map((item) => (item.id === id ? change(item) : item)));

  async function openMany(ids) {
    setLoading(true);
    try {
      setItems(await Promise.all(ids.map(async (id) => (await fetchSubmission(id)).data.submission)));
    } catch (error) {
      notify({ title: 'Could not open that attempt', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const watching = items
    .filter(isScoring)
    .map((item) => `${item.id}:${item.stage}`)
    .join(',');

  useEffect(() => {
    if (!watching) return undefined;
    let tries = 0;
    let cancelled = false;
    let timer;
    const poll = async () => {
      tries++;
      const pending = items.filter(isScoring);
      let settled = false;
      for (const item of pending) {
        try {
          const next = (await fetchSubmission(item.id)).data.submission;
          if (cancelled) return;
          if (!isScoring(next) || next.stage !== item.stage) {
            replace(next);
            if (!isScoring(next)) settled = true;
          }
        } catch {
          if (cancelled) return;
        }
      }
      if (settled) onSettled?.();
      if (!cancelled && tries < SCORING_POLL_LIMIT) timer = setTimeout(poll, SCORING_POLL_MS);
    };
    timer = setTimeout(poll, SCORING_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [watching]);

  return { items, setItems, add, update, openMany, loading };
}
