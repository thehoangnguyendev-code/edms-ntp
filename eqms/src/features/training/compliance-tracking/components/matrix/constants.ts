import { Hourglass, type LucideIcon } from "lucide-react";
import {
  IconAlertTriangle,
  IconCheck,
  IconMinus,
} from "@tabler/icons-react";
import type { CellStatus } from "../../types";

// ─── Cell status display config ───────────────────────────────────────────────
export const CELL_CONFIG: Record<
  CellStatus,
  {
    bg: string;
    hoverBg: string;
    Icon: LucideIcon;
    iconColor: string;
    label: string;
    border: string;
  }
> = {
  NotRequired: { bg: "bg-slate-50",    hoverBg: "hover:bg-slate-100",   Icon: IconMinus,          iconColor: "text-slate-400",   label: "Not Required", border: "border-slate-200" },
  Required:    { bg: "bg-red-100",     hoverBg: "hover:bg-red-200",     Icon: IconAlertTriangle,  iconColor: "text-red-600",     label: "Required",     border: "border-red-300" },
  InProgress:  { bg: "bg-amber-100",   hoverBg: "hover:bg-amber-200",   Icon: Hourglass,          iconColor: "text-amber-600",   label: "In Progress",  border: "border-amber-300" },
  Qualified:   { bg: "bg-emerald-100", hoverBg: "hover:bg-emerald-200", Icon: IconCheck,          iconColor: "text-emerald-600", label: "Qualified",    border: "border-emerald-300" },
};

// ─── Shared drawer animation styles ──────────────────────────────────────────
export const DRAWER_STYLES = `
  @keyframes tmSlideInRight  { from { transform: translateX(calc(100% + 20px)); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes tmSlideInBottom { from { transform: translateY(calc(100% + 16px)); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes tmSlideOutRight  { from { transform: translateX(0); opacity: 1; } to { transform: translateX(calc(100% + 20px)); opacity: 0; } }
  @keyframes tmSlideOutBottom { from { transform: translateY(0); opacity: 1; } to { transform: translateY(calc(100% + 16px)); opacity: 0; } }
  @keyframes tmFadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tmFadeOut { from { opacity: 1; } to { opacity: 0; } }
  .tm-drawer-enter { animation-duration: 0.32s; animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); animation-fill-mode: forwards; }
  .tm-drawer-exit  { animation-duration: 0.22s; animation-timing-function: cubic-bezier(0.4, 0, 1, 1);   animation-fill-mode: forwards; }
  @media (max-width: 767px) {
    .tm-drawer-enter { animation-name: tmSlideInBottom; }
    .tm-drawer-exit  { animation-name: tmSlideOutBottom; }
  }
  @media (min-width: 768px) {
    .tm-drawer-enter { animation-name: tmSlideInRight; }
    .tm-drawer-exit  { animation-name: tmSlideOutRight; }
  }
  .tm-backdrop-enter { animation: tmFadeIn  0.25s ease-out forwards; }
  .tm-backdrop-exit  { animation: tmFadeOut 0.22s ease-in  forwards; }
`;

// ─── Utility ──────────────────────────────────────────────────────────────────
/** Parse dd/MM/yyyy (or ISO YYYY-MM-DD) string to a Date object */
const parseDMY = (d: string): Date => {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return new Date(d);
};

export const formatDate = (d: string | null): string => {
  if (!d) return "\u2014";
  const date = parseDMY(d);
  if (isNaN(date.getTime())) return "\u2014";
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
};
