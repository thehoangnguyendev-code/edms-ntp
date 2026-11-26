import { trFormat as __ariaTrFormat } from "@/i18n";
import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BellOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { Card, CardHeader } from "@/features/self-service/dashboard/shared/dashboardUi";
import type { KnowledgePortalDocument, KnowledgePortalOverview } from "@/services/api/knowledge";
import { FileIcon, useFolderColor, useFolderLabel } from "./ExplorerIcons";
import { FOCUS_RING } from "./explorerStyles";
import { pluralize, type ExplorerNav } from "./explorerModel";
import { useLanguage, tr } from "@/i18n";

interface ExplorerWidgetsProps {
  overview: KnowledgePortalOverview;
  onSelectDocument: (doc: KnowledgePortalDocument) => void;
  onGo: (nav: ExplorerNav) => void;
  onToggleSubscribe: (key: string) => void;
}

const EASE = [0.2, 0.8, 0.3, 1] as const;

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

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="px-2 py-3 text-xs text-slate-600 md:text-sm">{text}</p>;

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

interface StatCell { title: string; accent: string; value: number; note?: string }

/** Three figures in one ruled row, also on a phone (they are short). The line under a figure appears only when it says something the figure does not. */
const StatStrip: React.FC<{ label: string; cells: StatCell[] }> = ({ label, cells }) => (
  <section aria-label={label} className="grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
    {cells.map((cell) => (
      <div key={cell.title} className="min-w-0 px-3 py-3 md:px-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: cell.accent }} />
          <h3 className="text-xs font-medium leading-tight text-slate-700 sm:truncate md:text-[13px]" title={cell.title}>{cell.title}</h3>
        </div>
        <p className="mt-1.5 text-2xl font-medium leading-none tracking-tight tabular-nums text-slate-900 md:text-[28px]">{cell.value.toLocaleString()}</p>
        {cell.note && <p className="mt-1.5 truncate text-xs text-slate-600" title={cell.note}>{cell.note}</p>}
      </div>
    ))}
  </section>
);

