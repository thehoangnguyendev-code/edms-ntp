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
