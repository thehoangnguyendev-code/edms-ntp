import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { StatusBadge } from "@/components/ui";
import { ParentDocument } from "./types";

interface CorrelatedDocumentsTabProps {
    correlatedDocuments: ParentDocument[];
    onCorrelatedDocumentsChange: (docs: ParentDocument[]) => void;
}

export const CorrelatedDocumentsTab: React.FC<CorrelatedDocumentsTabProps> = ({
    correlatedDocuments,
    onCorrelatedDocumentsChange
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Use props data
    const documents = correlatedDocuments;

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
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10 sm:w-16">
                                    No.
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                    Document Number
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                                    Created
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">
                                    Opened by
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                    Document Name
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                    Status
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                                    Document Type
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">
                                    Department
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">
                                    Author/Co-Author
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">
                                    Effective Date
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">
                                    Valid Until
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {currentDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2.5">
                                            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                                                <Search className="h-5 w-5 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-500">No records to display</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                currentDocuments.map((doc, index) => (
                                    <tr
                                        key={doc.id}
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-center text-slate-500 font-medium">
                                            {startIndex + index + 1}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap font-medium text-emerald-600">
                                            {doc.documentNumber}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600 hidden md:table-cell">
                                            {doc.created}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600 hidden lg:table-cell">
                                            {doc.openedBy}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                                            {doc.documentName}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                            <StatusBadge status={doc.status.toLowerCase().replace(/ /g, "") as any} />
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600 hidden md:table-cell">
                                            {doc.type as string}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600 hidden lg:table-cell">
                                            {doc.department}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600 hidden xl:table-cell">
                                            {doc.authorCoAuthor}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600 hidden lg:table-cell">
                                            {doc.effectiveDate}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600 hidden xl:table-cell">
                                            {doc.validUntil}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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




