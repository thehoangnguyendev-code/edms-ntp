import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from '@/app/routes.constants';
import { IconFile, IconLayoutGrid, IconLayoutList, IconFolder, IconFolderOpen } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { knowledgeBase } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { cn } from "@/components/ui/utils";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { Search, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { documentApi } from "@/services/api/documents";
import { useDebounce } from "@/hooks";
import type { KnowledgeBaseDepartmentItem, KnowledgeBaseFolderItem, KnowledgeBaseDocumentItem } from "@/features/documents/document-list/types";

// Static, literal Tailwind classes so the CDN JIT scanner can detect them (see Badge.tsx for the same pattern).
const DEPARTMENT_COLORS: string[] = [
    "text-emerald-600",
    "text-blue-600",
    "text-amber-600",
    "text-purple-600",
    "text-red-600",
    "text-cyan-600",
    "text-orange-600",
    "text-indigo-600",
    "text-pink-600",
    "text-teal-600",
    "text-sky-600",
    "text-violet-600",
    "text-rose-600",
    "text-slate-600",
];

interface Department {
    id: string;
    name: string;
    documentCount: number;
    color: string;
}

type KnowledgeFolderDocument = {
    id: string;
    name: string;
    documentNumber: string;
    revisionNumber: string;
    fileType: string;
    lastOpened: string;
    fileSize: string;
};

import { FolderDocumentsList } from "./FolderDocumentsList";

export const KnowledgeView: React.FC = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [isNavigating, setIsNavigating] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
    const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(true);
    const [isDepartmentDocumentsLoading, setIsDepartmentDocumentsLoading] = useState(false);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDepartmentDocuments, setSelectedDepartmentDocuments] = useState<KnowledgeFolderDocument[]>([]);
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const handleNavigate = (path: string) => {
        setIsNavigating(true);
        navigate(path);
    };

    const handleFolderClick = async (dept: Department) => {
        setIsNavigating(true);
        setIsDepartmentDocumentsLoading(true);
        setSelectedDepartment(dept);
        try {
            const departmentFolder = await documentApi.getKnowledgeBaseDepartment(dept.id);
            setSelectedDepartmentDocuments(
                departmentFolder.documents.map((doc: KnowledgeBaseDocumentItem) => ({
                    id: doc.id,
                    name: doc.documentName,
                    documentNumber: doc.documentNumber || "",
                    revisionNumber: doc.revisionNumber || "",
                    fileType: doc.documentType || "Document",
                    lastOpened: doc.effectiveDate || doc.created || "",
                    fileSize: "N/A",
                }))
            );
            window.scrollTo({ top: 0, behavior: "smooth" });
        } finally {
            setIsDepartmentDocumentsLoading(false);
            setIsNavigating(false);
        }
    };

    const handleBackToFolders = () => {
        setIsNavigating(true);
        setSelectedDepartment(null);
        setSelectedDepartmentDocuments([]);
        setIsNavigating(false);
    };

    useEffect(() => {
        let mounted = true;

        const loadDepartments = async () => {
            try {
                const knowledgeDepartments = await documentApi.getKnowledgeBaseDepartments({
                    search: debouncedSearchQuery,
                    sortDirection: sortOrder,
                });

                if (!mounted) return;
                setDepartments(
                    knowledgeDepartments.map((department, index) => {
                        const color = DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length] || "text-emerald-600";
                        return {
                            id: department.departmentId,
                            name: department.departmentName,
                            documentCount: department.documentCount,
                            color,
                        };
                    })
                );
            } finally {
                if (mounted) {
                    setIsDepartmentsLoading(false);
                }
            }
        };

        void loadDepartments();

        return () => {
            mounted = false;
        };
    }, [debouncedSearchQuery, sortOrder]);

    const totalDocuments = departments.reduce((sum, dept) => sum + dept.documentCount, 0);

    return (
        <div className="space-y-6 w-full flex-1 flex flex-col min-h-0">
            {/* Header: Title + Breadcrumb */}
            <PageHeader
                title={selectedDepartment ? selectedDepartment.name : "Knowledge Base"}
                breadcrumbItems={(() => {
                    const baseItems = knowledgeBase(navigate);
                    if (!selectedDepartment) return baseItems;

                    // When a folder is open, the "Knowledge Base" item should be clickable to return
                    const modifiedBase = baseItems.map((item, idx) => {
                        if (idx === baseItems.length - 1) {
                            return { ...item, isActive: false, onClick: handleBackToFolders };
                        }
                        return item;
                    });

                    return [...modifiedBase, { label: selectedDepartment.name, isActive: true }];
                })()}
                actions={selectedDepartment ? (
                    <Button
                        onClick={handleBackToFolders}
                        variant="outline-emerald"
                        size="sm"
                        className="flex items-center gap-2 whitespace-nowrap"
                    >
                        Back to Folders
                    </Button>
                ) : undefined}
            />

            {isDepartmentsLoading ? (
                <div className="flex-1 min-h-0">
                    <FullPageLoading text="Loading..." />
                </div>
            ) : !selectedDepartment ? (
                <div className="space-y-6 flex-1 flex flex-col min-h-0">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4 shrink-0">
                        <div
                            className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm group cursor-pointer"
                            onClick={() => {
                                setSelectedDepartment(null);
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center shrink-0 text-emerald-600">
                                    <IconFolderOpen size={42} stroke={1.5} />
                                </div>
                                <div>
                                    <p className="text-xs md:text-sm text-slate-600">Total Departments</p>
                                    <p className="text-xl md:text-2xl font-bold text-slate-900">
                                        {departments.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div
                            className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm group cursor-pointer"
                            onClick={() => {
                                setSelectedDepartment(null);
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center shrink-0 text-blue-600">
                                    <IconFile size={42} stroke={1.5} />
                                </div>
                                <div>
                                    <p className="text-xs md:text-sm text-slate-600">Total Documents</p>
                                    <p className="text-xl md:text-2xl font-bold text-slate-900">
                                        {totalDocuments}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Unified Knowledge Base Card */}
                    <motion.div layout className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                        {/* 2. Actions Row (Search + Sort + View) */}
                        <div className="p-4 md:p-5 border-b border-slate-100 bg-white">
                            <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
                                {/* Search input */}
                                <div className="w-full sm:flex-1">
                                    <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                                        Search
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Type to filter folders..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400 shadow-sm"
                                        />
                                    </div>
                                </div>

                                {/* Sort + View Controls */}
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    {/* Sort Select */}
                                    <div className="flex-1 sm:w-[150px]">
                                        <Select
                                            label="Order"
                                            value={sortOrder}
                                            onChange={(value) => setSortOrder(value as "asc" | "desc")}
                                            options={[
                                                { label: "Name A-Z", value: "asc" },
                                                { label: "Name Z-A", value: "desc" },
                                            ]}
                                            placeholder="Order..."
                                            enableSearch={false}
                                        />
                                    </div>

                                    {/* View Mode Switcher */}
                                    <div className="flex flex-col">
                                        <label className="text-2xs md:text-sm font-medium text-slate-700 mb-1.5">View</label>
                                        <div className="flex items-center p-1 bg-slate-100 rounded-lg h-9 border border-slate-200/60 shadow-inner relative overflow-hidden">
                                            <button
                                                onClick={() => setViewMode("grid")}
                                                className={cn(
                                                    "flex items-center justify-center h-7 px-2 md:px-3 rounded-lg transition-all duration-200 relative z-10",
                                                    viewMode === "grid"
                                                        ? "text-emerald-600"
                                                        : "text-slate-500 hover:text-slate-900"
                                                )}
                                                title="Grid View"
                                            >
                                                {viewMode === "grid" && (
                                                    <motion.div
                                                        layoutId="viewModeIndicator"
                                                        className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200"
                                                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                                                    />
                                                )}
                                                <div className="relative z-20">
                                                    <IconLayoutGrid size={18} stroke={viewMode === "grid" ? 2.5 : 2} />
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setViewMode("list")}
                                                className={cn(
                                                    "flex items-center justify-center h-7 px-2 md:px-3 rounded-lg transition-all duration-200 relative z-10",
                                                    viewMode === "list"
                                                        ? "text-emerald-600"
                                                        : "text-slate-500 hover:text-slate-900"
                                                )}
                                                title="List View"
                                            >
                                                {viewMode === "list" && (
                                                    <motion.div
                                                        layoutId="viewModeIndicator"
                                                        className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200"
                                                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                                                    />
                                                )}
                                                <div className="relative z-20">
                                                    <IconLayoutList size={18} stroke={viewMode === "list" ? 2.5 : 2} />
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Main Content Area */}
                        <div className="p-4 md:p-5 overflow-auto flex-1 min-h-0">
                            <AnimatePresence mode="wait" initial={false}>
                                {departments.length === 0 ? (
                                    <motion.div
                                        key="empty-state"
                                        layout
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                        className="text-center py-8 md:py-12"
                                    >
                                        <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3 md:mb-4">
                                            <IconFolder size={28} stroke={1.5} className="text-slate-300" />
                                        </div>
                                        <p className="text-sm md:text-base text-slate-900 font-semibold">No departments found</p>
                                        <p className="text-xs md:text-sm text-slate-500 mt-1">Try adjusting your search query</p>
                                    </motion.div>
                                ) : viewMode === "grid" ? (
                                    <motion.div
                                        key="grid-view"
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
                                    >
                                        {departments.map((dept) => (
                                            <button
                                                key={dept.id}
                                                onClick={() => handleFolderClick(dept)}
                                                className="bg-white border border-slate-200 rounded-xl p-2 md:p-3 hover:bg-slate-50 transition-colors duration-150 text-left flex flex-col items-center gap-2"
                                            >
                                                <div className="shrink-0 flex items-center justify-center">
                                                    <IconFolderOpen
                                                        size={34}
                                                        stroke={1.5}
                                                        className={cn("transform-gpu", dept.color || "text-emerald-600")}
                                                    />
                                                </div>
                                                <div className="text-center w-full min-w-0">
                                                    <p className="font-semibold text-slate-900 text-xs md:text-sm truncate mb-1 px-1">
                                                        {dept.name}
                                                    </p>
                                                    <p className="text-2xs md:text-xs font-medium text-slate-500">
                                                        {dept.documentCount} {dept.documentCount === 1 ? 'document' : 'documents'}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="list-view"
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                        className="space-y-2"
                                    >
                                        {departments.map((dept) => (
                                            <button
                                                key={dept.id}
                                                onClick={() => handleFolderClick(dept)}
                                                className="w-full bg-white border border-slate-200 rounded-lg p-3 md:p-4 hover:bg-slate-50 transition-colors duration-150 text-left"
                                            >
                                                <div className="flex items-center gap-3 md:gap-4">
                                                    <div className="shrink-0 flex items-center justify-center ml-0.5">
                                                        <IconFolderOpen
                                                            size={26}
                                                            stroke={1.6}
                                                            className={cn("pointer-events-none transform-gpu", dept.color || "text-emerald-600")}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-slate-900 text-sm md:text-sm mb-0.5">
                                                            {dept.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 font-medium">
                                                            {dept.documentCount} {dept.documentCount === 1 ? 'document' : 'documents'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            ) : (
                <div className="flex-1 min-h-0">
                    {isDepartmentDocumentsLoading ? (
                        <FullPageLoading text="Loading..." />
                    ) : (
                        <FolderDocumentsList
                            departmentName={selectedDepartment.name}
                            documents={selectedDepartmentDocuments}
                            onBack={handleBackToFolders}
                        />
                    )}
                </div>
            )}

            {isNavigating && <FullPageLoading text="Loading..." />}
        </div>
    );
};
