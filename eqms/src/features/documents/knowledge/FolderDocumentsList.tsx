import React, { useState, useMemo } from "react";
import {
    IconLayoutGrid,
    IconLayoutList,
    IconArrowUp,
    IconArrowDown,
    IconDotsVertical,
    IconChevronLeft
} from "@tabler/icons-react";
import { Search, Eye } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button/Button";
import { ROUTES } from "@/app/routes.constants";

// Dynamically import all file icons from the assets folder
const ALL_ICONS = import.meta.glob("../../../assets/images/image-file/*.png", { eager: true, import: "default" }) as Record<string, string>;

// Create a mapping of filename (without extension) to the imported path
const FILE_ICONS_MAP: Record<string, string> = {};
Object.entries(ALL_ICONS).forEach(([path, src]) => {
    const filename = path.split("/").pop()?.replace(".png", "") || "";
    if (filename) FILE_ICONS_MAP[filename.toLowerCase()] = src;
});

interface DocumentItem {
    id: string;
    name: string;
    documentNumber?: string;
    revisionNumber?: string;
    fileType: string;
    lastOpened: string;
    fileSize: string;
}

interface FolderDocumentsListProps {
    departmentName: string;
    documents: DocumentItem[];
    onBack: () => void;
}

const getFileIcon = (type: string) => {
    const key = type.toLowerCase();
    const src = FILE_ICONS_MAP[key] || FILE_ICONS_MAP["file"]; // Fallback to generic 'file.png'
    return <img src={src} alt={type} className="h-7 w-7 object-contain" />;
};

type SortField = "name" | "fileType" | "lastOpened" | "fileSize";

