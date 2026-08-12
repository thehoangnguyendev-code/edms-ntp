import React from 'react';
import { AlarmClock, Siren } from 'lucide-react';
import { FormSection } from '@/components/ui/form/FormSection';
import { Select } from '@/components/ui/select/Select';
import { Switch } from '@/components/ui/switch/Switch';
import { RecipientRuleBuilder } from '@/components/ui/notification-content';
import type { DigestMode, RecipientRule } from '@/services/api/notificationPolicy';

const labelClass = 'mb-1.5 block text-xs sm:text-sm font-medium text-slate-700';
const inputClass =
  'h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50';

const DIGEST_OPTIONS = [
  { label: 'Immediate', value: 'IMMEDIATE' },
  { label: 'Daily Digest', value: 'DAILY_DIGEST' },
  { label: 'Weekly Digest', value: 'WEEKLY_DIGEST' },
];

interface DeliveryTabProps {
  digestMode: DigestMode;
  onDigestModeChange: (value: DigestMode) => void;
  quietHoursStart: string;
  onQuietHoursStartChange: (value: string) => void;
  quietHoursEnd: string;
  onQuietHoursEndChange: (value: string) => void;
  escalationEnabled: boolean;
  onEscalationEnabledChange: (value: boolean) => void;
  escalationAfterMinutes: number | '';
  onEscalationAfterMinutesChange: (value: number | '') => void;
  escalationRecipientRules: RecipientRule[];
  onEscalationRecipientRulesChange: (value: RecipientRule[]) => void;
  readOnly: boolean;
}

export const DeliveryTab: React.FC<DeliveryTabProps> = ({
  digestMode,
  onDigestModeChange,
  quietHoursStart,
  onQuietHoursStartChange,
  quietHoursEnd,
  onQuietHoursEndChange,
  escalationEnabled,
  onEscalationEnabledChange,
  escalationAfterMinutes,
  onEscalationAfterMinutesChange,
  escalationRecipientRules,
  onEscalationRecipientRulesChange,
  readOnly,
}) => (
  <div className="space-y-4">
    <FormSection title="Digest & Quiet Hours" icon={<AlarmClock className="h-4 w-4" />} contentClassName="p-4 md:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select label="Digest Mode" value={digestMode} onChange={(v) => onDigestModeChange(v as DigestMode)} options={DIGEST_OPTIONS} disabled={readOnly} />
        <div>
          <label className={labelClass}>Quiet Hours Start</label>
          <input
            type="time"
            value={quietHoursStart}
            onChange={(e) => onQuietHoursStartChange(e.target.value)}
            disabled={readOnly}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Quiet Hours End</label>
          <input
            type="time"
            value={quietHoursEnd}
            onChange={(e) => onQuietHoursEndChange(e.target.value)}
            disabled={readOnly}
            className={inputClass}
          />
        </div>
      </div>
    </FormSection>

    <FormSection
      title="Escalation"
      icon={<Siren className="h-4 w-4" />}
      description="If enabled, escalation recipients are notified separately when the original recipient hasn't acted in time."
      contentClassName="p-4 md:p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900">Enable Escalation</p>
        <Switch checked={escalationEnabled} onChange={onEscalationEnabledChange} disabled={readOnly} />
      </div>
      {escalationEnabled && (
        <div className="mt-4 space-y-4">
          <div className="max-w-xs">
            <label className={labelClass}>Escalate After (minutes)</label>
            <input
              type="number"
              min={1}
              value={escalationAfterMinutes}
              onChange={(e) => onEscalationAfterMinutesChange(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={readOnly}
              className={inputClass}
            />
          </div>
          <RecipientRuleBuilder
            label="Escalation Recipients"
            value={escalationRecipientRules}
            onChange={onEscalationRecipientRulesChange}
            disabled={readOnly}
          />
        </div>
      )}
    </FormSection>
  </div>
);
