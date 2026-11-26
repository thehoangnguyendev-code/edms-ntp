import { useMemo, useState } from "react";
import { UserCheck } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { tr, trFormat } from "@/i18n";
import { useNavTaskCounts } from "./navTaskCounts";

/**
 * The "Waiting for me" switch of a list whose menu entry carries a count: with it on, the server returns exactly what the count counts.
 * `params` goes into the query of the list and `node` above the table; the switch is drawn only while something is waiting or while it is on.
 * `showCount` is off where one menu number covers two lists, so that neither list claims the total.
 */
export function useWaitingForMe(menuId: string, onChange: () => void, showCount = true) {
  const { counts, shared } = useNavTaskCounts();
  const count = counts[menuId] ?? shared[menuId] ?? 0;
  const [on, setOn] = useState(false);
  const params = useMemo(() => ({ waitingForMe: on || undefined }), [on]);
  const node = on || count > 0 ? (
    <div className="flex">
      <button
        type="button"
        aria-pressed={on}
        onClick={() => { setOn((v) => !v); onChange(); }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
          on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400",
        )}
      >
        <UserCheck className="h-4 w-4" />
        {showCount ? trFormat("Waiting for me ({count})", { count }) : tr("Waiting for me")}
      </button>
    </div>
  ) : null;
  return { on, params, node };
}
