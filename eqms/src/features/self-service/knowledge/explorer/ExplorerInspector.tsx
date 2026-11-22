import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, BellOff, ExternalLink, Share2, Star, ThumbsUp, X } from "lucide-react";
import { VisualBackdrop } from "@/components/ui/animated-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/components/ui/utils";
import { Card, CardHeader } from "@/features/self-service/dashboard/shared/dashboardUi";
import type { KnowledgePortalDocument } from "@/services/api/knowledge";
import { FileIcon, FolderIcon, useFolderColor, useFolderLabel, useTypeIcon } from "./ExplorerIcons";
import { Folder } from "@/components/ui/folder-component";
import { pluralize, typeBadgeColor, type FolderEntry } from "./explorerModel";
import { useLanguage } from "@/i18n";

export type InspectorTarget =
  | { type: "doc"; item: KnowledgePortalDocument }
  | { type: "folder"; folder: FolderEntry }
  | { type: "location"; title: string; itemCount: number };

interface ExplorerInspectorProps {
  target: InspectorTarget;
  canFeature: boolean;
  /** Present only for a Department Head: opens the sharing of a document or a folder. */
  onShareDocument?: (item: KnowledgePortalDocument) => void;
  onShareFolder?: (folder: FolderEntry) => void;
  onOpenDocument: (item: KnowledgePortalDocument) => void;
  onOpenFolder: (folder: FolderEntry) => void;
  onToggleHelpful: (item: KnowledgePortalDocument) => void;
  onToggleFeatured: (item: KnowledgePortalDocument) => void;
  onToggleSubscribe: (key: string) => void;
  /** Present when the inspector is shown as an overlay (narrow screens). */
  onClose?: () => void;
}

const Prop: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-1 gap-x-2.5 gap-y-0.5 px-4 py-2 text-xs sm:grid-cols-[6.5rem_minmax(0,1fr)] md:text-sm">
    <dt className="text-slate-500">{label}</dt>
    <dd className="min-w-0 break-words font-medium tabular-nums text-slate-900">{children || "-"}</dd>
  </div>
);

const Preview: React.FC<{ children: React.ReactNode; glow?: string }> = ({ children, glow = "#10b981" }) => (
  <Card className="relative grid place-items-center py-6">
    <VisualBackdrop color={glow} gridColor="#80808015" />
    <div className="relative z-10">{children}</div>
  </Card>
);

const TypePreview: React.FC<{ type?: string | null }> = ({ type }) => {
  const { color } = useTypeIcon(type);
  return (
    <Preview glow={color}>
      <FileIcon type={type} className="relative h-[4.75rem] w-[5.25rem] drop-shadow-lg" />
    </Preview>
  );
};

const Title: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div>
    <h3 className="break-words text-sm font-semibold leading-snug text-slate-900 md:text-base">{title}</h3>
    <p className="mt-0.5 text-xs tabular-nums text-slate-500">{subtitle}</p>
  </div>
);

