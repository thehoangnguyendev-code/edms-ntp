import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BellOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { BreakdownPanel } from "@/features/self-service/dashboard/shared/BreakdownPanel";
import type { RankedCount } from "@/features/self-service/dashboard/shared/dashboardMetrics";
import { Card, CardHeader, KpiStrip, type KpiCellData } from "@/features/self-service/dashboard/shared/dashboardUi";
import type { DashboardResource } from "@/features/self-service/dashboard/shared/useDashboardResource";
import type { KnowledgePortalDocument, KnowledgePortalOverview } from "@/services/api/knowledge";
import { FileIcon } from "./ExplorerIcons";
import { FOCUS_RING } from "./explorerStyles";
import { folderColor, pluralize, type ExplorerNav } from "./explorerModel";

interface ExplorerWidgetsProps {
  overview: KnowledgePortalOverview;
  onSelectDocument: (doc: KnowledgePortalDocument) => void;
  onGo: (nav: ExplorerNav) => void;
  onToggleSubscribe: (key: string) => void;
}

const EASE = [0.2, 0.8, 0.3, 1] as const;
const noop = () => undefined;

/** Each region rises into place one after the other; the name is what assistive technology announces. */
const Region: React.FC<{ label: string; index: number; className?: string; children: React.ReactNode }> = ({ label, index, className, children }) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      aria-label={label}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : index * 0.06, ease: EASE }}
      className={cn("min-w-0", className)}
    >
      {children}
    </motion.section>
  );
};

