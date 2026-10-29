import { useState } from 'react';
import { Clock, GraduationCap, Send, Undo2 } from 'lucide-react';
import { REVIEW_CRITERIA, SubmissionStatus, reviewMaxScore } from '@appenglish/learning-contracts';
import { getApiErrorMessage } from '../../../lib/api/response.js';
import { notify } from '../../../lib/notify.js';
import { Badge, Button } from '../../../components/ui';
import { requestReview, withdrawReview } from '../api/review-api.js';
import { ScoreSummary } from './PracticeScore.jsx';

const SPOKEN = new Set(['read_aloud', 'open_speaking']);

export function Waiting({ status, busy, onWithdraw }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
      <Clock className="h-4 w-4 text-primary" />
      <span className="min-w-0 flex-1">{status === 'IN_REVIEW' ? 'A teacher is reviewing your answer.' : 'Waiting for a teacher.'}</span>
      {status === 'WAITING' ? (
        <Button size="sm" variant="ghost" className="gap-1.5" loading={busy} onClick={onWithdraw}>
          <Undo2 className="h-4 w-4" />
          Take back
        </Button>
      ) : null}
    </div>
  );
}

export function TeacherReviewPanel({ submission, quota, onRequested }) {
  const [sending, setSending] = useState(false);
  const review = submission.teacherReview;

  if (review) {
    const max = reviewMaxScore(submission.kind);
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="success" className="gap-1">
            <GraduationCap className="h-3.5 w-3.5" />
            Reviewed by teacher
          </Badge>
          <span className="text-xs text-muted-foreground">{new Date(review.reviewedAt).toLocaleDateString()}</span>
        </div>
        <ScoreSummary total={review.scores.total} max={max} bars={REVIEW_CRITERIA[submission.kind].map((item) => ({ label: item.label, value: review.scores[item.key], max: item.max }))} />
        {review.note ? <p className="whitespace-pre-line rounded-xl border bg-muted/30 p-4 leading-relaxed">{review.note}</p> : <p className="text-sm text-muted-foreground">The teacher agreed with the AI score.</p>}
      </div>
    );
  }

  const status = submission.review?.status;

  async function withdraw() {
    setSending(true);
    try {
      const data = (await withdrawReview(submission.id)).data;
      onRequested?.(data);
      notify({ title: 'Taken back; your turn is free again' });
    } catch (error) {
      notify({ title: 'Could not take it back', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  if (status === 'WAITING' || status === 'IN_REVIEW') return <Waiting status={status} busy={sending} onWithdraw={withdraw} />;
  if (submission.status === SubmissionStatus.SCORING || !quota) return null;
  const noRecording = SPOKEN.has(submission.kind) && !submission.recordingUrl;
  if (noRecording) return null;

  async function send() {
    setSending(true);
    try {
      const data = (await requestReview(submission.id)).data;
      onRequested?.(data);
      notify({ title: 'Sent to a teacher' });
    } catch (error) {
      notify({ title: 'Could not send it', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
      <GraduationCap className="h-4 w-4 text-primary" />
      <span className="min-w-0 flex-1">
        {status === 'EXPIRED' ? 'No teacher was free in time, so your turn is back. ' : ''}
        {quota.left} of {quota.limit} teacher reviews left this week.
      </span>
      <Button size="sm" className="gap-1.5" loading={sending} disabled={quota.left === 0} onClick={send}>
        <Send className="h-4 w-4" />
        Send to a teacher
      </Button>
    </div>
  );
}
