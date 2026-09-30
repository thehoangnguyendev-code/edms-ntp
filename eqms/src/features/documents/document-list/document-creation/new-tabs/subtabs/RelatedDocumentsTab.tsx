import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { StatusBadge } from "@/components/ui";
import { RelatedDocument } from "./types";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

interface RelatedDocumentsTabProps {
    relatedDocuments: RelatedDocument[];
    onRelatedDocumentsChange: (docs: RelatedDocument[]) => void;
}

export const RelatedDocumentsTab: React.FC<RelatedDocumentsTabProps> = ({
    relatedDocuments,
    onRelatedDocumentsChange
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Use props data (relatedDocuments from parent state)
    const documents = relatedDocuments;

    // Filter documents based on search
    const filteredDocuments = useMemo(() => {
        if (!searchQuery.trim()) return documents;

        const query = searchQuery.toLowerCase();
        return documents.filter(
            (doc) =>
                doc.documentNumber.toLowerCase().includes(query) ||
                doc.documentName.toLowerCase().includes(query) ||
                doc.openedBy.toLowerCase().includes(query) ||
                doc.authorCoAuthor.toLowerCase().includes(query)
        );
    }, [searchQuery, documents]);

    // Pagination
    const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentDocuments = filteredDocuments.slice(startIndex, endIndex);

    return (
        <div className="space-y-4">
            {/* Search Bar */}
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

            {/* Table */}
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <TableMarkup.Root className="w-full">
                        <TableMarkup.Head className="bg-slate-50 border-b border-slate-200">
                            <TableMarkup.Row>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell10}>
                                    No.
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell12}>
                                    Document Number
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell14}>
                                    Created
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell13}>
                                    Opened by
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell12}>
                                    Document Name
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell12}>
                                    Status
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell14}>
                                    Document Type
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell13}>
                                    Department
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell15}>
                                    Author/Co-Author
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell13}>
                                    Effective Date
                                </TableMarkup.HeaderCell>
                                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell15}>
                                    Valid Until
                                </TableMarkup.HeaderCell>
                            </TableMarkup.Row>
                        </TableMarkup.Head>
                        <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                            {currentDocuments.length === 0 ? (
                                <TableMarkup.Row>
                                    <TableMarkup.Cell colSpan={11} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2.5">
                                            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                                                <Search className="h-5 w-5 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-500">No records to display</p>
                                        </div>
                                    </TableMarkup.Cell>
                                </TableMarkup.Row>
                            ) : (
                                currentDocuments.map((doc, index) => (
                                    <TableMarkup.Row
                                        key={doc.id}
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
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
                                            <StatusBadge status={doc.status.toLowerCase().replace(/ /g, "") as any} />
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell15}>
                                            {doc.type as string}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell14}>
                                            {doc.department}
                                        </TableMarkup.Cell>
                                        <TableMarkup.Cell className={TABLE_STYLES.cell16}>
                                            {doc.authorCoAuthor}
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

                {/* Pagination */}
                {filteredDocuments.length > 0 && (
                    <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredDocuments.length}
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




