import React from 'react';
import { Tags, ToggleRight } from 'lucide-react';
import { FormSection } from '@/components/ui/form/FormSection';
import { Switch } from '@/components/ui/switch/Switch';
import { formatDateTime } from '@/utils/format';
import type { NotificationPolicyDetail } from '@/services/api/notificationPolicy';

interface GeneralTabProps {
  detail: NotificationPolicyDetail;
  status: 'ACTIVE' | 'DRAFT' | 'DISABLED';
  onStatusChange: (status: 'ACTIVE' | 'DISABLED') => void;
  readOnly: boolean;
}

const ReadOnlyField: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className={`mt-0.5 text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
  </div>
);

export const GeneralTab: React.FC<GeneralTabProps> = ({ detail, status, onStatusChange, readOnly }) => (
  <div className="space-y-4">
    <FormSection title="Event Metadata" icon={<Tags className="h-4 w-4" />} contentClassName="p-4 md:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Event Code" value={detail.eventCode} mono />
        <ReadOnlyField label="Module" value={detail.module} />
        <ReadOnlyField label="Priority" value={detail.priority} />
        <ReadOnlyField label="Compliance Group" value={detail.complianceGroup} />
        <ReadOnlyField label="Related Action" value={detail.relatedAction || '—'} />
        <ReadOnlyField label="Data Object" value={detail.dataObject || '—'} />
      </div>
      {detail.description && <p className="mt-4 text-sm text-slate-600">{detail.description}</p>}
    </FormSection>

    <FormSection title="Status" icon={<ToggleRight className="h-4 w-4" />} contentClassName="p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Policy Enabled</p>
          <p className="text-xs text-slate-500">
            {detail.mandatory ? 'GMP-mandatory events are always active.' : 'Turn off to stop delivering this notification entirely.'}
          </p>
        </div>
        <Switch
          checked={status !== 'DISABLED'}
          onChange={(checked) => onStatusChange(checked ? 'ACTIVE' : 'DISABLED')}
          disabled={readOnly || detail.mandatory}
        />
      </div>
      <p className="mt-3 text-2xs text-slate-400">
        Last updated {formatDateTime(detail.updatedAt) || '—'} {detail.updatedByName ? `by ${detail.updatedByName}` : ''}
      </p>
    </FormSection>
  </div>
);
