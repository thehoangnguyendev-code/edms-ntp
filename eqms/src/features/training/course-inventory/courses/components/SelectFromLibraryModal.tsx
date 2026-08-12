import React, { useState, useEffect, useCallback } from "react";
import { FileText, Film, Eye, FolderOpen, Search } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Button } from "@/components/ui/button/Button";
import { StatusBadge, type StatusType } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { cn } from "@/components/ui/utils";
import { getFileIconSrc, defaultFileIcon } from "@/utils/fileIcons";
import { getMaterialTypeColorClass } from "@/utils/status";
import type { MaterialStatus } from "@/features/training/types/material.types";

/* ─── Types ─────────────────────────────────────────────────────── */
export interface LibraryItem {
    id: string;
    /** Display label (e.g. material number) shown as secondary text */
    code?: string;
    title: string;
    fileName: string;
    type: "Video" | "PDF" | "Image" | "Document";
    fileSize: number;
    category?: string;
    status?: MaterialStatus;
}

export interface SelectFromLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called with selected items when user confirms */
    onSelect: (items: LibraryItem[]) => void;
    /** List of available items to choose from */
    items: LibraryItem[];
    /** File names already added — these will be hidden from the list */
    excludeFileNames?: string[];
    /** Modal title */
    title?: string;
    /** Maximum visible rows before scrolling (default: 6) */
    maxVisibleRows?: number;
}

/* ─── Helpers ───────────────────────────────────────────────────── */
const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getTypeIcon = (type: string) => {
    switch (type) {
        case "Video": return <Film className="h-4 w-4 text-purple-600" />;
        case "PDF": return <FileText className="h-4 w-4 text-red-600" />;
        case "Image": return <Eye className="h-4 w-4 text-blue-600" />;
        default: return <FileText className="h-4 w-4 text-slate-600" />;
    }
};

/** Height of a single row (p-2.5 = 10px*2 + content ≈ 44px) + gap 8px */
const ROW_HEIGHT = 52;

/* ─── Component ─────────────────────────────────────────────────── */
export const SelectFromLibraryModal: React.FC<SelectFromLibraryModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    items,
    excludeFileNames = [],
    title = "Select from Library",
    maxVisibleRows = 6,
}) => {
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Reset state when modal opens / closes
    useEffect(() => {
        if (isOpen) {
            setSearch("");
            setSelectedIds(new Set());
        }
    }, [isOpen]);

    // Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    const filtered = items.filter((m) => {
        if (m.status === "Obsoleted") return false;
        if (excludeFileNames.includes(m.fileName)) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            m.title.toLowerCase().includes(q) ||
            (m.code ?? "").toLowerCase().includes(q) ||
            (m.category ?? "").toLowerCase().includes(q) ||
            m.fileName.toLowerCase().includes(q)
        );
    });

    const mapMaterialStatusToStatusType = (status?: MaterialStatus): StatusType => {
        switch (status) {
            case "Draft": return "draft";
            case "Pending Review": return "pendingReview";
            case "Pending Approval": return "pendingApproval";
            case "Effective": return "effective";
            case "Obsoleted": return "obsolete";
            default: return "draft";
        }
    };

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleConfirm = () => {
        const selected = items.filter((m) => selectedIds.has(m.id));
        onSelect(selected);
        onClose();
    };

    const listMaxHeight = maxVisibleRows * ROW_HEIGHT;

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleConfirm}
            title={title}
            confirmText={`Add Selected (${selectedIds.size})`}
            confirmDisabled={selectedIds.size === 0}
            size="xl"
        >
            {/* ── Search ──────────────────────────────── */}
            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by title, ID, or category..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-9 pl-10 pr-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400 transition-colors"
                        autoFocus
                    />
                </div>
            </div>

            {/* ── Item List (max 6 rows visible, scroll for more) ── */}
            <div
                className="overflow-y-auto -mx-6 px-6"
                style={{ maxHeight: `${listMaxHeight}px` }}
            >
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                            <FolderOpen className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium text-slate-900">No materials found</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Try a different search term or all materials have already been added.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map((item) => {
                            const isSelected = selectedIds.has(item.id);
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => toggleSelect(item.id)}
                                    className={cn(
                                        "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
                                        isSelected
                                            ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200"
                                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        className="pointer-events-none"
                                    />

                                    {/* File Icon */}
                                    <div className="flex-shrink-0">
                                        <img
                                            src={getFileIconSrc(item.fileName)}
                                            alt=""
                                            className="h-7 w-7 object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = defaultFileIcon;
                                            }}
                                        />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                                            {item.title}
                                        </p>
                                        <p className="text-2xs sm:text-xs text-slate-500 truncate mt-0.5">
                                            {item.fileName} · {formatFileSize(item.fileSize)}
                                        </p>
                                    </div>

                                    {/* Status & Type Badges */}
                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        {item.status && (
                                            <StatusBadge
                                                status={mapMaterialStatusToStatusType(item.status)}
                                                size="xs"
                                            />
                                        )}
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border flex-shrink-0",
                                                getMaterialTypeColorClass(item.type)
                                            )}
                                        >
                                            {getTypeIcon(item.type)}
                                            {item.type}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </FormModal>
    );
};
