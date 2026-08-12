import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  History,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { StatusBadge } from "@/components/ui/badge";
import type { StatusType } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import type { TrainingMaterial, MaterialVersionEntry } from "@/features/training/materials/types";
import { IconMessage2 } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";

const READ_ONLY_CLASS = "w-full h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none cursor-default";

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
};

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
  const [isClosing, setIsClosing] = useState(false);
  const isMobile = useIsMobile();
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

  // Dragging / Bottom Sheet State
  const [drawerHeight, setDrawerHeight] = useState(88); // vh
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = React.useRef(0);
  const dragStartHeight = React.useRef(88);

  const MIN_HEIGHT = 40;
  const MAX_HEIGHT = 100;
  const CLOSE_THRESHOLD = 25;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Handling both touch AND mouse events for better desktop-mobile-simulation testing
  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = drawerHeight;
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const viewportHeight = window.innerHeight;
    const deltaY = dragStartY.current - clientY;
    const deltaVh = (deltaY / viewportHeight) * 100;

    let newHeight = dragStartHeight.current + deltaVh;
    newHeight = Math.max(0, Math.min(MAX_HEIGHT, newHeight));
    setDrawerHeight(newHeight);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (drawerHeight < CLOSE_THRESHOLD) {
      handleClose();
    } else {
      setDrawerHeight(88); // Snap back to 88
    }
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const onEnd = () => handleDragEnd();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
    };
  }, [isDragging, drawerHeight]);

  const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientY);
  const handleTouchEnd = () => handleDragEnd();

  const isFullHeight = drawerHeight >= 98;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:justify-end">
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        @keyframes slideInBottom { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideOutBottom { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        .desktop-drawer-enter { animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .desktop-drawer-exit { animation: slideOutRight 0.25s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .mobile-drawer-enter { animation: slideInBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .mobile-drawer-exit { animation: slideOutBottom 0.3s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .backdrop-enter { animation: fadeIn 0.3s ease-out forwards; }
        .backdrop-exit { animation: fadeOut 0.25s ease-in forwards; }
        .custom-drawer-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(203, 213, 225, 0.4) transparent;
          scrollbar-gutter: stable;
        }
        .custom-drawer-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-drawer-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-drawer-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(203, 213, 225, 0.4);
          border-radius: 10px;
        }
        .custom-drawer-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.6);
        }
        @keyframes marker-pulse-emerald {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes marker-pulse-slate {
          0% { box-shadow: 0 0 0 0 rgba(15, 23, 42, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(15, 23, 42, 0); }
          100% { box-shadow: 0 0 0 0 rgba(15, 23, 42, 0); }
        }
        .animate-pulse-emerald {
          animation: marker-pulse-emerald 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-pulse-slate {
          animation: marker-pulse-slate 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto",
          isClosing ? "backdrop-exit" : "backdrop-enter"
        )}
        onClick={handleClose}
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          "pointer-events-auto bg-white flex flex-col relative overflow-hidden",
          isMobile
            ? cn("w-full transition-all flex flex-col", isFullHeight ? "rounded-none" : "rounded-t-2xl")
            : "w-[500px] h-[calc(100vh-32px)] mr-4 rounded-2xl border border-slate-200",
          isClosing
            ? (isMobile ? "mobile-drawer-exit" : "desktop-drawer-exit")
            : (isMobile ? (!isDragging && "mobile-drawer-enter") : "desktop-drawer-enter"),
        )}
        style={isMobile ? {
          height: `${drawerHeight}dvh`,
          transition: isDragging ? 'none' : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), height 400ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 200ms ease',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingTop: isFullHeight ? 'env(safe-area-inset-top, 0px)' : '0px',
        } : {}}
      >
        {/* Mobile Drag Handle */}
        {isMobile && (
          <div
            className="flex flex-col items-center py-3 cursor-grab active:cursor-grabbing select-none touch-none bg-white shrink-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={(e) => handleDragStart(e.clientY)}
          >
            <div className={cn(
              "rounded-full transition-all duration-200",
              isDragging ? "w-20 h-1.5 bg-slate-400" : "w-12 h-1 bg-slate-200 hover:bg-slate-300"
            )} />
          </div>
        )}

        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <History className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xs text-slate-400 font-medium">Version History</p>
              <p className="text-xs md:text-sm font-bold text-slate-900 truncate">{material.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-2">
            <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-600 text-2xs sm:text-xs font-medium border border-slate-200">
              {material.materialNumber}
            </span>
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto p-4 md:p-5 pb-4 pt-0 space-y-4 bg-slate-50/30 custom-drawer-scrollbar"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain"
          }}
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
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-5 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between">
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
        </div>
      </div>
    </div>,
    document.body
  );
};
