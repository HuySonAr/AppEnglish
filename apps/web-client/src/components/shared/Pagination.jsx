import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button.jsx';

// Previous / next with "Page 2 of 5 · 43 items". Hidden when there is one page
// and nothing to count. noun names the items, e.g. "mock test".
export function Pagination({ page, pageCount, total, noun = 'item', onChange }) {
  if (!total) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {total} {noun}
        {total === 1 ? '' : 's'}
        {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ''}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" disabled={page <= 1} onClick={() => onChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" className="gap-1" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
