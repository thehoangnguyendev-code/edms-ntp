import { tr } from "@/i18n";

export interface SessionPill {
  /** "" is the pill of every session. */
  id: string;
  label: string;
  /** A mark after the label: the session lacks something (warn) or is complete (ok). */
  mark?: "ok" | "warn";
}

/**
 * The bar of the sessions of an activity: "All" and one pill for each session. It is the bar the Participants tab has always had; the Training Materials and the Assessment tabs use the same one,
 * so a person who knows one knows the others.
 */
export function SessionPills({ pills, value, onChange }: { pills: SessionPill[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={tr("Session")}>
      <span className="text-xs font-medium text-slate-700 sm:text-sm">{tr("Session")}</span>
      {pills.map((pill) => (
        <button
          key={pill.id || "all"}
          type="button"
          aria-pressed={value === pill.id}
          onClick={() => onChange(pill.id)}
          className={`max-w-xs truncate rounded-full border px-3 py-1 text-xs font-medium transition-colors ${value === pill.id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"}`}
        >
          {pill.label}
          {pill.mark === "ok" && <span aria-hidden="true" className="ml-1 text-emerald-600">✓</span>}
          {pill.mark === "warn" && <span aria-hidden="true" className="ml-1 text-amber-600">!</span>}
        </button>
      ))}
    </div>
  );
}
