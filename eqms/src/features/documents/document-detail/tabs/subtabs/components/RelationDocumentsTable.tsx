import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { StatusBadge } from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { documentApi } from "@/services/api/documents";
import { useServerPagedList } from "@/features/documents/shared/useServerPagedList";
import type { DocumentRelationBase } from "@/features/documents/shared/documentRelation.types";
import { SortableTh, nextSort, type SortDirection } from "./SortableTh";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

interface RelationDocumentsTableProps {
    /** The documents currently selected (possibly unsaved); the server resolves, filters, sorts and pages them. */
    documents: DocumentRelationBase[];
    relationType: "RELATED" | "CORRELATED";
}

/** Related / Correlated Documents list. Search, sort and paging run on the server; only ids are sent from the page. */
export const RelationDocumentsTable: React.FC<RelationDocumentsTableProps> = ({ documents, relationType }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: "documentNumber", direction: "asc" });

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const idsKey = documents.map((doc) => doc.id).join(",");

    const { items, total, totalPages, loading, error, hasLoadedOnce } = useServerPagedList<any>(
        () =>
            documentApi.getDocumentRelationsPage({
                ids: documents.map((doc) => doc.id),
                relationType,
                search: debouncedSearch || undefined,
                sortBy: sort.key,
                sortDirection: sort.direction,
                page: currentPage,
                limit: itemsPerPage,
            }),
        [idsKey, relationType, debouncedSearch, sort.key, sort.direction, currentPage, itemsPerPage],
        documents.length > 0,
    );

    useEffect(() => {
        if (!loading && currentPage > totalPages) setCurrentPage(totalPages);
    }, [loading, currentPage, totalPages]);

    const handleSort = (key: string) => {
        setSort((prev) => nextSort(prev, key));
        setCurrentPage(1);
    };
    const th = (label: string, key: string, className?: string) => (
        <SortableTh label={label} sortKey={key} activeKey={sort.key} direction={sort.direction} onSort={handleSort} className={className} />
    );

    const startIndex = (currentPage - 1) * itemsPerPage;
    const showEmpty = documents.length === 0 || (!loading && items.length === 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by document number, name, opened by, department, or author..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full h-9 pl-10 pr-10 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                </div>
            </div>

            <div className={cn("border rounded-xl bg-white shadow-sm overflow-hidden transition-opacity", loading && hasLoadedOnce && "opacity-60")}>
                <div className="overflow-x-auto">
                    <TableMarkup.Root className="w-full">
                        <TableMarkup.Head className="bg-slate-50 border-b border-slate-200">
                            <TableMarkup.Row>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell10}>
                                    No.
                                </TableMarkup.HeaderCell>
                                {th("Document Number", "documentNumber")}
                                {th("Created", "created", "hidden md:table-cell")}
                                {th("Opened by", "openedBy", "hidden lg:table-cell")}
                                {th("Document Name", "documentName")}
                                {th("Status", "status")}
                                {th("Document Type", "type", "hidden md:table-cell")}
                                {th("Department", "department", "hidden lg:table-cell")}
                                {th("Author/Co-Author", "author", "hidden xl:table-cell")}
                                {th("Effective Date", "effectiveDate", "hidden lg:table-cell")}
                                {th("Valid Until", "validUntil", "hidden xl:table-cell")}
                            </TableMarkup.Row>
                        </TableMarkup.Head>
                        <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                            {loading && !hasLoadedOnce && documents.length > 0 ? (
                                <TableMarkup.Row>
                                    <TableMarkup.Cell colSpan={11} className="py-12 text-center text-sm text-slate-500">Loading...</TableMarkup.Cell>
                                </TableMarkup.Row>
                            ) : error ? (
                                <TableMarkup.Row>
                                    <TableMarkup.Cell colSpan={11} className="py-12 text-center text-sm font-medium text-slate-500">{error}</TableMarkup.Cell>
                                </TableMarkup.Row>
                            ) : showEmpty ? (
                                <TableMarkup.Row>
                                    <TableMarkup.Cell colSpan={11} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2.5">
                                            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                                                <Search className="h-5 w-5 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-500">
                                                {debouncedSearch ? "No records matching your search" : "No records to display"}
                                            </p>
                                        </div>
                                    </TableMarkup.Cell>
                                </TableMarkup.Row>
                            ) : (
                                items.map((doc, index) => (
                                    <TableMarkup.Row key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                                        <TableMarkup.Cell className={TABLE_STYLES.cell12}>
                                            {startIndex + index + 1}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell10}>
                                            {doc.documentNumber}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell15}>
                                            {doc.created}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell14}>
                                            {doc.openedBy}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell13}>
                                            {doc.documentName}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                            <StatusBadge status={String(doc.status || "").toLowerCase().replace(/ /g, "") as any} />
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell15}>
                                            {doc.type}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell14}>
                                            {doc.department}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell16}>
                                            {doc.author}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell14}>
                                            {doc.effectiveDate}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell16}>
                                            {doc.validUntil}
                                        </TableMarkup.Cell>
                                    </TableMarkup.Row>
                                ))
                            )}
                        </TableMarkup.Body>
                    </TableMarkup.Root>
                </div>

                {total > 0 && (
                    <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={total}
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
