import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { StatusBadge } from "@/components/ui";
import { ControlledCopy } from "./types";
import { useDocumentControlledCopies } from "@/features/documents/shared/useDocumentControlledCopies";
import { cn } from "@/components/ui/utils";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { SortableTh } from "./components/SortableTh";
import { buildControlledCopySnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

interface ControlledCopiesTabProps {
    copies?: ControlledCopy[];
    documentId?: string;
    loading?: boolean;
    error?: string | null;
    emptyMessage?: string;
    onRowClick?: (copy: ControlledCopy) => void;
}

export const ControlledCopiesTab: React.FC<ControlledCopiesTabProps> = ({
    copies,
    documentId,
    loading: externalLoading = false,
    error: externalError = null,
    emptyMessage = "No controlled copies found",
    onRowClick,
}) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery.trim());
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Keys are the ones ControlledCopyService#resolveSort understands; search, sort and paging all run on the server.
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
        key: "created",
        direction: "desc",
    });
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

    const shouldLoadFromServer = Boolean(documentId) && !copies;
    const {
        copies: fetchedCopies,
        loading: fetchedLoading,
        error: fetchedError,
        pagination,
    } = useDocumentControlledCopies(documentId, {
        enabled: shouldLoadFromServer,
        search: debouncedSearchQuery,
        page: currentPage,
        limit: itemsPerPage,
        sortBy: sortConfig.key,
        sortDirection: sortConfig.direction,
    });

    const handleSort = (key: string) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
        }));
        setCurrentPage(1);
    };

    const sortableTh = (key: string, label: string, visibilityClass = "") => (
        <SortableTh
            label={label}
            sortKey={key}
            activeKey={sortConfig.key}
            direction={sortConfig.direction}
            onSort={handleSort}
            className={visibilityClass}
        />
    );

    const sourceData = copies ?? fetchedCopies ?? [];
    const isLoading = externalLoading || fetchedLoading;
    const error = externalError || fetchedError;
    const totalPages = pagination?.totalPages ?? Math.max(1, Math.ceil(sourceData.length / itemsPerPage));
    const totalItems = pagination?.total ?? sourceData.length;
    const currentCopies = sourceData;

    useEffect(() => {
        if (!isLoading) setHasLoadedOnce(true);
    }, [isLoading]);

    useEffect(() => {
        if (!isLoading && totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, isLoading, totalPages]);

    const handleRowClick = (copy: ControlledCopy) => {
        if (onRowClick) {
            onRowClick(copy);
            return;
        }
        navigate(ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(copy.id), {
            state: {
                from: window.location.pathname + window.location.search,
                ...buildControlledCopySnapshotState(copy),
            },
        });
    };

    // Only the very first load replaces the tab; later loads (search / sort / page) keep the table and search box mounted.
    if (isLoading && !hasLoadedOnce) {
        return (
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="p-12 text-center text-slate-500 text-sm">Loading controlled copies...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name, copy number, opened by, or document number..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full h-9 pl-10 pr-10 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                </div>
            </div>

            {/* Table */}
            <div className={cn("border rounded-xl bg-white shadow-sm overflow-hidden transition-opacity", isLoading && "opacity-60")}>
                <div className="overflow-x-auto">
                    <TableMarkup.Root className="w-full">
                        <TableMarkup.Head className="bg-slate-50 border-b border-slate-200">
                            <TableMarkup.Row>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell10}>
                                    No.
                                </TableMarkup.HeaderCell>
                                {sortableTh("name", "Controlled Copy Name")}
                                {sortableTh("controlledCopyNumber", "Copy Number", "hidden md:table-cell")}
                                {sortableTh("created", "Created", "hidden md:table-cell")}
                                {sortableTh("status", "Status")}
                                {sortableTh("openedBy", "Opened by", "hidden lg:table-cell")}
                                {sortableTh("validUntil", "Valid Until", "hidden lg:table-cell")}
                                {sortableTh("revisionName", "Document Revision", "hidden xl:table-cell")}
                                {sortableTh("controlledCopyNumber", "Document Number")}
                            </TableMarkup.Row>
                        </TableMarkup.Head>
                        <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                            {error ? (
                                <TableMarkup.Row>
                                    <TableMarkup.Cell colSpan={9} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2.5">
                                            <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
                                                <Search className="h-5 w-5 text-rose-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-500">{error}</p>
                                        </div>
                                    </TableMarkup.Cell>
                                </TableMarkup.Row>
                            ) : currentCopies.length === 0 ? (
                                <TableMarkup.Row>
                                    <TableMarkup.Cell colSpan={9} className="p-0">
                                        <TableEmptyState title={emptyMessage} />
                                    </TableMarkup.Cell>
                                </TableMarkup.Row>
                            ) : (
                                currentCopies.map((copy, index) => (
                                    <TableMarkup.Row
                                        key={copy.id}
                                        className={cn("hover:bg-slate-50/80 transition-colors", (onRowClick || documentId) && "cursor-pointer")}
                                        onClick={() => handleRowClick(copy)}
                                    >
                                        <TableMarkup.Cell className={TABLE_STYLES.cell12}>
                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell11}>
                                            {copy.controlledCopiesName}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap font-medium text-slate-700 hidden md:table-cell">
                                            {copy.copyNumber}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell15}>
                                            {copy.created}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                            <StatusBadge status={(copy.status || "").toLowerCase().replace(/ /g, "") as any} />
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell14}>
                                            {copy.openedBy}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell14}>
                                            {copy.validUntil}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell16}>
                                            {copy.sourceRevisionId ? (
                                                <button
                                                    type="button"
                                                    className="font-medium text-emerald-600 hover:underline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(ROUTES.DOCUMENTS.REVISIONS.DETAIL(copy.sourceRevisionId!));
                                                    }}
                                                >
                                                    {copy.documentRevision}
                                                </button>
                                            ) : (
                                                copy.documentRevision
                                            )}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell11}>
                                            {copy.controlledCopyNumber || copy.documentNumber}
                                        </TableMarkup.Cell>
                                    </TableMarkup.Row>
                                ))
                            )}
                        </TableMarkup.Body>
                    </TableMarkup.Root>
                </div>

                {/* Pagination */}
                {totalItems > 0 && (
                    <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={(value) => {
                            setItemsPerPage(value);
                            setCurrentPage(1);
                        }}
                        showPageNumbers={false}
                    />
                )}
            </div>
        </div>
    );
};

