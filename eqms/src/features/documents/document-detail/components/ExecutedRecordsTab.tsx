import React, { useCallback, useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { formatDateTime } from "@/utils/format";
import { executedRecordApi, type ExecutedRecord } from "@/services/api/executedRecords";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { RecordScanPreview } from "@/features/documents/executed-records/RecordScanPreview";

type SortKey = "created" | "number" | "copy" | "recipient" | "filled" | "scan";

/** The scans of returned paper copies -- of one document (formDocumentId) or of one copy (controlledCopyId) -- as the server shows them to the current user. Click a row to preview the
 *  scan. A record is filed already Executed: the DCO's signature on the recall is its approval. */
export const ExecutedRecordsTab: React.FC<{ formDocumentId?: string; controlledCopyId?: string }> = ({ formDocumentId, controlledCopyId }) => {
  const [rows, setRows] = useState<ExecutedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "created", direction: "desc" });
  const [previewRecord, setPreviewRecord] = useState<ExecutedRecord | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  useEntityChanged(["EXECUTED_RECORD"], reload, { debounceMs: 1200 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    executedRecordApi
      .getExecutedRecords({ formDocumentId, controlledCopyId, page: currentPage, limit: itemsPerPage, sortBy: sortConfig.key, sortDirection: sortConfig.direction })
      .then((page) => {
        if (!active) return;
        setRows(page.data);
        setTotalItems(page.pagination.total);
        setTotalPages(page.pagination.totalPages);
      })
      .catch((err) => active && setError(extractApiMessage(err, "Unable to load Records.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [formDocumentId, controlledCopyId, currentPage, itemsPerPage, reloadKey, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
    setCurrentPage(1);
  };
  const sort = (key: SortKey) => ({
    direction: sortConfig.key === key ? sortConfig.direction : undefined,
    onSort: () => handleSort(key),
  });

  const columns: DataTableColumn<ExecutedRecord>[] = [
    {
      id: "no",
      header: "No.",
      headerClassName: "w-16",
      cell: (_, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    {
      id: "number",
      header: "Record Number",
      sort: sort("number"),
      cell: (r) => <span className="font-semibold text-slate-900">{r.recordNumber}</span>,
    },
    { id: "copy", header: "Controlled Copy Number", sort: sort("copy"), cell: (r) => r.sourceControlledCopyNumber ?? "—" },
    { id: "recipient", header: "Recipient", sort: sort("recipient"), cell: (r) => r.filledByName ?? "—" },
    {
      id: "received",
      header: "Received Date",
      sort: sort("filled"),
      cell: (r) => formatDateTime(r.filledAt ?? ""),
    },
    {
      id: "scan",
      sort: sort("scan"),
      header: "Scan",
      cell: (r) =>
        r.fileAvailable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewRecord(r);
            }}
            className="inline-flex max-w-[14rem] items-center gap-1.5 text-emerald-700 hover:text-emerald-800"
            aria-label={`Preview scan of ${r.recordNumber}`}
          >
            <Eye className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs underline-offset-2 hover:underline">{r.fileName ?? "View scan"}</span>
          </button>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          getRowKey={(r) => r.id}
          isLoading={loading}
          onRowClick={(r) => r.fileAvailable && setPreviewRecord(r)}
          emptyState={<TableEmptyState title="No Records yet" description="No paper copy of this document has been returned and scanned yet." />}
          pagination={
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              isLoading={loading}
              onPageChange={setCurrentPage}
            />
          }
        />
      </div>

      <RecordScanPreview record={previewRecord} onClose={() => setPreviewRecord(null)} />
    </div>
  );
};
