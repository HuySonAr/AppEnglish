import { Skeleton } from '../ui/skeleton.jsx';
import { cn } from '../../lib/utils.js';

function Frame({ label = 'Loading', className, children }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn('space-y-6', className)}>
      {children}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

function ToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-full sm:w-40" />
      <Skeleton className="h-10 w-full sm:w-40" />
    </div>
  );
}

export function RowsSkeleton({ rows = 4, tall = false }) {
  return (
    <Frame className="space-y-0 divide-y overflow-hidden rounded-xl border bg-card">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={cn('flex items-center gap-4 px-4', tall ? 'py-6' : 'py-3')}>
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="hidden h-6 w-20 sm:block" />
        </div>
      ))}
    </Frame>
  );
}

export function ListPageSkeleton({ rows = 5, toolbar = true }) {
  return (
    <Frame>
      <HeaderSkeleton />
      {toolbar ? <ToolbarSkeleton /> : null}
      <RowsSkeleton rows={rows} />
    </Frame>
  );
}

export function CardGridPageSkeleton({ cards = 4, toolbar = true }) {
  return (
    <Frame>
      <HeaderSkeleton />
      {toolbar ? <ToolbarSkeleton /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="space-y-3 rounded-xl border bg-card p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function DetailPageSkeleton({ aside = false }) {
  const main = (
    <div className="min-w-0 space-y-6">
      <div className="space-y-3 rounded-2xl border bg-card p-6">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <RowsSkeleton rows={3} />
    </div>
  );
  return (
    <Frame>
      <Skeleton className="h-4 w-32" />
      {aside ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {main}
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      ) : (
        main
      )}
    </Frame>
  );
}

export function EditorPageSkeleton() {
  return (
    <Frame>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-11 w-full" />
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="ml-auto h-10 w-28" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-24" />
        ))}
      </div>
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border bg-card p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </Frame>
  );
}

export function FormPageSkeleton({ fields = 2 }) {
  return (
    <Frame>
      <HeaderSkeleton />
      <div className="max-w-xl space-y-4 rounded-xl border bg-card p-6">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-24" />
      </div>
    </Frame>
  );
}

export function DashboardPageSkeleton() {
  return (
    <Frame label="Loading your home page">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72 max-w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Skeleton className="h-60 w-full rounded-[2rem]" />
        <Skeleton className="h-60 w-full rounded-3xl" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-2 rounded-3xl border bg-card p-6">
          <Skeleton className="h-6 w-36" />
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
      <div className="grid gap-3 rounded-3xl border bg-card p-6 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </Frame>
  );
}
