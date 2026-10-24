import { useCallback, useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { IconDownload, IconEye } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { OnlyOfficeDocumentViewer } from "@/features/documents/shared/components/OnlyOfficeDocumentViewer";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingFilesApi, type TrainingPaperEvidence } from "@/services/api/trainingActivities";
import { day, saveBlob, when } from "./trainingLabels";

const KIND_LABEL: Record<string, string> = { ATTENDANCE_SHEET: "Attendance sheet", ASSESSMENT: "Test or checklist", CERTIFICATE: "Certificate", OTHER: "Other" };
const size = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const WORD = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** A PDF or a picture is shown as it is, a Word file by the read-only OnlyOffice viewer; any other file can only be saved. */
const canShow = (e: TrainingPaperEvidence) => e.contentType === "application/pdf" || e.contentType?.startsWith("image/") === true || e.contentType === WORD;

/**
 * The scanned sheets and tests of one person in one training, with the way to see each one in the page or to save it. Used by the records, My Training and the
 * reviews of a person. The server searches, sorts and pages the list, decides who may see it and records every view and every download in the Audit Trail.
 */
export function TrainingScannedTestsModal({ personId, activityId, onClose }: { personId: string; activityId: string; onClose: () => void }) {
  const { showToast } = useToast();
  const [heading, setHeading] = useState<{ trainingNumber: string; trainingTitle: string }>();
  const [showing, setShowing] = useState<{ evidence: TrainingPaperEvidence; url?: string }>();
  const [busy, setBusy] = useState(false);
  const menu = usePortalDropdown();

  const fetcher = useCallback(
    async (params: Record<string, string | number | boolean | undefined>) => {
      const page = await trainingFilesApi.personEvidence(personId, activityId, params);
      setHeading({ trainingNumber: page.trainingNumber, trainingTitle: page.trainingTitle });
      return page;
    },
    [personId, activityId],
  );
  const table = useServerTable<TrainingPaperEvidence>({ fetcher, defaultSortBy: "uploadedAt", defaultSortDirection: "asc", initialItemsPerPage: 10, syncToUrl: false });
  // A picture or a file opened in the page is released with the page.
  useEffect(() => () => { if (showing?.url) URL.revokeObjectURL(showing.url); }, [showing]);

  const show = useCallback(async (evidence: TrainingPaperEvidence) => {
    if (evidence.contentType === WORD) {
      setShowing({ evidence });
      return;
    }
    setBusy(true);
    try {
      const blob = await trainingFilesApi.personEvidenceFile(personId, activityId, evidence.id, true);
      setShowing({ evidence, url: URL.createObjectURL(blob) });
    } catch (e) {
      showToast({ type: "error", title: "The file could not be opened", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  }, [personId, activityId, showToast]);
  const save = useCallback(async (evidence: TrainingPaperEvidence) => {
    try {
      saveBlob(await trainingFilesApi.personEvidenceFile(personId, activityId, evidence.id, false), evidence.originalName);
    } catch (e) {
      showToast({ type: "error", title: "The file could not be downloaded", message: trainingError(e) });
    }
  }, [personId, activityId, showToast]);

  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });
  const columns: DataTableColumn<TrainingPaperEvidence>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_e, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    {
      id: "kind",
      header: "Type",
      sort: sorted("kind"),
      cell: (e) => (
        <div>
          <div>{KIND_LABEL[e.kind] ?? e.kind}</div>
          <div className="text-xs text-slate-500">{e.wholeSession ? "Whole session" : "This person"}</div>
        </div>
      ),
    },
    {
      id: "file",
      header: "File",
      sort: sorted("originalName"),
      cell: (e) => (
        <div className="max-w-56 whitespace-normal break-words">
          <div>{e.originalName} <span className="text-xs text-slate-500">({size(e.sizeBytes)})</span></div>
          <div className="text-xs text-slate-500">{e.formUsed ? `Form ${e.formUsed} · ` : ""}{e.uploadedByName}, {day(e.uploadedAt)}</div>
        </div>
      ),
    },
    {
      id: "received",
      header: "Checked",
      sort: sorted("receivedAt"),
      cell: (e) => (e.receivedAt ? <Badge color="emerald" title={`${e.receivedByName}, ${when(e.receivedAt)}`}>Checked</Badge> : <Badge color="amber">Not yet</Badge>),
    },
  ];
  // The last column is the pinned Action column with the menu of the row, as in the other tables.
  const action = {
    cell: (e: TrainingPaperEvidence) => (
      <button type="button" ref={menu.getRef(e.id)} aria-label="More actions" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(event) => menu.toggle(e.id, event)}>
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const actionRow = table.items.find((row) => row.id === menu.openId);

  const preview = showing && (
    <FormModal
      isOpen
      onClose={() => setShowing(undefined)}
      title={showing.evidence.originalName}
      confirmText="Close"
      showCancel={false}
      size="2xl"
      className="max-w-5xl backdrop-blur-none"
      footerExtra={<Button size="sm" variant="outline" onClick={() => void save(showing.evidence)}>Download</Button>}
    >
      {showing.evidence.contentType === WORD ? (
        <OnlyOfficeDocumentViewer key={showing.evidence.id} revisionId={showing.evidence.id} watchForChanges={false} height="68dvh"
          loadConfig={() => trainingFilesApi.personEvidenceViewConfig(personId, activityId, showing.evidence.id)} />
      ) : showing.evidence.contentType?.startsWith("image/")
        ? <img src={showing.url} alt={showing.evidence.originalName} className="mx-auto max-h-[68dvh] max-w-full rounded-lg border border-slate-200 object-contain" />
        : <DocumentPdfViewer fileUrl={showing.url ?? ""} height="68dvh" minHeight="420px" forceHideDownloadAndPrint />}
    </FormModal>
  );

  return (
    <>
    <FormModal
      isOpen
      // While a file is open on top, the list stays as it is: Escape or Close closes the file only.
      onClose={() => { if (!showing) onClose(); }}
      title={`Scanned tests${heading ? `: ${heading.trainingNumber}` : ""}`}
      confirmText="Close"
      showCancel={false}
      size="2xl"
      className="max-w-5xl"
    >
      <div className="space-y-4">
        <FilterSearchInput
          aria-label="Search"
          value={table.searchQuery}
          onChange={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }}
          placeholder="Search file, form or person"
          debounceMs={0}
        />
        <DataTable
          rows={table.items}
          getRowKey={(e) => e.id}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading the scanned files…" />}
          emptyState={<TableEmptyState title="No scanned file" description="A test done in the system, or a record written before the files were kept, has none." />}
          columns={columns}
          action={action}
          pagination={
            table.totalItems > 0 ? (
              <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
            ) : undefined
          }
        />
      </div>
      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={160}>
        {actionRow && (
          <div className="py-1">
            {canShow(actionRow) && (
              <DropdownMenuItem icon={<IconEye className="h-4 w-4" />} onClick={() => { const row = actionRow; menu.close(); void show(row); }}>
                View
              </DropdownMenuItem>
            )}
            <DropdownMenuItem icon={<IconDownload className="h-4 w-4" />} onClick={() => { const row = actionRow; menu.close(); void save(row); }}>
              Download
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
    </FormModal>
    {preview}
    </>
  );
}
