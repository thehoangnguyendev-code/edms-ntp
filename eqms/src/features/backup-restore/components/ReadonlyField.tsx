import React from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

/** A label above a read-only value, the same way the document detail tabs show their fixed fields. */
export const ReadonlyField: React.FC<{ label: string; value?: string | null; className?: string }> = ({ label, value, className }) => (
  <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
    <label className="text-xs sm:text-sm font-medium text-slate-700">{label}</label>
    <input type="text" value={value ?? "—"} readOnly className={CONTROL_STATE_CLASSES.readonlyField} />
  </div>
);
