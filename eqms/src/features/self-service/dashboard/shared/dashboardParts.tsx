import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Inline failure notice with a retry, used inside panels. */
export const PanelError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
    <p className="text-sm text-slate-500">{message}</p>
    <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
      <RefreshCw className="h-3.5 w-3.5" /> Try again
    </Button>
  </div>
);

/** Skeleton rows shown while a list panel loads. */
export const RowsSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3 p-4 md:p-5" aria-hidden>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="animate-pulse space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-slate-100" />
        <div className="h-3 w-1/3 rounded bg-slate-100" />
      </div>
    ))}
  </div>
);
