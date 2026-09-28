import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, BellOff, ExternalLink, Star, ThumbsUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import type { KnowledgePortalDocument } from "@/services/api/knowledge";
import { FileIcon, FolderIcon } from "./ExplorerIcons";
import { folderColor, pluralize, typeBadgeColor, typeColor, type FolderEntry } from "./explorerModel";

export type InspectorTarget =
  | { type: "doc"; item: KnowledgePortalDocument }
  | { type: "folder"; folder: FolderEntry }
  | { type: "location"; title: string; itemCount: number };

interface ExplorerInspectorProps {
  target: InspectorTarget;
  canFeature: boolean;
  onOpenDocument: (item: KnowledgePortalDocument) => void;
  onOpenFolder: (folder: FolderEntry) => void;
  onToggleHelpful: (item: KnowledgePortalDocument) => void;
  onToggleFeatured: (item: KnowledgePortalDocument) => void;
  onToggleSubscribe: (key: string) => void;
  /** Present when the inspector is shown as an overlay (narrow screens). */
  onClose?: () => void;
}

const Prop: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <>
    <dt className="text-slate-500">{label}</dt>
    <dd className="min-w-0 break-words font-medium text-slate-900">{children || "-"}</dd>
  </>
);

const Preview: React.FC<{ children: React.ReactNode; glow?: string }> = ({ children, glow }) => (
  <div className="relative grid place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white py-6">
    {glow && <span className="pointer-events-none absolute -bottom-2/3 -inset-x-1/4 h-full rounded-full opacity-15 blur-2xl" style={{ backgroundColor: glow }} aria-hidden="true" />}
    {children}
  </div>
);

const Title: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div>
    <h3 className="break-words text-sm font-semibold leading-snug text-slate-900 md:text-base">{title}</h3>
    <p className="mt-0.5 text-xs tabular-nums text-slate-500">{subtitle}</p>
  </div>
);

export const ExplorerInspector: React.FC<ExplorerInspectorProps> = ({
  target, canFeature, onOpenDocument, onOpenFolder, onToggleHelpful, onToggleFeatured, onToggleSubscribe, onClose,
}) => {
  const reduceMotion = useReducedMotion();
  const key = target.type === "doc" ? `doc:${target.item.document.id}` : target.type === "folder" ? `folder:${target.folder.key}` : "location";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-white p-4 custom-scrollbar">
      {onClose && (
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close details" className="mb-2 ml-auto shrink-0 text-slate-500 hover:text-slate-900">
          <X className="h-4 w-4" />
        </Button>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={reduceMotion ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          className="flex flex-1 flex-col gap-4"
        >
          {target.type === "doc" && (() => {
            const { item } = target;
            const doc = item.document;
            return (
              <>
                <Preview glow={typeColor(doc.documentType)}>
                  <FileIcon type={doc.documentType} className="relative h-24 w-[5.25rem] drop-shadow-lg" />
                </Preview>
                <Title title={doc.documentName} subtitle={`${doc.documentNumber}${doc.revisionNumber ? ` · ${doc.revisionNumber}` : ""}`} />
                <div className="flex flex-wrap gap-1.5">
                  <Badge color={typeBadgeColor(doc.documentType)} size="sm">{doc.documentType || "Document"}</Badge>
                  <Badge semantic="success" size="sm">Effective</Badge>
                  {item.featured && <Badge semantic="warning" size="sm">Featured</Badge>}
                </div>
                <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2.5 gap-y-2.5 text-xs md:text-sm">
                  <Prop label="Business unit">{doc.businessUnit}</Prop>
                  <Prop label="Department">{doc.department}</Prop>
                  <Prop label="Effective">{doc.effectiveDate}</Prop>
                  <Prop label="Valid until">{doc.validUntil}</Prop>
                  <Prop label="Views">{item.views}</Prop>
                  <Prop label="Found helpful">{pluralize(item.helpfulVotes, "vote")}</Prop>
                </dl>
                <div className="mt-auto flex flex-col gap-2">
                  <Button size="sm" fullWidth onClick={() => onOpenDocument(item)} className="gap-1.5">
                   Open document
                  </Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant={item.myFeedback ? "outline-emerald" : "outline"} aria-pressed={!!item.myFeedback} onClick={() => onToggleHelpful(item)} className="flex-1 gap-1.5">
                      <ThumbsUp className="h-4 w-4" /> {item.myFeedback ? "Helpful" : "Mark helpful"}
                    </Button>
                    {canFeature && (
                      <Button size="sm" variant={item.featured ? "outline-emerald" : "outline"} aria-pressed={item.featured} onClick={() => onToggleFeatured(item)} className="flex-1 gap-1.5">
                        <Star className={cn("h-4 w-4", item.featured && "fill-amber-400 text-amber-500")} /> {item.featured ? "Unfeature" : "Feature"}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          {target.type === "folder" && (
            <>
              <Preview>
                <FolderIcon color={folderColor(target.folder.label)} className="h-20 w-24 drop-shadow-lg" />
              </Preview>
              <Title title={target.folder.label} subtitle={`${target.folder.isKnowledgeBase ? "Knowledge Base" : "Folder"} · ${pluralize(target.folder.documentCount, "document")}`} />
              <div className="mt-auto flex flex-col gap-2">
                <Button size="sm" fullWidth onClick={() => onOpenFolder(target.folder)}>Open folder</Button>
                {target.folder.isKnowledgeBase && (
                  <Button size="sm" fullWidth variant={target.folder.subscribed ? "outline-emerald" : "outline"} aria-pressed={!!target.folder.subscribed} onClick={() => onToggleSubscribe(target.folder.key)} className="gap-1.5">
                    {target.folder.subscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    {target.folder.subscribed ? "Unsubscribe" : "Subscribe to new documents"}
                  </Button>
                )}
              </div>
            </>
          )}

          {target.type === "location" && (
            <>
              <Preview>
                <FolderIcon color="#10b981" className="h-20 w-24 drop-shadow-lg" />
              </Preview>
              <Title title={target.title} subtitle={`${pluralize(target.itemCount, "item")} in this location`} />
              <p className="mt-auto rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500">
                Select a document to see its details here. Use the arrow keys to move, <kbd className="rounded border border-b-2 border-slate-300 bg-white px-1 text-2xs">Enter</kbd> to open.
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
