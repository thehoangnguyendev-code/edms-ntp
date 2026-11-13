import React from 'react';
import { X } from 'lucide-react';
import type { RecipientRule } from '@/services/api/notificationPolicy';
import type { RecipientRuleKind } from '@/services/api/notificationAdministration';
import { RecipientPicker } from './RecipientPicker';

interface Props {
  kinds: RecipientRuleKind[];
  value: RecipientRule[];
  onChange: (rules: RecipientRule[]) => void;
  disabled?: boolean;
}

/**
 * A plain list of recipients, one chip each, with the picker to add more: for the people an escalation goes to, where the channel does not matter.
 * The recipients of a notification itself are in RecipientsMatrix, which also says on which channel each one gets it.
 */
export const RecipientRulesEditor: React.FC<Props> = ({ kinds, value, onChange, disabled }) => {
  const labelOf = (rule: RecipientRule) => {
    const label = kinds.find((k) => k.type === rule.type)?.label ?? rule.type.replace(/_/g, ' ').toLowerCase();
    return rule.value ? `${label}: ${rule.value}` : label;
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-9 flex-wrap gap-2" aria-label="Recipients">
        {value.length === 0 ? <span className="text-sm text-slate-500">Nobody yet. Add at least one recipient.</span> : null}
        {value.map((rule, index) => (
          <span key={`${rule.type}-${rule.value ?? ''}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-1 pl-3 pr-1.5 text-sm text-emerald-800">
            <span className="min-w-0 truncate">{labelOf(rule)}</span>
            {disabled ? null : (
              <button type="button" aria-label={`Remove ${labelOf(rule)}`} className="rounded-full p-0.5 text-emerald-700 hover:bg-emerald-100" onClick={() => onChange(value.filter((_, i) => i !== index))}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>
      <RecipientPicker kinds={kinds} existing={value} onAdd={(rule) => onChange([...value, rule])} disabled={disabled} />
    </div>
  );
};
