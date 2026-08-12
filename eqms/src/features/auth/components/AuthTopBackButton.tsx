import React from "react";
import { ArrowLeft } from "lucide-react";

interface AuthTopBackButtonProps {
  onClick?: () => void;
  label: string;
  disabled?: boolean;
}

/**
 * Mobile-only back button placed above the logo — a proper tap target (44px) instead of the
 * small text link at the bottom of the form, which is easy to miss and (being hover-revealed)
 * has no touch equivalent on mobile. Hidden from sm: up, where AuthBackLink at the bottom of the
 * form remains the primary back affordance.
 */
export const AuthTopBackButton: React.FC<AuthTopBackButtonProps> = ({ onClick, label, disabled }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="mb-3 -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200 disabled:pointer-events-none disabled:opacity-50 sm:hidden"
    >
      <ArrowLeft size={20} />
    </button>
  );
};
