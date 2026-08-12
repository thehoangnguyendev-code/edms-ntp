import React from 'react';
import { Bell } from 'lucide-react';

interface NotificationPreviewProps {
  title?: string | null;
  summary?: string | null;
}

/** Renders a mock Notification Center card of how the content will actually look, using
 * sample-data-rendered text from the backend preview endpoint (variables already substituted). */
export const NotificationPreview: React.FC<NotificationPreviewProps> = ({ title, summary }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <Bell className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-500">Notification Center Preview</span>
      </div>
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-slate-900 line-clamp-2">{title || '—'}</p>
          <p className="text-xs text-slate-500 line-clamp-2">{summary || '—'}</p>
        </div>
      </div>
    </div>
  );
};