const ListCard: React.FC<{ title: string; subtitle: string; count?: number; children: React.ReactNode }> = ({ title, subtitle, count, children }) => (
  <Card className="h-full">
    <CardHeader title={title} subtitle={subtitle} badge={count ? <Badge variant="soft">{count}</Badge> : undefined} />
    <div className="px-2 pb-3 pt-2.5">{children}</div>
  </Card>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="px-2 py-3 text-xs text-slate-500 md:text-sm">{text}</p>;

const rowButton = cn("group w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-emerald-50/50", FOCUS_RING);

/** A document per row; the bar behind its name is its figure relative to the largest in the list, and it grows when the card appears. */
const RankedRows: React.FC<{ items: KnowledgePortalDocument[]; value: (d: KnowledgePortalDocument) => number; unit: string; onSelect: (d: KnowledgePortalDocument) => void }> = ({ items, value, unit, onSelect }) => {
  const reduceMotion = useReducedMotion();
  const max = Math.max(1, ...items.map(value));
  return (
    <ul className="space-y-0.5">
      {items.map((item, index) => (
        <li key={item.document.id}>
          <button type="button" onClick={() => onSelect(item)} className={cn(rowButton, "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3")}>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-slate-900 transition-transform duration-500 ease-[cubic-bezier(0.6,0.6,0,1)] group-hover:translate-x-1 group-hover:text-emerald-700 md:text-sm">{item.document.documentName}</span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <motion.span
                  className="block h-full origin-left rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${(value(item) / max) * 100}%` }}
                  transition={{ duration: 0.8, delay: reduceMotion ? 0 : 0.2 + index * 0.08, ease: EASE }}
                />
              </span>
            </span>
            <span className="text-right text-xs font-semibold tabular-nums text-slate-700 md:text-sm">
              {value(item).toLocaleString()}
              <span className="sr-only"> {unit}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

export const ExplorerWidgets: React.FC<ExplorerWidgetsProps> = ({ overview, onSelectDocument, onGo, onToggleSubscribe }) => {
  const subscribed = overview.knowledgeBases.filter((kb) => kb.subscribed);
  const withContent = overview.knowledgeBases.filter((kb) => kb.documentCount > 0).length;

  const cells = useMemo<KpiCellData[]>(
    () => [
      { title: "Knowledge Bases", accent: "#10b981", value: overview.totalKnowledgeBases, footValue: withContent, footLabel: "with documents" },
      { title: "Documents", accent: "#3b82f6", value: overview.totalDocuments, footValue: overview.featured.length, footLabel: "featured" },
      { title: "Subscribed", accent: "#8b5cf6", value: subscribed.length, footValue: overview.totalKnowledgeBases - subscribed.length, footLabel: "not subscribed" },
    ],
    [overview, subscribed.length, withContent],
  );

  // One bar per Knowledge Base that holds documents, largest first: the same figures the folders show.
  const perKb = useMemo<DashboardResource<RankedCount[]>>(
    () => ({
      data: overview.knowledgeBases
        .filter((kb) => kb.documentCount > 0)
        .sort((a, b) => b.documentCount - a.documentCount)
        .map((kb) => ({ key: kb.key, name: kb.label, shortCode: kb.label, value: kb.documentCount })),
      loading: false,
      error: false,
      reload: noop,
    }),
    [overview.knowledgeBases],
  );

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
      <Region label="At a glance" index={0} className="md:col-span-2">
        <KpiStrip label="Knowledge Base totals" cells={cells} className="sm:grid-cols-3 xl:grid-cols-3" />
        {overview.selectedHierarchyName && (
          <p className="mt-2 truncate px-1 text-xs text-slate-500">Hierarchy: <span className="font-medium text-slate-700">{overview.selectedHierarchyName}</span></p>
        )}
      </Region>

      <Region label="Documents per Knowledge Base" index={1} className="md:col-span-2">
        <BreakdownPanel
          title="Documents per Knowledge Base"
          subtitle={(total, count) => `${pluralize(total, "document")} across ${pluralize(count, "Knowledge Base")}`}
          idleSubtitle="Documents per Knowledge Base"
          resource={perKb}
          valueLabel="Documents"
          centerCaption="Documents"
          chartLabel="documents per Knowledge Base"
          emptyLabel="No Knowledge Base holds a document yet"
          errorMessage="Documents per Knowledge Base could not be loaded."
          idPrefix="explorer-kb"
        />
      </Region>

      <Region label="Most viewed" index={2}>
        <ListCard title="Most viewed" subtitle="Documents readers opened most" count={overview.mostViewed.length}>
          {overview.mostViewed.length === 0 ? <Empty text="No content to display" /> : <RankedRows items={overview.mostViewed} value={(d) => d.views} unit="views" onSelect={onSelectDocument} />}
        </ListCard>
      </Region>

      <Region label="Most helpful" index={3}>
        <ListCard title="Most helpful" subtitle="Documents with the most helpful votes" count={overview.mostUseful.length}>
          {overview.mostUseful.length === 0 ? <Empty text="No content to display" /> : <RankedRows items={overview.mostUseful} value={(d) => d.helpfulVotes} unit="helpful votes" onSelect={onSelectDocument} />}
        </ListCard>
      </Region>

      <Region label="Featured" index={4}>
        <ListCard title="Featured" subtitle="Chosen by Document Control" count={overview.featured.length}>
          {overview.featured.length === 0 ? (
            <Empty text="No content to display" />
          ) : (
            <ul className="space-y-0.5">
              {overview.featured.map((item) => (
                <li key={item.document.id}>
                  <button type="button" onClick={() => onSelectDocument(item)} className={cn(rowButton, "flex items-center gap-2.5")}>
                    <FileIcon type={item.document.documentType} className="h-8 w-7 shrink-0 transition-transform group-hover:-rotate-3 group-hover:scale-105" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-slate-900 group-hover:text-emerald-700 md:text-sm">{item.document.documentName}</span>
                      <span className="block truncate text-2xs text-slate-500 md:text-xs">{item.document.documentNumber}{item.document.department ? ` · ${item.document.department}` : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ListCard>
      </Region>

      <Region label="Subscriptions" index={5}>
        <ListCard title="Subscriptions" subtitle="Email when a new document is published" count={subscribed.length}>
          {subscribed.length === 0 ? (
            <Empty text="You are not subscribed to any Knowledge Base. Use the bell on a folder to get an email when a new document is published." />
          ) : (
            <ul className="space-y-0.5">
              {subscribed.map((kb) => (
                <li key={kb.key} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onGo({ kind: "kb", kb: { key: kb.key, label: kb.label }, path: [] })}
                    className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50", FOCUS_RING)}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: folderColor(kb.label) }} aria-hidden="true" />
                    <span className="min-w-0 truncate text-xs font-medium text-slate-900 md:text-sm">{kb.label}</span>
                    <span className="ml-auto shrink-0 text-2xs text-slate-500 md:text-xs">{pluralize(kb.documentCount, "document")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSubscribe(kb.key)}
                    aria-label={`Unsubscribe from ${kb.label}`}
                    title="Unsubscribe"
                    className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700", FOCUS_RING)}
                  >
                    <BellOff className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ListCard>
      </Region>
    </div>
  );
};
