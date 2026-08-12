import React from 'react';
import { FormSection } from '@/components/ui/form/FormSection';
import { TemplateEditor, type TemplateEditorValue } from '@/components/ui/notification-content';

interface ContentTabProps {
  value: TemplateEditorValue;
  onChange: (value: TemplateEditorValue) => void;
  availableVariables: string;
  disabled: boolean;
}

export const ContentTab: React.FC<ContentTabProps> = ({ value, onChange, availableVariables, disabled }) => (
  <FormSection title="Content" description="In-app content shown in the Notification Center — kept short by design." contentClassName="p-4 md:p-5">
    <TemplateEditor value={value} onChange={onChange} availableVariables={availableVariables} disabled={disabled} />
  </FormSection>
);