/** One horizontal bar per Knowledge Base that holds documents, largest first; it opens the folder. The same figures as the folders show, readable at any width. */
const KnowledgeBaseBars: React.FC<{ items: { key: string; label: string; count: number }[]; total: number; onOpen: (key: string, label: string) => void }> = ({ items, total, onOpen }) => {
  const reduceMotion = useReducedMotion();
  const colorOf = useFolderColor();
  const labelOf = useFolderLabel();
  const { language } = useLanguage();
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <ul className="space-y-0.5">
      {items.map((item, index) => (
        <li key={item.key}>
          <button type="button" onClick={() => onOpen(item.key, item.label)} className={cn(rowButton, "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3")}>
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: colorOf(item.key, item.label) }} aria-hidden="true" />
                <span className="truncate text-xs font-medium text-slate-900 group-hover:text-emerald-700 md:text-sm" title={item.label}>{labelOf(item.key, item.label)}</span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <motion.span
                  className="block h-full origin-left rounded-full"
                  style={{ backgroundColor: colorOf(item.key, item.label) }}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${Math.max(2, (item.count / max) * 100)}%` }}
                  transition={{ duration: 0.8, delay: reduceMotion ? 0 : 0.2 + index * 0.08, ease: EASE }}
                />
              </span>
            </span>
            <span className="text-right text-xs tabular-nums text-slate-600 md:text-sm">
              <span className="font-semibold text-slate-800">{item.count.toLocaleString()}</span>
              <span className="sr-only"> {language === "vi" ? "tài liệu" : "documents"}</span>
              <span className="ml-1.5 text-slate-500">{total > 0 ? `${Math.round((item.count / total) * 100)}%` : ""}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

export const ExplorerWidgets: React.FC<ExplorerWidgetsProps> = ({ overview, onSelectDocument, onGo, onToggleSubscribe }) => {
  const colorOf = useFolderColor();
  const labelOf = useFolderLabel();
  const { t, language } = useLanguage();
  const documentCountLabel = (count: number) => language === "vi" ? `${count} tài liệu` : pluralize(count, "document");
  const subscribed = overview.knowledgeBases.filter((kb) => kb.subscribed);
  const withContent = overview.knowledgeBases.filter((kb) => kb.documentCount > 0).length;

  // The note under a figure says what the figure does not: it is left out when it would only repeat it.
  const cells = useMemo<StatCell[]>(
    () => {
      const notSubscribed = overview.totalKnowledgeBases - subscribed.length;
      return [
        { title: t("knowledge.knowledgeBases", "Knowledge Bases"), accent: "#10b981", value: overview.totalKnowledgeBases, note: withContent !== overview.totalKnowledgeBases ? `${withContent} ${t("knowledge.withDocuments", "with documents")}` : undefined },
        { title: t("knowledge.documents", "Documents"), accent: "#3b82f6", value: overview.totalDocuments, note: overview.featured.length > 0 ? `${overview.featured.length} ${t("knowledge.featuredFoot", "featured")}` : undefined },
        { title: t("knowledge.subscribed", "Subscribed"), accent: "#8b5cf6", value: subscribed.length, note: subscribed.length > 0 && notSubscribed > 0 ? `${notSubscribed} ${t("knowledge.notSubscribed", "not subscribed")}` : undefined },
      ];
    },
    [overview, subscribed.length, withContent, t],
  );

  // One bar per Knowledge Base that holds documents, largest first.
  const perKb = useMemo(
    () => overview.knowledgeBases
      .filter((kb) => kb.documentCount > 0)
      .sort((a, b) => b.documentCount - a.documentCount)
      .map((kb) => ({ key: kb.key, label: kb.label, count: kb.documentCount })),
    [overview.knowledgeBases],
  );
  const perKbTotal = perKb.reduce((sum, kb) => sum + kb.count, 0);

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
      <Region label={t("knowledge.atAGlance", "At a glance")} index={0} className="md:col-span-2">
        <StatStrip label={t("knowledge.knowledgeBaseTotals", "Knowledge Base totals")} cells={cells} />
        {overview.selectedHierarchyName && (
          <p className="mt-2 truncate px-1 text-xs text-slate-500">{t("knowledge.hierarchy", "Hierarchy")}: <span className="font-medium text-slate-700">{overview.selectedHierarchyName}</span></p>
        )}
      </Region>

      <Region label={t("knowledge.documentsPerKb", "Documents per Knowledge Base")} index={1} className="md:col-span-2">
        <ListCard
          title={t("knowledge.documentsPerKb", "Documents per Knowledge Base")}
          subtitle={language === "vi"
            ? `${perKbTotal} tài liệu ${t("knowledge.across", "across")} ${perKb.length} Cơ sở tri thức`
            : `${pluralize(perKbTotal, "document")} across ${pluralize(perKb.length, "Knowledge Base")}`}
        >
          {perKb.length === 0
            ? <Empty text={t("knowledge.noDocumentsYet", "No Knowledge Base holds a document yet")} />
            : <KnowledgeBaseBars items={perKb} total={perKbTotal} onOpen={(key, label) => onGo({ kind: "kb", kb: { key, label }, path: [] })} />}
        </ListCard>
      </Region>

      <Region label={t("knowledge.mostViewed", "Most viewed")} index={2}>
        <ListCard title={t("knowledge.mostViewed", "Most viewed")} subtitle={t("knowledge.mostViewedSubtitle", "Documents readers opened most")} count={overview.mostViewed.length}>
          {overview.mostViewed.length === 0 ? <Empty text={t("knowledge.noContent", "No content to display")} /> : <RankedRows items={overview.mostViewed} value={(d) => d.views} unit={t("knowledge.views", "views")} onSelect={onSelectDocument} />}
        </ListCard>
      </Region>

      <Region label={t("knowledge.mostHelpful", "Most helpful")} index={3}>
        <ListCard title={t("knowledge.mostHelpful", "Most helpful")} subtitle={t("knowledge.mostHelpfulSubtitle", "Documents with the most helpful votes")} count={overview.mostUseful.length}>
          {overview.mostUseful.length === 0 ? <Empty text={t("knowledge.noContent", "No content to display")} /> : <RankedRows items={overview.mostUseful} value={(d) => d.helpfulVotes} unit={t("knowledge.helpfulVotes", "helpful votes")} onSelect={onSelectDocument} />}
        </ListCard>
      </Region>

      <Region label={t("knowledge.featured", "Featured")} index={4}>
        <ListCard title={t("knowledge.featured", "Featured")} subtitle={t("knowledge.featuredSubtitle", "Chosen by Document Control")} count={overview.featured.length}>
          {overview.featured.length === 0 ? (
            <Empty text={t("knowledge.noContent", "No content to display")} />
          ) : (
            <ul className="space-y-0.5">
              {overview.featured.map((item) => (
                <li key={item.document.id}>
                  <button type="button" onClick={() => onSelectDocument(item)} className={cn(rowButton, "flex items-center gap-2.5")}>
                    <FileIcon type={item.document.documentType} className="h-7 w-7 shrink-0 transition-transform group-hover:-rotate-3 group-hover:scale-105" />
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

      <Region label={t("knowledge.subscriptions", "Subscriptions")} index={5}>
        <ListCard title={t("knowledge.subscriptions", "Subscriptions")} subtitle={t("knowledge.subscriptionsSubtitle", "Email when a new document is published")} count={subscribed.length}>
          {subscribed.length === 0 ? (
            <Empty text={t("knowledge.notSubscribedAny", "You are not subscribed to any Knowledge Base. Use the bell on a folder to get an email when a new document is published.")} />
          ) : (
            <ul className="space-y-0.5">
              {subscribed.map((kb) => (
                <li key={kb.key} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onGo({ kind: "kb", kb: { key: kb.key, label: kb.label }, path: [] })}
                    className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50", FOCUS_RING)}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: colorOf(kb.key, kb.label) }} aria-hidden="true" />
                    <span className="min-w-0 truncate text-xs font-medium text-slate-900 md:text-sm" title={kb.label}>{labelOf(kb.key, kb.label)}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-500">{documentCountLabel(kb.documentCount)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSubscribe(kb.key)}
                    aria-label={__ariaTrFormat("Unsubscribe from {v1}", { v1: kb.label })}
                    title={tr("Unsubscribe")}
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
