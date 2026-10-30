import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import React, { useCallback, useEffect, useState } from "react";
import { Eye, FileText, MoreVertical, Search, X } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { ROUTES } from "@/app/routes.constants";
import { Button } from "@/components/ui/button/Button";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { DataTable, useCustomColumnLayout, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { FullPageLoading, SectionLoading } from "@/components/ui/loading/Loading";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { cn } from "@/components/ui/utils";
import { executedRecords as executedRecordsBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useDebounce, useNavigateWithLoading, usePortalDropdown } from "@/hooks";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { formatDateTime } from "@/utils/format";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { executedRecordApi, type ExecutedRecord } from "@/services/api/executedRecords";
import { RecordScanPreview } from "./RecordScanPreview";





/** The emerald text of a cell that opens something: the scan, the document, the controlled copy. */
const LINK_CLASS = "text-left font-medium text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2 focus:outline-none focus-visible:underline";

type SortKey = "created" | "number" | "document" | "copy" | "recipient" | "filled";

/** The date picker works in DD/MM/YYYY; the server takes an ISO date. */
const toIsoDate = (value: string) => {
  const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : value;
};

/** Global "Records" screen -- the scan of every returned paper copy (and older executed forms). The same data a
 *  document's own "Records" tab shows scoped to that one document (see ExecutedRecordsTab.tsx). Click a row to preview the scan.
 *  Search, filters, sorting and paging all run on the server, which also shows each user only the records of copies they may see. */
export const ExecutedRecordsView: React.FC = () => {
  const { navigateTo } = useNavigateWithLoading();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const [previewRecord, setPreviewRecord] = useState<ExecutedRecord | null>(null);
  const [rows, setRows] = useState<ExecutedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedTo, setReceivedTo] = useState("");
  const [recordedFrom, setRecordedFrom] = useState("");
  const [recordedTo, setRecordedTo] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["received"]));

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "created", direction: "desc" });

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  useEntityChanged(["EXECUTED_RECORD"], reload, { debounceMs: 1200 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    executedRecordApi
      .getExecutedRecords({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        filledFrom: receivedFrom ? toIsoDate(receivedFrom) : undefined,
        filledTo: receivedTo ? toIsoDate(receivedTo) : undefined,
        recordedFrom: recordedFrom ? toIsoDate(recordedFrom) : undefined,
        recordedTo: recordedTo ? toIsoDate(recordedTo) : undefined,
        sortBy: sortConfig.key,
        sortDirection: sortConfig.direction,
      })
      .then((page) => {
        if (!active) return;
        setRows(page.data);
        setTotalItems(page.pagination.total);
        setTotalPages(page.pagination.totalPages);
      })
      .catch((err) => {
        if (active) setError(extractApiMessage(err, "Unable to load Records."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [currentPage, itemsPerPage, debouncedSearch, receivedFrom, receivedTo, recordedFrom, recordedTo, reloadKey, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, receivedFrom, receivedTo, recordedFrom, recordedTo]);

  const toggleSection = (id: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearFilters = () => {
    setSearchQuery("");
    setReceivedFrom("");
    setReceivedTo("");
    setRecordedFrom("");
    setRecordedTo("");
    setCurrentPage(1);
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
    setCurrentPage(1);
  };
  const sort = (key: SortKey) => ({
    direction: sortConfig.key === key ? sortConfig.direction : undefined,
    onSort: () => handleSort(key),
  });

  const isInitialLoading = loading && !hasLoaded;
  const isTableLoading = loading && hasLoaded;

  const columns: DataTableColumn<ExecutedRecord>[] = [
    {
      id: "no",
      header: "No.",
      label: "No.",
      locked: true,
      headerClassName: TABLE_STYLES.headerCell35,
      cellClassName: TABLE_STYLES.cell30,
      cell: (_, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    {
      id: "number",
      header: "Record Number",
      label: "Record Number",
      sort: sort("number"),
      cellClassName: TABLE_STYLES.cell27,
      // The record IS its scan: the number opens the scan (a record with no file is just text).
      cell: (r) =>
        r.fileAvailable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewRecord(r);
            }}
            className={LINK_CLASS}
            aria-label={`Open scan of ${r.recordNumber}`}
          >
            {r.recordNumber}
          </button>
        ) : (
          <span className="font-semibold text-slate-900">{r.recordNumber}</span>
        ),
    },
    {
      id: "document",
      sort: sort("document"),
      header: "Document Number",
      label: "Document Number",
      cellClassName: TABLE_STYLES.cell28,
      cell: (r) =>
        r.formDocumentId && r.formDocumentNumber ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigateTo(ROUTES.DOCUMENTS.DETAIL(r.formDocumentId!));
            }}
            className={cn(LINK_CLASS, "max-w-full truncate")}
            aria-label={`Open document ${r.formDocumentNumber}`}
          >
            {r.formDocumentNumber}
          </button>
        ) : (
          <p className="truncate font-medium text-slate-800">{r.formDocumentNumber ?? "-"}</p>
        ),
    },
    {
      id: "documentName",
      header: "Document Name",
      label: "Document Name",
      cellClassName: "max-w-[260px] truncate text-slate-600",
      cell: (r) => r.formDocumentTitle || "-",
    },
    {
      id: "copy",
      header: "Controlled Copy Number",
      label: "Controlled Copy Number",
      sort: sort("copy"),
      cellClassName: "text-slate-700 whitespace-nowrap",
      cell: (r) =>
        r.sourceControlledCopyId && r.sourceControlledCopyNumber ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(r.sourceControlledCopyId!));
            }}
            className={LINK_CLASS}
            aria-label={`Open controlled copy ${r.sourceControlledCopyNumber}`}
          >
            {r.sourceControlledCopyNumber}
          </button>
        ) : (
          (r.sourceControlledCopyNumber ?? "-")
        ),
    },
    { id: "recipient", header: "Recipient", label: "Recipient", sort: sort("recipient"), cellClassName: "text-slate-700 whitespace-nowrap", cell: (r) => r.filledByName ?? "-" },
    {
      id: "received",
      header: "Received Date",
      label: "Received Date",
      sort: sort("filled"),
      cellClassName: "text-slate-600 whitespace-nowrap",
      cell: (r) => (r.filledAt ? formatDateTime(r.filledAt) : "-"),
    },
    {
      id: "created",
      header: "Recorded Date",
      label: "Recorded Date",
      sort: sort("created"),
      cellClassName: "text-slate-600 whitespace-nowrap",
      cell: (r) => (r.createdAt ? formatDateTime(r.createdAt) : "-"),
    },
  ];

  const action: DataTableAction<ExecutedRecord> = {
    header: "Action",
    cell: (r) => (
      <div onClick={(e) => e.stopPropagation()}>
        <button
          ref={getRef(r.id)}
          onClick={(e) => toggle(r.id, e)}
          className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="More actions"
        >
          <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
        </button>
        <PortalDropdownMenu isOpen={openId === r.id} onClose={close} position={position}>
          <div className="py-1">
            {r.fileAvailable && (
              <DropdownMenuItem
                icon={<Eye className="h-4 w-4" />}
                onClick={() => {
                  setPreviewRecord(r);
                  close();
                }}
              >
                Preview Scan
              </DropdownMenuItem>
            )}
            {r.formDocumentId && (
              <DropdownMenuItem
                icon={<FileText className="h-4 w-4" />}
                onClick={() => {
                  navigateTo(ROUTES.DOCUMENTS.DETAIL(r.formDocumentId!));
                  close();
                }}
              >
                View Document
              </DropdownMenuItem>
            )}
          </div>
        </PortalDropdownMenu>
      </div>
    ),
  };
  const { layout, control } = useCustomColumnLayout("documents.records", columns, action);

  const searchInput = (
    <FilterSearchInput
      aria-label="Search records"
      placeholder="Record, document or copy number..."
      value={searchQuery}
      onChange={setSearchQuery}
    />
  );

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {isInitialLoading && <FullPageLoading text="Loading records..." />}

      <PageHeader title="Records" breadcrumbItems={executedRecordsBreadcrumbs(navigateTo)} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          <div className="flex flex-col w-full">
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400" aria-label="Clear search">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2 h-10">
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            <ConfiguredDesktopFilters
              search={searchInput}
              trailing={control}
              filters={[]}
              dates={[
                { id: "received", label: "Received Date Range", from: receivedFrom, to: receivedTo, onFromChange: setReceivedFrom, onToChange: setReceivedTo },
                { id: "recorded", label: "Recorded Date Range", from: recordedFrom, to: recordedTo, onFromChange: setRecordedFrom, onToChange: setRecordedTo },
              ]}
            >
              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pb-4 md:pb-5">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Record, document or copy number..."
                      className="w-full h-9 pl-10 pr-4 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <DateRangePicker
                    label="Received Date Range"
                    startDate={receivedFrom}
                    endDate={receivedTo}
                    onStartDateChange={setReceivedFrom}
                    onEndDateChange={setReceivedTo}
                    placeholder="Select date range"
                  />
                </div>
                <div>
                  <DateRangePicker
                    label="Recorded Date Range"
                    startDate={recordedFrom}
                    endDate={recordedTo}
                    onStartDateChange={setRecordedFrom}
                    onEndDateChange={setRecordedTo}
                    placeholder="Select date range"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <ClearFiltersButton onClearSearch={() => setSearchQuery("")} onClear={clearFilters} />
                  {control}
                </div>
              </div>
            </ConfiguredDesktopFilters>

            <FilterDrawer
              isOpen={isFilterDrawerOpen}
              onClose={() => setIsFilterDrawerOpen(false)}
              onClear={clearFilters}
              onApply={() => setIsFilterDrawerOpen(false)}
            >
              <FilterAccordionItem
                label="Received Date Range"
                isExpanded={expandedSections.has("received")}
                onToggle={() => toggleSection("received")}
              >
                <div className="pt-2 pb-4">
                  <DateRangePicker
                    label="Received Date Range"
                    startDate={receivedFrom}
                    endDate={receivedTo}
                    onStartDateChange={setReceivedFrom}
                    onEndDateChange={setReceivedTo}
                    placeholder="Select date range"
                  />
                </div>
              </FilterAccordionItem>
              <FilterAccordionItem
                label="Recorded Date Range"
                isExpanded={expandedSections.has("recorded")}
                onToggle={() => toggleSection("recorded")}
              >
                <div className="pt-2 pb-4">
                  <DateRangePicker
                    label="Recorded Date Range"
                    startDate={recordedFrom}
                    endDate={recordedTo}
                    onStartDateChange={setRecordedFrom}
                    onEndDateChange={setRecordedTo}
                    placeholder="Select date range"
                  />
                </div>
              </FilterAccordionItem>
            </FilterDrawer>
          </div>

          <div className="flex-1 flex flex-col relative">
            {isTableLoading && (
              <div className="absolute inset-0 z-20 bg-white/40 backdrop-blur-[4px] flex items-center justify-center transition-all duration-300 rounded-xl">
                <SectionLoading text="Searching..." minHeight="150px" />
              </div>
            )}
            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300 relative">
              <DataTable
                rows={rows}
                getRowKey={(r) => r.id}
                columns={layout.columns}
                columnLayout={layout}
                action={action}
                isLoading={loading}
                onRowClick={(r) => r.fileAvailable && setPreviewRecord(r)}
                emptyState={
                  <TableEmptyState
                    title={error ? "Unable to load records" : "No Records Found"}
                    description={error || "No scanned record matches your filters. A record appears here once a returned paper copy is recalled by scan."}
                  />
                }
                pagination={
                  totalItems > 0 ? (
                    <div className="border-t border-slate-200">
                      <TablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        isLoading={isTableLoading}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        itemsPerPageOptions={[10, 20, 50]}
                      />
                    </div>
                  ) : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>

      <RecordScanPreview record={previewRecord} onClose={() => setPreviewRecord(null)} />
    </div>
  );
};
