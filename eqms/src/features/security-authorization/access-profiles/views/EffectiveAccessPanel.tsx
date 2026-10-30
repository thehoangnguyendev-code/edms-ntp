import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { ChevronRight, Search, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { cn } from "@/components/ui/utils";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { securityApi, type EffectiveAccessResponse, type EffectiveAccessRow } from "@/services/api/security";
import { EffectiveActionRow } from "./EffectiveActionRow";
import { useDebounce } from "@/hooks";

interface EffectiveAccessPanelProps {
  accessProfileId: string;
  /** When provided, Object Access Rules are also evaluated (rule-match only, no instance). */
  documentTypeId?: string;
}

const OBJECT_TYPE_LABEL: Record<string, string> = {
  DOCUMENT: "Document Master",
  DOCUMENT_REVISION: "Document Revision",
};

type OutcomeFilter = "ALL" | "ALLOWED" | "DENIED";

const OUTCOME_FILTER_TABS = (summary: { total: number; allowed: number; denied: number }) => [
  { id: "ALL", label: "All", count: summary.total },
  { id: "ALLOWED", label: "Allowed", count: summary.allowed },
  { id: "DENIED", label: "Not allowed", count: summary.denied },
] as const;

/**
 * Read-only runtime diagnostic for an Access Profile. Results come from the same
 * backend evaluators used by authorization, not from client-side assumptions.
 */
export const EffectiveAccessPanel: React.FC<EffectiveAccessPanelProps> = ({ accessProfileId, documentTypeId }) => {
  const [data, setData] = useState<EffectiveAccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("ALL");
  const debouncedSearch = useDebounce(search, 300);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["DOCUMENT_REVISION", "DOCUMENT"]));
  const shouldReduceMotion = useReducedMotion();
  const expandTransition = useMemo(
    () => shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 },
    [shouldReduceMotion],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    securityApi.getEffectiveAccess(accessProfileId, documentTypeId, { search: debouncedSearch || undefined, outcome: outcomeFilter })
      .then((response) => { if (!cancelled) setData(response); })
      .catch(() => { if (!cancelled) setError("Failed to load effective access."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [accessProfileId, documentTypeId, debouncedSearch, outcomeFilter]);

  const summary = useMemo(() => {
    return data?.summary ?? { total: 0, allowed: 0, denied: 0 };
  }, [data]);

  const groups = useMemo(() => {
    if (!data) return [];
    const filtered = data.rows;

    const byType = new Map<string, EffectiveAccessRow[]>();
    filtered.forEach((row) => {
      const list = byType.get(row.objectType) ?? [];
      list.push(row);
      byType.set(row.objectType, list);
    });
    return Array.from(byType.entries());
  }, [data]);

  const toggleSection = (key: string) => {
    setOpenSections((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading && !data) return <SectionLoading text="Loading effective access..." />;
  if (error) return <EmptyState title="Could not load" description={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Runtime access summary</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Evaluated from this Access Profile's permissions, workflow eligibility, and active lifecycle policies.
              </p>
            </div>
          </div>
          <Badge color="blue" size="sm" className="self-start">Read-only</Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          <SummaryMetric label="Actions" value={summary.total} />
          <SummaryMetric label="Allowed" value={summary.allowed} tone="success" />
          <SummaryMetric label="Not allowed" value={summary.denied} tone="danger" />
        </div>
      </section>

      <WarningBanner variant="info" description={data.objectAccessRulesNote} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Action, status, or permission..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute bottom-1.5 right-2 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <TabNav
          tabs={OUTCOME_FILTER_TABS(summary)}
          activeTab={outcomeFilter}
          onChange={(value) => setOutcomeFilter(value as OutcomeFilter)}
          variant="pill"
          ariaLabel="Filter access results"
          className="sm:w-auto"
        />
      </div>

      {groups.length === 0 && (
        <EmptyState title="No matching actions" description="Try a different search term or result filter." />
      )}

      {groups.map(([objectType, rows]) => {
        const open = openSections.has(objectType);
        const allowedCount = rows.filter((row) => row.allowed).length;
        return (
          <section key={objectType} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => toggleSection(objectType)}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-slate-50 sm:gap-3 sm:px-4"
            >
              <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ease-out", open && "rotate-90")} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800">{OBJECT_TYPE_LABEL[objectType] ?? objectType}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{rows.length} evaluated action{rows.length === 1 ? "" : "s"}</span>
              </span>
              <Badge semantic="success" size="xs" className="shrink-0">{allowedCount} allowed</Badge>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={expandTransition}
                  className="overflow-hidden"
                >
                  <div className="max-h-[min(46dvh,420px)] divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
                    {rows.map((row) => (
                      <EffectiveActionRow key={`${row.actionCode}-${row.statusCode}`} row={row} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
};

const SummaryMetric: React.FC<{
  label: string;
  value: number;
  tone?: "success" | "danger";
}> = ({ label, value, tone }) => (
  <div className={cn(
    "rounded-lg border px-2.5 py-2 sm:px-3",
    tone === "success" && "border-emerald-100 bg-emerald-50/70",
    tone === "danger" && "border-red-100 bg-red-50/70",
    !tone && "border-slate-200 bg-white",
  )}>
    <p className="text-lg font-semibold leading-tight text-slate-800">{value}</p>
    <p className="mt-0.5 truncate text-2xs font-medium text-slate-500">{label}</p>
  </div>
);
