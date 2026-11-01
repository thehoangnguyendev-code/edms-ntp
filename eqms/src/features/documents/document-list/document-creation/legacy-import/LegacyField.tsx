import React from "react";
import { FIELD_HINT, FIELD_LABEL } from "./legacyImportModel";

export const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className={FIELD_LABEL}>
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {hint && <p className={FIELD_HINT}>{hint}</p>}
  </div>
);
