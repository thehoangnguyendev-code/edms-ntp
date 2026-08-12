import React from 'react';
import { MultiSelect } from '@/components/ui/select/MultiSelect';
import { settingsApi } from '@/services/api/settings';

export interface RecipientRule {
  type: string;
  value?: string;
}

const CONTEXTUAL_OPTIONS: { label: string; value: string }[] = [
  { label: 'Document Owner', value: 'OWNER' },
  { label: 'Author', value: 'AUTHOR' },
  { label: 'Assignee', value: 'ASSIGNEE' },
  { label: 'Reviewer', value: 'REVIEWER' },
  { label: 'Approver', value: 'APPROVER' },
  { label: 'Recipient', value: 'RECIPIENT' },
  { label: 'Affected Users', value: 'AFFECTED_USERS' },
  { label: 'All Users', value: 'ALL_USERS' },
];

interface RecipientRuleBuilderProps {
  label?: string;
  value: RecipientRule[];
  onChange: (rules: RecipientRule[]) => void;
  disabled?: boolean;
}

/**
 * Recipient picker built on role-based rules only — deliberately no free-text email input, so a
 * policy can never be reconfigured to leak notifications to an address outside the resolved
 * business context (author/reviewer/QA Manager/etc). Recipient resolution for each role happens
 * server-side, per event, at dispatch time.
 */
export const RecipientRuleBuilder: React.FC<RecipientRuleBuilderProps> = ({ label = 'Recipients', value, onChange, disabled }) => {
  const [permissionOptions, setPermissionOptions] = React.useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    let mounted = true;
    settingsApi.getPermissionCatalog()
      .then((groups) => {
        if (!mounted) return;
        setPermissionOptions(groups.flatMap((group) => group.permissions)
          .filter((permission) => permission.active !== false)
          .map((permission) => ({ label: `Permission: ${permission.name}`, value: `PERMISSION:${permission.code}` })));
      })
      .catch(() => mounted && setPermissionOptions([]));
    return () => { mounted = false; };
  }, []);

  const selectedValues = value.map((rule) => rule.type === 'PERMISSION'
    ? `PERMISSION:${rule.value ?? ''}`
    : rule.type);
  const options = [...CONTEXTUAL_OPTIONS, ...permissionOptions];

  const toRule = (value: string): RecipientRule => {
    if (value.startsWith('PERMISSION:')) return { type: 'PERMISSION', value: value.slice('PERMISSION:'.length) };
    return { type: value };
  };

  return (
    <MultiSelect
      label={label}
      value={selectedValues}
      onChange={(values) => onChange(values.map((v) => toRule(String(v))))}
      options={options}
      placeholder="Select contextual recipients or permission audiences..."
      disabled={disabled}
      enableSearch
    />
  );
};
