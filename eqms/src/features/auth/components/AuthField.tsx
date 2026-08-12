import React from "react";
import { AUTH_UI } from "../auth-ui";

interface AuthFieldProps {
  htmlFor: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

export const AuthField: React.FC<AuthFieldProps> = ({ htmlFor, label, required, error, children }) => {
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={AUTH_UI.fieldBlock}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-900 sm:text-sm">
        {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
