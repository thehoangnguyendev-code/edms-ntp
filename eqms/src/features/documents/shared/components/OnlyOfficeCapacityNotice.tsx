import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { documentApi } from "@/services/api/documents";

interface OnlyOfficeCapacityNoticeProps {
  /** "edit" for editing/commenting sessions, "view" for read-only viewers. */
  kind: "edit" | "view";
  className?: string;
}

const WARN_RATIO = 0.8;

/**
 * Warns before the OnlyOffice document server runs out of simultaneous connections (the Community
 * Edition licence caps them). At the limit new sessions are refused, so the notice says so plainly
 * instead of leaving people with an editor that will not open. Renders nothing while usage is unknown
 * or comfortably below the limit.
 */
export const OnlyOfficeCapacityNotice = ({ kind, className }: OnlyOfficeCapacityNoticeProps) => {
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const capacity = await documentApi.getOnlyOfficeCapacity();
        if (cancelled) return;
        const used = kind === "edit" ? capacity.editUsed : capacity.viewUsed;
        const limit = kind === "edit" ? capacity.editLimit : capacity.viewLimit;
        setUsage(used >= 0 && limit > 0 ? { used, limit } : null);
      } catch {
        if (!cancelled) setUsage(null);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [kind]);

  if (!usage || usage.used < usage.limit * WARN_RATIO) return null;
  const full = usage.used >= usage.limit;
  const what = kind === "edit" ? "editing" : "document viewing";

  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs sm:text-sm ${
        full ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"
      } ${className ?? ""}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {full
          ? `The online ${what} service has reached its connection limit (${usage.used}/${usage.limit}). New sessions may fail to open until someone closes theirs.`
          : `The online ${what} service is nearly full (${usage.used}/${usage.limit} connections). Close documents you are no longer using to free a connection.`}
      </span>
    </div>
  );
};
