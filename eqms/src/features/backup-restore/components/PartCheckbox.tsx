import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

/** One part of a backup or restore with its explanation, using the shared Checkbox so every box has the same size. */
export const PartCheckbox: React.FC<{ id: string; label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ id, label, hint, checked, onChange }) => (
  <div className="flex items-start gap-2 text-sm text-slate-700">
    <Checkbox id={id} checked={checked} onChange={onChange} aria-label={label} className="min-h-0 pt-0.5" />
    <label htmlFor={id} className="cursor-pointer">
      <span className="font-medium text-slate-900">{label}</span>
      <span className="block text-xs text-slate-500">{hint}</span>
    </label>
  </div>
);
