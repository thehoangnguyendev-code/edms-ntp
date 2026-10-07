import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, BellOff, Eye, Star, ThumbsUp } from "lucide-react";
import {
  ANIMATED_CARD_TONES,
  AnimatedCard,
  AnimatedPanel,
  BarsVisual,
  CardBody,
  CardDescription,
  CardTitle,
  CardVisual,
  type AnimatedCardToneName,
} from "@/components/ui/animated-card";
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

const WidgetShell: React.FC<{ title: string; icon: React.ReactNode; tone: AnimatedCardToneName; hint?: string; className?: string; index: number; children: React.ReactNode }> = ({
  title, icon, tone, hint, className, index, children,
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
      <AnimatedPanel
        compact
        tone={tone}
        icon={icon}
        title={title}
        actions={hint ? <span className="text-2xs text-slate-500 md:text-xs">{hint}</span> : undefined}
        className="h-full"
      >
        {children}
      </AnimatedPanel>
    </motion.section>
  );
};

const GLANCE_BARS = 8;

const GlanceCard: React.FC<{ overview: KnowledgePortalOverview; index: number; className?: string }> = ({ overview, index, className }) => {
  const reduceMotion = useReducedMotion();
  const kbLabel = pluralize(overview.totalKnowledgeBases, "Knowledge Base");
  const docLabel = pluralize(overview.totalDocuments, "document");
  const bars = [...overview.knowledgeBases]
    .sort((a, b) => b.documentCount - a.documentCount)
    .slice(0, GLANCE_BARS)
    .map((kb) => ({ label: kb.label, value: kb.documentCount, accent: kb.subscribed }));
  const hasSubscribed = bars.some((bar) => bar.accent);
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : index * 0.06, ease: [0.2, 0.8, 0.3, 1] }}
      className={cn("min-w-0", className)}
      aria-label="At a glance"
    >
      <AnimatedCard tone="emerald" className="flex h-full flex-col">
        <CardVisual className="h-[140px] shrink-0">
          <BarsVisual
            mainColor={ANIMATED_CARD_TONES.emerald.main}
            secondaryColor={ANIMATED_CARD_TONES.emerald.secondary}
            bars={bars}
            chips={[{ label: kbLabel }, { label: docLabel, tone: "secondary" }]}
            info={{ title: "Documents per Knowledge Base", text: `${kbLabel} · ${docLabel}` }}
            emptyLabel="No Knowledge Bases"
          />
        </CardVisual>
        <CardBody className="flex-1">
          <CardTitle>At a glance</CardTitle>
          <CardDescription>
            <span className="font-semibold tabular-nums text-slate-900">{overview.totalKnowledgeBases}</span> {overview.totalKnowledgeBases === 1 ? "Knowledge Base" : "Knowledge Bases"}
            {" · "}
            <span className="font-semibold tabular-nums text-slate-900">{overview.totalDocuments}</span> {overview.totalDocuments === 1 ? "Document" : "Documents"}
          </CardDescription>
          {bars.length > 0 && <p className="text-xs text-slate-500">Bars show documents per Knowledge Base{hasSubscribed ? "; highlighted ones are subscribed" : ""}.</p>}
          {overview.selectedHierarchyName && (
            <p className="truncate text-xs text-slate-500">Hierarchy: <span className="font-medium text-slate-700">{overview.selectedHierarchyName}</span></p>
          )}
        </CardBody>
      </AnimatedCard>
    </motion.section>
  );
};

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="py-3 text-xs text-slate-500 md:text-sm">{text}</p>;

const rowButton = cn("group w-full rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-emerald-50/50", FOCUS_RING);

const BarList: React.FC<{ items: KnowledgePortalDocument[]; value: (d: KnowledgePortalDocument) => number; onSelect: (d: KnowledgePortalDocument) => void }> = ({ items, value, onSelect }) => {
  const max = Math.max(1, ...items.map(value));
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.document.id}>
          <button type="button" onClick={() => onSelect(item)} className={cn(rowButton, "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2")}>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-slate-900 transition-transform duration-500 ease-[cubic-bezier(0.6,0.6,0,1)] group-hover:translate-x-1 group-hover:text-emerald-700 md:text-sm">{item.document.documentName}</span>
              <Progress value={value(item)} max={max} size="sm" className="mt-1" />
            </span>
            <span className="text-xs font-semibold tabular-nums text-slate-700 transition-transform duration-500 ease-[cubic-bezier(0.6,0.6,0,1)] group-hover:scale-110 md:text-sm">{value(item)}</span>
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
      <WidgetShell index={0} tone="blue" title="Most viewed" icon={<Eye className="h-full w-full" />} hint="recent views" className="2xl:col-span-5">
        {overview.mostViewed.length === 0 ? <Empty text="No content to display" /> : <BarList items={overview.mostViewed} value={(d) => d.views} onSelect={onSelectDocument} />}
      </WidgetShell>

      <WidgetShell index={1} tone="emerald" title="Most helpful" icon={<ThumbsUp className="h-full w-full" />} hint="reader votes" className="2xl:col-span-4">
        {overview.mostUseful.length === 0 ? <Empty text="No content to display" /> : <BarList items={overview.mostUseful} value={(d) => d.helpfulVotes} onSelect={onSelectDocument} />}
      </WidgetShell>

      <GlanceCard index={2} overview={overview} className="2xl:col-span-3" />

      <WidgetShell index={3} tone="amber" title="Featured" icon={<Star className="h-full w-full" />} hint="by Document Control" className="2xl:col-span-6">
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

      <WidgetShell index={4} tone="violet" title="Subscriptions" icon={<Bell className="h-full w-full" />} hint={subscribed.length ? pluralize(subscribed.length, "item") : undefined} className="md:col-span-2 2xl:col-span-6">
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
