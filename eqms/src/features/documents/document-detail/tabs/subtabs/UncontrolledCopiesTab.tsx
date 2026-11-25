import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { StatusBadge } from "@/components/ui";
import { uncontrolledCopyApi, type UncontrolledCopy } from "@/services/api/uncontrolledCopy";
import { cn } from "@/components/ui/utils";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { SortableTh } from "./components/SortableTh";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { tr } from "@/i18n";

interface UncontrolledCopiesTabProps {
  documentId: string;
}

export const UncontrolledCopiesTab: React.FC<UncontrolledCopiesTabProps> = ({ documentId }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [copies, setCopies] = useState<UncontrolledCopy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "created",
    direction: "desc",
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!documentId) return;

    const fetchCopies = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await uncontrolledCopyApi.getUncontrolledCopies({
          documentId,
          search: debouncedSearchQuery,
          page: currentPage,
          limit: itemsPerPage,
          sortBy: sortConfig.key as "created" | "number" | "document" | "status" | "validUntil" | "requested" | "distributed",
          sortDirection: sortConfig.direction,
        });
        setCopies(response.data || []);
        setTotalPages(response.pagination?.totalPages ?? 1);
        setTotalItems(response.pagination?.total ?? 0);
      } catch (err) {
        setError(tr("Failed to load uncontrolled copies"));
        console.error("Failed to fetch uncontrolled copies:", err);
      } finally {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    };

    fetchCopies();
  }, [documentId, debouncedSearchQuery, currentPage, itemsPerPage, sortConfig]);

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

  const handleRowClick = (copy: UncontrolledCopy) => {
    navigate(ROUTES.DOCUMENTS.UNCONTROLLED_COPIES.DETAIL(copy.id));
  };

  if (loading && !hasLoadedOnce) {
    return (
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-12 text-center text-slate-500 text-sm">{tr("Loading uncontrolled copies...")}</div>
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
            placeholder={tr("Search by number, document number, or recipient...")}
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
      <div className={cn("border rounded-xl bg-white shadow-sm overflow-hidden transition-opacity", loading && "opacity-60")}>
        <div className="overflow-x-auto">
          <TableMarkup.Root className="w-full">
            <TableMarkup.Head className="bg-slate-50 border-b border-slate-200">
              <TableMarkup.Row>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell10}>{tr("No.")}</TableMarkup.HeaderCell>
                {sortableTh("number", "Copy Number")}
                {sortableTh("document", "Document Number", "hidden md:table-cell")}
                {sortableTh("created", "Requested", "hidden md:table-cell")}
                {sortableTh("status", "Status")}
                {sortableTh("requested", "Requested By", "hidden lg:table-cell")}
                {sortableTh("validUntil", "Valid Until", "hidden xl:table-cell")}
              </TableMarkup.Row>
            </TableMarkup.Head>
            <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
              {error ? (
                <TableMarkup.Row>
                  <TableMarkup.Cell colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
                        <Search className="h-5 w-5 text-rose-300" />
                      </div>
                      <p className="text-sm font-medium text-slate-500">{error}</p>
                    </div>
                  </TableMarkup.Cell>
                </TableMarkup.Row>
              ) : copies.length === 0 ? (
                <TableMarkup.Row>
                  <TableMarkup.Cell colSpan={7} className="p-0">
                    <TableEmptyState title={tr("No uncontrolled copies found")} />
                  </TableMarkup.Cell>
                </TableMarkup.Row>
              ) : (
                copies.map((copy, index) => (
                  <TableMarkup.Row
                    key={copy.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(copy)}
                  >
                    <TableMarkup.Cell className={TABLE_STYLES.cell12}>{(currentPage - 1) * itemsPerPage + index + 1}</TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell11}>{copy.uncontrolledCopyNumber}</TableMarkup.Cell>
                    <TableMarkup.Cell className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700 hidden md:table-cell">
                      {copy.documentNumber}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell15}>{copy.requestedAt || copy.createdAt}</TableMarkup.Cell>
                    <TableMarkup.Cell className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                      <StatusBadge status={(copy.status || "").toLowerCase().replace(/ /g, "") as any} />
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell14}>{copy.requestedByName || "—"}</TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell14}>{copy.validUntil || "—"}</TableMarkup.Cell>
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
