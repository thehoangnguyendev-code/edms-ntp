import { Drawer, type DrawerHandle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import React, { useState } from "react";
import { History, FileText, ChevronDown, ChevronUp, ExternalLink, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { StatusBadge } from "@/components/ui/badge";
import type { StatusType } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import type { TrainingMaterial, MaterialVersionEntry } from "@/features/training/materials/types";
import { IconMessage2 } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";

const READ_ONLY_CLASS = "w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none cursor-default";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d?: string): string => {
  if (!d) return "—";
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return d;
};

const statusToType = (status: MaterialVersionEntry["status"]): StatusType => {
  switch (status) {
    case "Draft": return "draft";
    case "Pending Review": return "pendingReview";
    case "Pending Approval": return "pendingApproval";
    case "Effective": return "effective";
    case "Obsoleted": return "obsolete";
    default: return "draft";
  }
};

// ─── Version Card ─────────────────────────────────────────────────────────────
interface VersionCardProps {
  entry: MaterialVersionEntry;
  isLatest: boolean;
  fileType?: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const VersionCard: React.FC<VersionCardProps> = ({ entry, isLatest, fileType, isExpanded, onToggle }) => {
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className={cn(
      "border transition-all duration-300 rounded-xl overflow-hidden bg-white",
      isExpanded ? "border-emerald-200" : "border-slate-200 hover:border-slate-300"
    )}>
      {/* Card Header (Accordion Trigger) */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full text-left px-3 sm:px-4 pt-3 pb-2.5 flex items-center justify-between transition-colors relative z-10",
          isExpanded ? "bg-emerald-50/20" : "bg-slate-50/30 hover:bg-slate-100/50"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 min-w-0 flex-1 mr-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 text-white text-2xs sm:text-xs font-medium tracking-wide">
              {entry.version}
            </span>
            <StatusBadge status={statusToType(entry.status)} size="sm" />
            {isLatest && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-2xs sm:text-xs font-medium">
                Current
              </span>
            )}
          </div>
          {!isExpanded && (
            <span className="text-2xs text-slate-400 font-medium truncate max-w-full sm:max-w-[180px]">
              Created by {entry.uploadedBy || "—"} on {formatDate(entry.uploadedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-emerald-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 16 }}
            className="overflow-hidden"
          >
            <div className="p-0 border-t border-slate-100">
              {/* Inline Preview */}
              {entry.fileUrl && (
                <div className="mx-4 mt-4 mb-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    <span className="text-2xs text-slate-700 font-medium truncate">
                      {fileType ? `${fileType} · ` : ""}
                      v{entry.version}
                    </span>
                  </div>
                  <a
                    href={entry.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-2xs text-emerald-600 font-bold hover:underline shrink-0"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Form-style Body */}
              <div className="p-4 md:p-5 space-y-5">
                {/* Creation Row */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-2xs font-medium text-slate-700">Created By</label>
                      <div className={READ_ONLY_CLASS}>{entry.uploadedBy || "—"}</div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-2xs font-medium text-slate-700">Created On (Date - Time)</label>
                      <div className={READ_ONLY_CLASS}>{formatDate(entry.uploadedAt)}</div>
                    </div>
                  </div>
                </div>

                {/* Review Row */}
                {(entry.reviewedBy || entry.reviewedAt || entry.reviewComment) && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-2xs font-medium text-slate-700">Reviewed By</label>
                        <div className={READ_ONLY_CLASS}>{entry.reviewedBy || "—"}</div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-2xs font-medium text-slate-700">Reviewed On (Date - Time)</label>
                        <div className={READ_ONLY_CLASS}>{formatDate(entry.reviewedAt)}</div>
                      </div>
                    </div>
                    {entry.reviewComment && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-2xs font-medium text-slate-700">Reviewer Comment</label>
                        <div className="w-full px-3 py-2 bg-amber-50/50 border border-amber-100 rounded-lg text-xs text-slate-600 italic leading-relaxed">
                          "{entry.reviewComment}"
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Approval Row */}
                {(entry.approvedBy || entry.approvedAt || entry.approvalComment) && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-2xs font-medium text-slate-700">Approved By</label>
                        <div className={READ_ONLY_CLASS}>{entry.approvedBy || "—"}</div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-2xs font-medium text-slate-700">Approved On (Date - Time)</label>
                        <div className={READ_ONLY_CLASS}>{formatDate(entry.approvedAt)}</div>
                      </div>
                    </div>
                    {entry.approvalComment && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-2xs font-medium text-slate-700">Approver Comment</label>
                        <div className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-100 rounded-lg text-xs text-slate-600 italic leading-relaxed">
                          "{entry.approvalComment}"
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Revision Notes (Footer section) */}
                {entry.revisionNotes && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNotes((v) => !v);
                      }}
                      className="flex items-center gap-1.5 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-600 transition-colors w-full py-1"
                    >
                      <IconMessage2 className="h-3.5 w-3.5" />
                      Revision Notes
                      {showNotes ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
                    </button>
                    <AnimatePresence>
                      {showNotes && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 90, damping: 18 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-700 leading-relaxed whitespace-pre-wrap italic">
                            {entry.revisionNotes}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Drawer ──────────────────────────────────────────────────────────────
export interface VersionHistoryDrawerProps {
  material: TrainingMaterial;
  onClose: () => void;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({ material, onClose }) => {
  const drawer = React.useRef<DrawerHandle>(null);
  const handleClose = () => drawer.current?.close();

  const history = material.versionHistory ?? [];
  const sorted = [...history].reverse();
  const [expandedVersions, setExpandedVersions] = useState<Set<string | number>>(
    new Set(sorted[0]?.version ? [sorted[0].version] : [])
  );

  const isAllExpanded = expandedVersions.size === sorted.length && sorted.length > 0;

  const toggleAll = () => {
    if (isAllExpanded) {
      setExpandedVersions(new Set());
    } else {
      setExpandedVersions(new Set(sorted.map(s => s.version)));
    }
  };

  const toggleVersion = (version: string | number) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  };


  return <Drawer
    ref={drawer}
    onClose={onClose}
    title={material.title}
    subtitle="Version History"
    icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50"><History className="h-4 w-4 text-emerald-600" /></span>}
    headerActions={<Badge color="emerald" size="sm">{material.materialNumber}</Badge>}
    footerClassName="justify-between"
    bodyClassName="space-y-4"
    footer={<>
      <p className="text-xs font-medium text-slate-400 tracking-tight">
        {sorted.length} Revision{sorted.length !== 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {sorted.length > 0 && (
          <>
            <Button
              variant="outline-emerald"
              size="xs"
              className="sm:hidden"
              onClick={toggleAll}
            >
              {isAllExpanded ? (
                <>
                  <Minimize2 className="h-3 w-3 mr-1" />
                  Collapse
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3 mr-1" />
                  Expand
                </>
              )}
            </Button>
            <Button
              variant="outline-emerald"
              size="sm"
              className="hidden sm:flex"
              onClick={toggleAll}
            >
              {isAllExpanded ? (
                <>
                  <Minimize2 className="h-3 w-3 mr-2" />
                  Collapse All
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3 mr-2" />
                  Expand All
                </>
              )}
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={handleClose} className="text-xs sm:text-sm">Close</Button>
      </div>
    </>}
  >

    {/* Version list (Timeline) */}
    {sorted.length === 0 ? (
      <div className="bg-white border border-slate-200 rounded-xl py-10 text-center px-4 flex flex-col items-center">
        <History className="h-10 w-10 text-slate-200 mb-3" />
        <p className="text-sm font-bold text-slate-700">No revisions found</p>
        <p className="text-xs text-slate-400 mt-1">This material is in its first version.</p>
      </div>
    ) : (
      <div className="relative pl-7 sm:pl-8 pr-1 pt-0 pb-4 space-y-6">
        {/* Vertical Timeline Line */}
        <div className="absolute left-3.5 sm:left-4 top-0 bottom-6 w-px bg-slate-200" />

        {sorted.map((entry, idx) => (
          <div key={entry.version} className="relative">
            {/* Timeline Marker */}
            <div className={cn(
              "absolute -left-[22px] sm:-left-6 top-[12px] sm:top-[14px] w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 sm:border-[3px] border-white z-10 transition-all duration-300",
              expandedVersions.has(entry.version)
                ? (idx === 0
                  ? "bg-emerald-700 ring-4 ring-emerald-100 animate-pulse-emerald"
                  : "bg-emerald-500 ring-4 ring-emerald-50 animate-pulse-emerald")
                : (idx === 0 ? "bg-emerald-600 ring-4 ring-emerald-50" : "bg-slate-300 ring-4 ring-slate-50")
            )} />

            <VersionCard
              entry={entry}
              isLatest={idx === 0}
              fileType={material.type}
              isExpanded={expandedVersions.has(entry.version)}
              onToggle={() => toggleVersion(entry.version)}
            />
          </div>
        ))}
      </div>
    )}

  </Drawer>;
};
