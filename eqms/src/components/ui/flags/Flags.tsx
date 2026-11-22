import React from "react";
import { cn } from "../utils";

interface FlagProps {
  className?: string;
}

/**
 * Flags as inline SVG, not as the flag emoji: Windows draws the emoji of a flag as two letters, so a picture is the only way to show one on every machine.
 * Both are drawn on a 3:2 box (24 x 16) with a thin outline, so a white or pale flag does not melt into a white background.
 */
const base = "shrink-0 rounded-[3px] ring-1 ring-inset ring-black/10";

/** The flag of Viet Nam: a red field with a five-pointed yellow star. */
export const VietnamFlagIcon: React.FC<FlagProps> = ({ className }) => (
  <svg viewBox="0 0 24 16" role="img" aria-hidden="true" focusable="false" className={cn(base, "!w-6", className)}>
    <rect width="24" height="16" fill="#DA251D" />
    <polygon points="12,3.2 14.82,11.89 7.44,6.51 16.56,6.51 9.18,11.89" fill="#FFFF00" />
  </svg>
);

/** The flag of the United Kingdom (the Union Jack). */
export const UnitedKingdomFlagIcon: React.FC<FlagProps> = ({ className }) => (
  <svg viewBox="0 0 24 16" role="img" aria-hidden="true" focusable="false" className={cn(base, "!w-6", className)}>
    <rect width="24" height="16" fill="#012169" />
    <path d="M0 0L24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3.2" />
    <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.1" />
    <path d="M12 0V16M0 8H24" stroke="#FFFFFF" strokeWidth="5.3" />
    <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="3.2" />
  </svg>
);

/** The flag of an interface language (the language code as the application keeps it: "vi", "en"). */
export const LANGUAGE_FLAG_ICONS: Record<string, React.FC<FlagProps>> = {
  vi: VietnamFlagIcon,
  en: UnitedKingdomFlagIcon,
};