export const FolderDocumentsList: React.FC<FolderDocumentsListProps> = ({
    departmentName,
    documents,
    onBack
}) => {
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<SortField>("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const handleViewDetails = (doc: DocumentItem) => {
        const params = new URLSearchParams({ name: doc.name });
        if (doc.documentNumber) params.set("number", doc.documentNumber);
        if (doc.revisionNumber) params.set("revision", doc.revisionNumber);
        if (departmentName) params.set("department", departmentName);
        window.open(`${ROUTES.DOCUMENTS.KNOWLEDGE_PREVIEW(doc.id)}?${params.toString()}`, "_blank", "noopener,noreferrer");
    };

    const filteredAndSortedDocs = useMemo(() => {
        let result = documents.filter(doc =>
            doc.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        result.sort((a, b) => {
            let comparison = 0;
            if (sortField === "name") comparison = a.name.localeCompare(b.name);
            else if (sortField === "fileType") comparison = a.fileType.localeCompare(b.fileType);
            else if (sortField === "lastOpened") {
                const dateA = new Date(a.lastOpened.split('/').reverse().join('-'));
                const dateB = new Date(b.lastOpened.split('/').reverse().join('-'));
                comparison = dateA.getTime() - dateB.getTime();
            }
            else if (sortField === "fileSize") {
                const getBytes = (size: string) => {
                    if (!size || size === "N/A" || size === "--") return 0;
                    const value = parseFloat(size);
                    if (size.includes("KB")) return value * 1024;
                    if (size.includes("MB")) return value * 1024 * 1024;
                    return value;
                };
                comparison = getBytes(a.fileSize) - getBytes(b.fileSize);
            }

            return sortOrder === "asc" ? comparison : -comparison;
        });

        return result;
    }, [documents, searchQuery, sortField, sortOrder]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortOrder === "asc" ? <IconArrowUp className="h-3 w-3 inline ml-1" /> : <IconArrowDown className="h-3 w-3 inline ml-1" />;
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Folder Header */}
            {/* <div className="sticky sm:static top-0 z-40 -mx-4 sm:mx-0 px-4 py-3 sm:p-5 mb-2 sm:mb-0 bg-white/80 backdrop-blur-md sm:backdrop-blur-none sm:bg-white border-b border-slate-200/60 sm:border sm:rounded-xl shadow-sm transition-all duration-300">
                <div className="flex items-center gap-3 md:gap-4 max-w-full overflow-hidden">
                    <button
                        onClick={onBack}
                        className="h-8 w-8 md:h-9 md:w-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shrink-0 active:scale-90"
                    >
                        <IconChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base md:text-xl font-bold text-slate-900 truncate tracking-tight">{departmentName}</h2>
                        <p className="text-2xs md:text-xs text-slate-500 font-medium truncate flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                            {filteredAndSortedDocs.length} documents in this folder
                        </p>
                    </div>
                </div>
            </div> */}

            {/* Search & Actions Strip */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/30">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3 md:gap-4">
                        <div className="flex-1">
                            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                                Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search in this folder..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400 shadow-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={cn("p-4 md:p-5 flex-1", viewMode === "list" ? "overflow-x-auto" : "overflow-y-auto")}>
                    {filteredAndSortedDocs.length === 0 ? (
                        <div className="text-center py-20">
                            <img src={FILE_ICONS_MAP["file"]} alt="No docs" className="h-10 w-10 md:h-12 md:w-12 text-slate-200 mx-auto mb-4 opacity-20 grayscale" />
                            <p className="text-slate-500 font-medium text-xs md:text-sm">No results found in this folder</p>
                        </div>
                    ) : viewMode === "list" ? (
                        /* List View (Table with Borders) - Optimized for density with Fixed Name Column */
                        <div className="min-w-full overflow-x-auto rounded-lg border border-slate-200 shadow-sm relative">
                            <table className="w-full text-2xs md:text-sm text-left border-collapse translate-x-0">
                                <thead className="bg-slate-50 relative z-20">
                                    <tr className="text-slate-700">
                                        <th className="sticky left-0 z-30 px-2 md:px-4 py-2 md:py-3 text-2xs md:text-xs font-semibold border-b border-r border-slate-200 cursor-pointer bg-slate-50 hover:bg-white transition-colors group whitespace-nowrap min-w-[160px] md:min-w-[240px]" onClick={() => handleSort("name")}>
                                            <div className="flex items-center justify-between gap-1.5">
                                                <span>File Name</span>
                                                <SortIcon field="name" />
                                            </div>
                                        </th>
                                        <th className="px-2 md:px-4 py-2 md:py-3 text-2xs md:text-xs font-semibold border-b border-r border-slate-200 cursor-pointer hover:bg-white transition-colors whitespace-nowrap" onClick={() => handleSort("fileType")}>
                                            <div className="flex items-center justify-between gap-1.5">
                                                <span>File Type</span>
                                                <SortIcon field="fileType" />
                                            </div>
                                        </th>
                                        <th className="px-2 md:px-4 py-2 md:py-3 text-2xs md:text-xs font-semibold border-b border-r border-slate-200 cursor-pointer hover:bg-white transition-colors whitespace-nowrap" onClick={() => handleSort("lastOpened")}>
                                            <div className="flex items-center justify-between gap-1.5">
                                                <span>Last Opened</span>
                                                <SortIcon field="lastOpened" />
                                            </div>
                                        </th>
                                        <th className="px-2 md:px-4 py-2 md:py-3 text-2xs md:text-xs font-semibold border-b border-slate-200 cursor-pointer hover:bg-white transition-colors whitespace-nowrap" onClick={() => handleSort("fileSize")}>
                                            <div className="flex items-center justify-between gap-1.5">
                                                <span>File Size</span>
                                                <SortIcon field="fileSize" />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredAndSortedDocs.map((doc) => (
                                        <tr key={doc.id} className="group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewDetails(doc)}>
                                            <td className="sticky left-0 z-10 px-2 md:px-4 py-2 md:py-3 border-r border-slate-200 bg-white group-hover:bg-slate-50 transition-colors shadow-[1px_0_0_0_rgb(226,232,240)] md:shadow-none">
                                                <div className="flex items-center gap-2 md:gap-3">
                                                    <div className="shrink-0">{getFileIcon(doc.fileType)}</div>
                                                    <span className="font-medium text-slate-900 truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[400px] leading-tight hover:text-emerald-600 transition-colors">{doc.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 md:px-4 py-2 md:py-3 border-r border-slate-200 text-slate-600 font-medium whitespace-nowrap">{doc.fileType}</td>
                                            <td className="px-2 md:px-4 py-2 md:py-3 border-r border-slate-200 text-slate-600 whitespace-nowrap">{doc.lastOpened}</td>
                                            <td className="px-2 md:px-4 py-2 md:py-3 text-slate-600 whitespace-nowrap">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span>{doc.fileSize}</span>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewDetails(doc);
                                                            }}
                                                            title="Preview"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Grid View - Simplified */
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4 px-0.5">
                            {filteredAndSortedDocs.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="group border border-slate-200 rounded-xl p-3 md:p-4 hover:border-emerald-500 hover:shadow-md transition-all bg-white relative cursor-pointer"
                                    onClick={() => handleViewDetails(doc)}
                                >
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-full border border-slate-100 shadow-sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleViewDetails(doc);
                                            }}
                                            title="Preview"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    <div className="flex flex-col items-center text-center gap-2 md:gap-3">
                                        <div className="p-2 md:p-3 rounded-lg bg-slate-50 group-hover:bg-emerald-50 transition-colors">
                                            {getFileIcon(doc.fileType)}
                                        </div>
                                        <div className="w-full">
                                            <p className="font-semibold text-slate-900 text-2xs md:text-sm line-clamp-2 mb-1 min-h-[2.2rem] md:min-h-[2.5rem] flex items-center justify-center leading-tight hover:text-emerald-600 transition-colors">{doc.name}</p>
                                            <div className="h-px w-6 md:w-8 bg-slate-100 mx-auto mb-1.5 md:mb-2" />
                                            <p className="text-2xs text-slate-400 font-bold tracking-wider">{doc.fileType} • {doc.fileSize}</p>
                                        </div>
                                        <p className="text-2xs text-slate-500">Opened: {doc.lastOpened}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};