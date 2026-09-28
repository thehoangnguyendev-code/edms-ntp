import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, BellOff, Eye, Star, ThumbsUp, Library } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/components/ui/utils";
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

const WidgetShell: React.FC<{ title: string; icon: React.ReactNode; hint?: string; className?: string; index: number; children: React.ReactNode }> = ({
  title, icon, hint, className, index, children,
}) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : index * 0.06, ease: [0.2, 0.8, 0.3, 1] }}
      className={cn("min-w-0", className)}
      aria-label={title}
    >
      <Card padding="none" className="h-full p-3 md:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <CardTitle size="sm" className="flex min-w-0 items-center gap-2">
            <IconTile size="sm" color="emerald" icon={icon} />
            <span className="truncate">{title}</span>
          </CardTitle>
          {hint && <span className="shrink-0 text-2xs text-slate-500 md:text-xs">{hint}</span>}
        </div>
        {children}
      </Card>
    </motion.section>
  );
};

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="py-3 text-xs text-slate-500 md:text-sm">{text}</p>;

const rowButton = cn("group w-full rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-slate-50", FOCUS_RING);

const BarList: React.FC<{ items: KnowledgePortalDocument[]; value: (d: KnowledgePortalDocument) => number; onSelect: (d: KnowledgePortalDocument) => void }> = ({ items, value, onSelect }) => {
  const max = Math.max(1, ...items.map(value));
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.document.id}>
          <button type="button" onClick={() => onSelect(item)} className={cn(rowButton, "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2")}>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-slate-900 group-hover:text-emerald-700 md:text-sm">{item.document.documentName}</span>
              <Progress value={value(item)} max={max} size="sm" className="mt-1" />
            </span>
            <span className="text-xs font-semibold tabular-nums text-slate-700 md:text-sm">{value(item)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
};

export const ExplorerWidgets: React.FC<ExplorerWidgetsProps> = ({ overview, onSelectDocument, onGo, onToggleSubscribe }) => {
  const subscribed = overview.knowledgeBases.filter((kb) => kb.subscribed);
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-12">
      <WidgetShell index={0} title="Most viewed" icon={<Eye className="h-full w-full" />} hint="recent views" className="2xl:col-span-5">
        {overview.mostViewed.length === 0 ? <Empty text="No content to display" /> : <BarList items={overview.mostViewed} value={(d) => d.views} onSelect={onSelectDocument} />}
      </WidgetShell>

      <WidgetShell index={1} title="Most helpful" icon={<ThumbsUp className="h-full w-full" />} hint="reader votes" className="2xl:col-span-4">
        {overview.mostUseful.length === 0 ? <Empty text="No content to display" /> : <BarList items={overview.mostUseful} value={(d) => d.helpfulVotes} onSelect={onSelectDocument} />}
      </WidgetShell>

      <WidgetShell index={2} title="At a glance" icon={<Library className="h-full w-full" />} className="2xl:col-span-3">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dd className="text-xl font-bold tabular-nums text-slate-900 md:text-2xl">{overview.totalKnowledgeBases}</dd>
            <dt className="text-xs text-slate-500">{overview.totalKnowledgeBases === 1 ? "Knowledge Base" : "Knowledge Bases"}</dt>
          </div>
          <div>
            <dd className="text-xl font-bold tabular-nums text-slate-900 md:text-2xl">{overview.totalDocuments}</dd>
            <dt className="text-xs text-slate-500">{overview.totalDocuments === 1 ? "Document" : "Documents"}</dt>
          </div>
        </dl>
        {overview.selectedHierarchyName && (
          <p className="mt-3 truncate text-xs text-slate-500">Hierarchy: <span className="font-medium text-slate-700">{overview.selectedHierarchyName}</span></p>
        )}
      </WidgetShell>

      <WidgetShell index={3} title="Featured" icon={<Star className="h-full w-full" />} hint="by Document Control" className="2xl:col-span-6">
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
      </WidgetShell>

      <WidgetShell index={4} title="Subscriptions" icon={<Bell className="h-full w-full" />} hint={subscribed.length ? pluralize(subscribed.length, "item") : undefined} className="md:col-span-2 2xl:col-span-6">
        {subscribed.length === 0 ? (
          <Empty text="You are not subscribed to any Knowledge Base. Use the bell on a folder to get an email when a new document is published." />
        ) : (
          <ul className="space-y-0.5">
            {subscribed.map((kb) => (
              <li key={kb.key} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onGo({ kind: "kb", kb: { key: kb.key, label: kb.label }, path: [] })}
                  className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-slate-50", FOCUS_RING)}
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
      </WidgetShell>
    </div>
  );
};
