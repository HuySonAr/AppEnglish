import { History, Trash2 } from 'lucide-react';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui';
import { EmptyState } from '../../../components/shared/EmptyState.jsx';
import { timeAgo } from '../../../lib/notifications.js';
import { PracticeAttempts } from './PracticeAttempts.jsx';
import { TeacherReviewPanel } from './TeacherReviewPanel.jsx';

export function ResultCard({ submission, title = 'Result', action = null, children }) {
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{submission.teacherReview ? 'AI score' : title}</p>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {timeAgo(submission.submittedAt)}
          {action}
        </span>
      </div>
      {children}
    </div>
  );
}

export function PracticeTabs({ tab, onTab, practiceLabel, practice, submissions, viewing, onOpen, renderResult, quota, onReview, maxScore = 10, history = null, historyCount, toolbar = null, onDelete = null }) {
  const list = (
    <TabsList className="shrink-0">
      <TabsTrigger value="practice">{practiceLabel}</TabsTrigger>
      <TabsTrigger value="history">
        History <span className="ml-1.5 tabular-nums text-muted-foreground">{historyCount ?? submissions.length}</span>
      </TabsTrigger>
    </TabsList>
  );
  return (
    <Tabs value={tab} onValueChange={onTab} className={toolbar ? 'space-y-4' : 'space-y-5'}>
      {toolbar ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          {toolbar}
          {list}
        </div>
      ) : (
        list
      )}

      <TabsContent value="practice" className="mt-0">
        {practice}
      </TabsContent>

      <TabsContent value="history" className="mt-0">
        <PracticeHistory submissions={submissions} viewing={viewing} onOpen={onOpen} renderResult={renderResult} quota={quota} onReview={onReview} maxScore={maxScore} history={history} onDelete={onDelete} />
      </TabsContent>
    </Tabs>
  );
}

export function PracticeHistory({ submissions, viewing, onOpen, renderResult, quota, onReview, maxScore = 10, history = null, onDelete = null }) {
  return (
    <>
      {submissions.length && history ? (
        history
      ) : submissions.length ? (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <PracticeAttempts submissions={submissions} currentId={viewing?.id} onOpen={onOpen} maxScore={maxScore} />
          <div className="space-y-4">
            {viewing ? (
              <>
                <ResultCard
                  submission={viewing}
                  action={
                    onDelete ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Delete this attempt" title="Delete this attempt" onClick={() => onDelete(viewing)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null
                  }
                >
                  {renderResult(viewing)}
                </ResultCard>
                <TeacherReviewPanel submission={viewing} quota={quota} onRequested={(answer) => onReview(viewing, answer)} />
              </>
            ) : (
              <EmptyState icon={History} title="Choose an attempt" description="Pick one on the left to see its result." />
            )}
          </div>
        </div>
      ) : (
        <EmptyState icon={History} title="No attempts yet" description="Your attempts appear here after you submit." />
      )}
    </>
  );
}
