import React from 'react';
import { Users } from 'lucide-react';
import { FormSection } from '@/components/ui/form/FormSection';
import { RecipientRuleBuilder } from '@/components/ui/notification-content';
import type { RecipientRule } from '@/services/api/notificationPolicy';

interface RecipientsTabProps {
  value: RecipientRule[];
  onChange: (value: RecipientRule[]) => void;
  disabled: boolean;
  mandatoryLocked: boolean;
}

export const RecipientsTab: React.FC<RecipientsTabProps> = ({ value, onChange, disabled, mandatoryLocked }) => (
  <FormSection
    title="Recipients"
    icon={<Users className="h-4 w-4" />}
    description="Who receives this notification. Roles are resolved against the specific record at send time — no free-text emails."
    contentClassName="p-4 md:p-5"
  >
    <RecipientRuleBuilder value={value} onChange={onChange} disabled={disabled} />
    {mandatoryLocked && <p className="mt-2 text-2xs text-amber-600">Locked by GMP policy — required recipients cannot be changed.</p>}
  </FormSection>
);