export const ExplorerInspector: React.FC<ExplorerInspectorProps> = ({
  target, canFeature, onShareDocument, onShareFolder, onOpenDocument, onOpenFolder, onToggleHelpful, onToggleFeatured, onToggleSubscribe, onClose,
}) => {
  const reduceMotion = useReducedMotion();
  const colorOf = useFolderColor();
  const labelOf = useFolderLabel();
  const { t, language } = useLanguage();
  const documentCountLabel = (count: number) => language === "vi" ? `${count} tài liệu` : pluralize(count, "document");
  const key = target.type === "doc" ? `doc:${target.item.document.id}` : target.type === "folder" ? `folder:${target.folder.key}` : "location";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-white p-4 custom-scrollbar">
      {onClose && (
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("knowledge.closeDetails", "Close details")} className="mb-2 ml-auto shrink-0 text-slate-500 hover:text-slate-900">
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
                <TypePreview type={doc.documentType} />
                <Title title={doc.documentName} subtitle={`${doc.documentNumber}${doc.revisionNumber ? ` · ${doc.revisionNumber}` : ""}`} />
                <div className="flex flex-wrap gap-1.5">
                  <Badge color={typeBadgeColor(doc.documentType)} size="sm">{doc.documentType || "Document"}</Badge>
                  <Badge semantic="success" size="sm">{t("knowledge.effective", "Effective")}</Badge>
                  {item.featured && <Badge semantic="warning" size="sm">{t("knowledge.featured", "Featured")}</Badge>}
                </div>
                <Card>
                  <CardHeader title={t("knowledge.details", "Details")} className="pb-2" />
                  <dl className="mt-1 divide-y divide-slate-100 border-t border-slate-100">
                  <Prop label={t("knowledge.businessUnit", "Business unit")}>{doc.businessUnit}</Prop>
                  <Prop label={t("knowledge.department", "Department")}>{doc.department}</Prop>
                  <Prop label={t("knowledge.effective", "Effective")}>{doc.effectiveDate}</Prop>
                  <Prop label={t("knowledge.validUntil", "Valid until")}>{doc.validUntil}</Prop>
                  <Prop label={t("knowledge.views", "Views")}>{item.views}</Prop>
                  <Prop label={t("knowledge.foundHelpful", "Found helpful")}>{language === "vi" ? `${item.helpfulVotes} phiếu` : pluralize(item.helpfulVotes, "vote")}</Prop>
                  </dl>
                </Card>
                <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-3">
                  <Button size="sm" fullWidth onClick={() => onOpenDocument(item)} className="min-h-10 gap-1.5 md:min-h-0">
                   {t("knowledge.openDocument", "Open document")}
                  </Button>
                  {onShareDocument && (
                    <Button size="sm" fullWidth variant="outline" onClick={() => onShareDocument(item)} className="min-h-10 gap-1.5 md:min-h-0">
                      <Share2 className="h-4 w-4" /> {t("knowledge.share", "Share...")}
                    </Button>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant={item.myFeedback ? "outline-emerald" : "outline"} aria-pressed={!!item.myFeedback} onClick={() => onToggleHelpful(item)} className="min-h-10 flex-1 gap-1.5 md:min-h-0">
                      <ThumbsUp className="h-4 w-4" /> {item.myFeedback ? t("knowledge.helpful", "Helpful") : t("knowledge.markHelpful", "Mark helpful")}
                    </Button>
                    {canFeature && (
                      <Button size="sm" variant={item.featured ? "outline-emerald" : "outline"} aria-pressed={item.featured} onClick={() => onToggleFeatured(item)} className="min-h-10 flex-1 gap-1.5 md:min-h-0">
                        <Star className={cn("h-4 w-4", item.featured && "fill-amber-400 text-amber-500")} /> {item.featured ? t("knowledge.unfeature", "Unfeature") : t("knowledge.feature", "Feature")}
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
                <Folder color={colorOf(target.folder.key, target.folder.label) as `#${string}`} scale={0.36} className="h-24 w-32" />
              </Preview>
              <Title title={labelOf(target.folder.key, target.folder.label)} subtitle={`${target.folder.isKnowledgeBase ? t("knowledge.knowledgeBase", "Knowledge Base") : t("knowledge.folder", "Folder")} · ${documentCountLabel(target.folder.documentCount)}`} />
              <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-3">
                <Button size="sm" fullWidth onClick={() => onOpenFolder(target.folder)} className="min-h-10 md:min-h-0">{t("knowledge.openFolder", "Open folder")}</Button>
                {onShareFolder && (
                  <Button size="sm" fullWidth variant="outline" onClick={() => onShareFolder(target.folder)} className="min-h-10 gap-1.5 md:min-h-0">
                    <Share2 className="h-4 w-4" /> {t("knowledge.share", "Share...")}
                  </Button>
                )}
                {target.folder.isKnowledgeBase && (
                  <Button size="sm" fullWidth variant={target.folder.subscribed ? "outline-emerald" : "outline"} aria-pressed={!!target.folder.subscribed} onClick={() => onToggleSubscribe(target.folder.key)} className="min-h-10 gap-1.5 md:min-h-0">
                    {target.folder.subscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    {target.folder.subscribed ? t("knowledge.unsubscribe", "Unsubscribe") : t("knowledge.subscribe", "Subscribe to new documents")}
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
              <Title title={target.title} subtitle={`${language === "vi" ? `${target.itemCount} mục` : pluralize(target.itemCount, "item")} ${t("knowledge.locationItems", "in this location")}`} />
              <p className="mt-auto rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs leading-6 text-slate-600">
                {t("knowledge.selectDocumentHint", "Select a document to see its details here. Use the arrow keys to move, Enter to open.")}
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
