import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { SCORING_POLL_LIMIT, SCORING_POLL_MS, isScoring } from '../lib/practice.js';

export function useSubmission(fetchSubmission, { onSettled } = {}) {
  const [submission, setSubmission] = useState(null);

  async function open(id) {
    try {
      setSubmission((await fetchSubmission(id)).data.submission);
    } catch (error) {
      notify({ title: 'Could not open that attempt', description: getApiErrorMessage(error), variant: 'destructive' });
    }
  }

  useEffect(() => {
    if (!isScoring(submission)) return undefined;
    let tries = 0;
    let cancelled = false;
    let timer;
    const poll = async () => {
      tries++;
      try {
        const next = (await fetchSubmission(submission.id)).data.submission;
        if (cancelled) return;
        if (!isScoring(next) || next.stage !== submission.stage) {
          setSubmission(next);
          if (!isScoring(next)) onSettled?.(next);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (tries < SCORING_POLL_LIMIT) timer = setTimeout(poll, SCORING_POLL_MS);
    };
    timer = setTimeout(poll, SCORING_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [submission?.id, submission?.status, submission?.stage]);

  return { submission, setSubmission, open };
}
