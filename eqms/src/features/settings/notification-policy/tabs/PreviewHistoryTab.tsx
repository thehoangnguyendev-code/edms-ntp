import React from 'react';
import { Eye, History, RotateCcw } from 'lucide-react';
import { FormSection } from '@/components/ui/form/FormSection';
import { Button } from '@/components/ui/button/Button';
import { NotificationPreview } from '@/components/ui/notification-content';
import { formatDateTime } from '@/utils/format';
import type { NotificationTemplateVersion } from '@/services/api/notificationPolicy';

interface PreviewHistoryTabProps {
  previewTitle: string | null;
  previewSummary: string | null;
  history: NotificationTemplateVersion[];
  isLoadingHistory: boolean;
  canManage: boolean;
  onRestore: (versionId: string) => void;
}

export const PreviewHistoryTab: React.FC<PreviewHistoryTabProps> = ({
  previewTitle,
  previewSummary,
  history,
  isLoadingHistory,
  canManage,
  onRestore,
}) => (
  <div className="space-y-4">
    <FormSection title="Preview" icon={<Eye className="h-4 w-4" />} contentClassName="p-4 md:p-5">
      <NotificationPreview title={previewTitle} summary={previewSummary} />
      <p className="mt-3 text-2xs text-slate-400">Rendered using sample data for this event.</p>
    </FormSection>

    <FormSection title="Version History" icon={<History className="h-4 w-4" />} contentClassName="p-0">
      {isLoadingHistory ? (
        <div className="p-6 text-center text-sm text-slate-500">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">No history yet.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {history.map((version) => (
            <div key={version.id} className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  Version {version.versionNumber}{' '}
                  {version.status === 'ACTIVE' && <span className="ml-1 text-2xs font-semibold text-emerald-600">(current)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {version.changeSummary || 'No change summary'} · {formatDateTime(version.createdAt) || ''} {version.createdByName ? `· ${version.createdByName}` : ''}
                </p>
              </div>
              {version.status !== 'ACTIVE' && canManage && (
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => onRestore(version.id)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </FormSection>
  </div>
);
