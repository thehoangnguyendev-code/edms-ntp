import React from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import type { EffectiveAccessRow } from "@/services/api/security";

interface EffectiveActionRowProps {
  row: EffectiveAccessRow;
}

/** A read-only outcome row rendered by the Effective Access diagnostic. */
export const EffectiveActionRow: React.FC<EffectiveActionRowProps> = ({ row }) => {
  return (
    <div className="px-3 py-3 transition-colors hover:bg-slate-50 sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-xs font-semibold text-slate-800 sm:text-sm">{row.actionLabel}</span>
          <Badge color="blue" size="xs">{row.statusLabel}</Badge>
          {row.requiredPermissionCode && (
            <span className="inline-flex min-w-0 items-center gap-1 font-mono text-[10px] leading-none text-slate-500 sm:text-xs">
              <KeyRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="break-all">{row.requiredPermissionCode}</span>
            </span>
          )}
        </div>

        <Badge
          semantic={row.allowed ? "success" : "neutral"}
          size="xs"
          icon={row.allowed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          className="shrink-0 self-start sm:self-auto"
        >
          {row.allowed ? "Allowed" : "Not allowed"}
        </Badge>
      </div>

      {!row.allowed && row.message && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-600 sm:text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>{row.message}</span>
        </div>
      )}

      {row.allowed && !row.objectAccessRuleEvaluated && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] leading-relaxed text-amber-700 sm:text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Object Access Rules were not evaluated; a real document can still be restricted.</span>
        </div>
      )}
    </div>
  );
};
