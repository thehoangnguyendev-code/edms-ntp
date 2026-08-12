import React from 'react';
import { TemplateFieldEditor } from './TemplateFieldEditor';

export interface TemplateEditorValue {
  title: string;
  summary: string;
  actionUrlTemplate: string;
}

interface TemplateEditorProps {
  value: TemplateEditorValue;
  onChange: (value: TemplateEditorValue) => void;
  availableVariables: string;
  disabled?: boolean;
}

/**
 * In-app notification content — deliberately short (title + summary) so it stays scannable in
 * the Notification Center. This feature configures in-app/webapp notifications only.
 */
export const TemplateEditor: React.FC<TemplateEditorProps> = ({ value, onChange, availableVariables, disabled }) => {
  const set = (patch: Partial<TemplateEditorValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <TemplateFieldEditor
        label="Title"
        value={value.title}
        onChange={(v) => set({ title: v })}
        availableVariables={availableVariables}
        maxLength={255}
        placeholder="Short notification title"
        disabled={disabled}
      />
      <TemplateFieldEditor
        label="Summary"
        value={value.summary}
        onChange={(v) => set({ summary: v })}
        availableVariables={availableVariables}
        multiline
        rows={3}
        maxLength={500}
        placeholder="One or two sentences"
        hint="In-app notifications are kept short by design."
        disabled={disabled}
      />
      <TemplateFieldEditor
        label="Action Link"
        value={value.actionUrlTemplate}
        onChange={(v) => set({ actionUrlTemplate: v })}
        availableVariables={availableVariables}
        placeholder="{{actionUrl}}"
        disabled={disabled}
      />
    </div>
  );
};
