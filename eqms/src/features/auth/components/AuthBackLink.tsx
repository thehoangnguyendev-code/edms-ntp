import React from "react";
import { ArrowLeft } from "lucide-react";
import { AUTH_UI } from "../auth-ui";

interface AuthBackLinkProps {
  onClick?: () => void;
  label: string;
  disabled?: boolean;
}

export const AuthBackLink: React.FC<AuthBackLinkProps> = ({ onClick, label, disabled }) => {
  return (
    <button type="button" onClick={onClick} className={AUTH_UI.backLink} disabled={disabled}>
      <span
        className="inline-flex w-0 -translate-x-1 items-center overflow-hidden opacity-0 transition-all duration-200 group-hover:mr-2 group-hover:w-4 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:mr-2 group-focus-visible:w-4 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        <ArrowLeft size={16} />
      </span>
      <span className="text-xs leading-5 text-slate-500 sm:text-sm sm:leading-7">{label}</span>
    </button>
  );
};
