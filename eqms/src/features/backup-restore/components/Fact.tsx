import React from "react";

/** One fact of a section: a muted label beside its value, the same rows as the Controlled Copy request screen. */
export const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start gap-3">
    <label className="w-36 shrink-0 text-xs font-medium text-slate-500 sm:text-sm">{label}</label>
    <div className="min-w-0 flex-1 break-words text-xs font-semibold text-slate-900 sm:text-sm">{children}</div>
  </div>
);
