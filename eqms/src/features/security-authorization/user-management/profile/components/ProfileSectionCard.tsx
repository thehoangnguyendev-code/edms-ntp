import React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { cn } from "@/components/ui/utils";
import type { User } from "../../types";
import { IconPencilMinus } from "@tabler/icons-react";
import { FormSection } from "@/components/ui/form/FormSection";
import { Badge } from "@/components/ui/badge/Badge";
import { tr } from "@/i18n";

// ── Shared types ───────────────────────────────────────────────────────────────
export type SectionKey = "personal" | "work" | "account" | "education" | "expertise";

export type FieldDef =
  | { type: "text" | "email" | "tel"; fieldKey: keyof User }
  | { type: "date"; fieldKey: keyof User }
  | { type: "select"; fieldKey: keyof User; options: { label: string; value: string }[]; disabled?: boolean };

// ── Info Field — clean label / bold value, no box ─────────────────────────────
export const InfoField: React.FC<{
  label: string;
  value?: string | null;
  className?: string;
}> = ({ label, value, className }) => (
  <div className={cn("flex flex-col gap-1 min-w-0", className)}>
    <span className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">{label}</span>
    <span className={cn("text-sm font-semibold text-slate-900 break-words", !value && "text-slate-400 italic font-normal")}>
      {value || "—"}
    </span>
  </div>
);

// ── Field Group — an eyebrow title over a two-column grid of fields ───────────
/** Groups the fields of a tab ("Identity", "Contact"...). `divided` draws the thin rule that
 *  separates it from the group above, so a tab with several groups reads as one card. */
export const FieldGroup: React.FC<{
  title: string;
  children: React.ReactNode;
  divided?: boolean;
}> = ({ title, children, divided }) => (
  <div className={cn(divided && "mt-5 pt-5 border-t border-slate-100")}>
    <h3 className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">{children}</div>
  </div>
);

// ── Section Card with optional pencil-edit button ─────────────────────────────
export const SectionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onReset?: () => void;
  isResetDisabled?: boolean;
  isEditing?: boolean;
  className?: string;
}> = ({ title, icon, children, onEdit, onSave, onCancel, onReset, isResetDisabled, isEditing, className }) => (
  <FormSection
    title={title}
    icon={icon}
    className={cn(
      isEditing ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200",
      className
    )}
    headerRight={
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        {isEditing && (
          <Badge color="emerald" size="sm">{tr("Editing")}</Badge>
        )}
        {isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="xs" onClick={onReset} disabled={isResetDisabled}>{tr("Reset")}</Button>
            <Button variant="outline" size="xs" onClick={onCancel}>{tr("Cancel")}</Button>
            <Button variant="default" size="xs" onClick={onSave}>{tr("Save")}</Button>
          </div>
        ) : onEdit && (
          <Button
            variant="outline"
            size="xs"
            onClick={onEdit}
            aria-label={`Edit ${title}`}
            className="gap-1.5 h-7 px-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
          >
            <IconPencilMinus className="h-3.5 w-3.5" />
            <span>{tr("Edit")}</span>
          </Button>
        )}
      </div>
    }
  >
    {children}
  </FormSection>
);

// ── Editable Field ─────────────────────────────────────────────────────────────
export const EditableField: React.FC<{
  label: string;
  value?: string | null;
  draftValue?: string | null;
  isEditing: boolean;
  field: FieldDef;
  onChange: (key: keyof User, value: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}> = ({ label, value, draftValue, isEditing, field, onChange, placeholder, className, error }) => {
  if (!isEditing) return <InfoField label={label.replace(/\s*\*\s*$/, "")} value={value} className={className} />;
  if (field.type === "select") {
    return (
      <div className={cn("min-w-0", className)}>
        <Select
          label={label}
          value={draftValue || ""}
          onChange={(v) => onChange(field.fieldKey, v)}
          options={field.options}
          disabled={field.disabled}
        />
        {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      </div>
    );
  }
  if (field.type === "date") {
    return (
      <div className={cn("min-w-0", className)}>
        <DateTimePicker
          label={label}
          value={draftValue || ""}
          onChange={(v) => onChange(field.fieldKey, v)}
        />
        {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      </div>
    );
  }
  return (
    <div className={cn("min-w-0", className)}>
      <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block capitalize">
        {/\*\s*$/.test(label) ? (
          <>
            {label.replace(/\s*\*\s*$/, "")} <span className="text-red-500">*</span>
          </>
        ) : (
          label
        )}
      </label>
      <input
        type={field.type}
        inputMode={field.type === "tel" ? "numeric" : undefined}
        pattern={field.type === "tel" ? "[0-9]*" : undefined}
        value={draftValue || ""}
        onChange={(e) => onChange(field.fieldKey, e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
      />
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
};
