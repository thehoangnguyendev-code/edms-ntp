import React from "react";
import { GitBranch, Lock, PenTool } from "lucide-react";
import { IconFilter2Search } from "@tabler/icons-react";
import { cn } from "@/components/ui/utils";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import type { Permission, PermissionRiskLevel } from "../../access-profiles/types";

interface PermissionActionRowProps {
  permission: Permission;
  checked: boolean;
  onChange: (code: string, checked: boolean) => void;
  disabled?: boolean;
  /** Row is checked but not editable here (e.g. granted via an attached shared permission set). */
  locked?: boolean;
  /** Tooltip explaining why the row is locked. */
  lockedNote?: string;
}

const RISK_DOT: Record<PermissionRiskLevel, string> = {
  LOW: "bg-slate-300",
  MEDIUM: "bg-amber-400",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-red-600",
};

const RISK_LABEL: Record<PermissionRiskLevel, string> = {
  LOW: "Low risk",
  MEDIUM: "Medium risk",
  HIGH: "High risk",
  CRITICAL: "Critical risk",
};

function buildTooltip(p: Permission): string {
  const lines: string[] = [
    `Code: ${p.id}`,
    `Module: ${p.module}`,
    `Resource: ${p.resource}`,
    `Action: ${p.action}`,
    `Risk: ${RISK_LABEL[p.riskLevel]}`,
  ];
  if (p.lifecycleUsages && p.lifecycleUsages.length > 0) {
    const shown = p.lifecycleUsages.slice(0, 3).map((u) => `${u.objectTypeLabel} · ${u.fromStatusLabel ?? u.fromStatus ?? "Any state"} (${u.actionLabel})`);
    const extra = p.lifecycleUsages.length > 3 ? ` (+${p.lifecycleUsages.length - 3} more)` : "";
    lines.push(`Applies at: ${shown.join(", ")}${extra}`);
  }
  if (p.requiresAudit) lines.push("GMP Audit: Required");
  if (p.requiresESign) lines.push("E-Signature: Required");
  return lines.join("\n");
}

export const PermissionActionRow: React.FC<PermissionActionRowProps> = ({
  permission,
  checked,
  onChange,
  disabled = false,
  locked = false,
  lockedNote,
}) => {
  const dot = RISK_DOT[permission.riskLevel] ?? RISK_DOT.LOW;
  const effectiveDisabled = disabled || locked;

  return (
    <div
      title={locked && lockedNote ? `${lockedNote}\n${buildTooltip(permission)}` : buildTooltip(permission)}
      className={cn(
        "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50 sm:items-center sm:py-3",
        disabled && !checked && "opacity-70"
      )}
    >
      <Checkbox
        checked={checked}
        onChange={(c) => !effectiveDisabled && onChange(permission.id, c)}
        disabled={effectiveDisabled}
      />
      {locked && (
        <span title={lockedNote ?? "Granted by an attached permission set"} className="leading-none shrink-0">
          <Lock className="h-3 w-3 text-slate-400" />
        </span>
      )}

      {/* Risk dot — only visual indicator kept inline */}
      <span
        className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", dot)}
        aria-hidden="true"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm font-medium leading-5", checked ? "text-slate-900" : "text-slate-800")}>
          {permission.label}
        </span>
        {/* Legacy catalogs can have distinct codes sharing a display label — the code,
            on its own line, disambiguates rows that otherwise look like exact duplicates. */}
        <span className="break-all text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">
          {permission.id}
        </span>
        {permission.description && (
          <span className="text-xs leading-5 text-slate-600">{permission.description}</span>
        )}
      </div>

      {/* Compliance icons — right-aligned, subtle */}
      {(permission.requiresAudit || permission.requiresESign || (permission.lifecycleUsages?.length ?? 0) > 0) && (
        <div className="ml-auto flex shrink-0 items-center gap-1 text-slate-300 group-hover:text-slate-400">
          {(permission.lifecycleUsages?.length ?? 0) > 0 && (
            <span title="Applies only at specific lifecycle states" className="leading-none"><GitBranch className="h-3.5 w-3.5 text-slate-400" /></span>
          )}
          {permission.requiresAudit && (
            <span title="GMP Audit required" className="leading-none"><IconFilter2Search className="h-3.5 w-3.5 text-slate-400" /></span>
          )}
          {permission.requiresESign && (
            <span title="E-Signature required" className="leading-none"><PenTool className="h-3.5 w-3.5 text-slate-400 -rotate-[90deg]" /></span>
          )}
        </div>
      )}
    </div>
  );
};
