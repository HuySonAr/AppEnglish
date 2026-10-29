import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageRange } from '../../lib/list.js';
import { cn } from '../../lib/utils.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.jsx';

const PAGE_SIZES = [10, 20, 50];

export function Pagination({ page, pageCount, total, noun = 'item', onChange, pageSize, onPageSizeChange, className }) {
  if (!total) return null;
  const cell = 'inline-flex h-9 min-w-9 items-center justify-center border-l px-2 text-sm transition first:border-l-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 text-sm', className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
        <p>
          {total} {noun}
          {total === 1 ? '' : 's'}
          {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ''}
        </p>
        {onPageSizeChange ? (
          <label className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger aria-label="Rows per page" className="h-8 w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}
      </div>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="inline-flex overflow-hidden rounded-md border bg-background shadow-xs">
          <button type="button" className={cn(cell, 'gap-1 px-3 font-medium hover:bg-accent')} disabled={page <= 1} onClick={() => onChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sr-only sm:hidden">Previous page</span>
          </button>
          <span className={cn(cell, 'tabular-nums sm:hidden')} aria-current="page">
            {page} / {pageCount}
          </span>
          {pageRange(page, pageCount).map((item, index) =>
            item === '…' ? (
              <span key={`gap-${index}`} className={cn(cell, 'hidden text-muted-foreground sm:inline-flex')} aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn(cell, 'hidden tabular-nums sm:inline-flex', item === page ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
                onClick={() => item !== page && onChange(item)}
              >
                {item}
              </button>
            ),
          )}
          <button type="button" className={cn(cell, 'gap-1 px-3 font-medium hover:bg-accent')} disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
            <span className="hidden sm:inline">Next</span>
            <span className="sr-only sm:hidden">Next page</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
