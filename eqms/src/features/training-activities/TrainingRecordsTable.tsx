import { useCallback, useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import { IconBan } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { trainingError, trainingRecordsApi, type TrainingRecord } from "@/services/api/trainingActivities";
import { day } from "./trainingLabels";

/**
 * Personal training records. `mine` shows only the records of the person who is logged in; otherwise the person sees the records of the own department (or all
 * departments with the right) and may void a record. Search, filters, sort and paging are done by the server. A record is never edited; a wrong one is voided.
 */
export function TrainingRecordsTable({ mine }: { mine: boolean }) {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canVoid = !mine && hasPermission("training.record.void");
  const menu = usePortalDropdown();
  const drag = useTableDragScroll();
  const [voided, setVoided] = useState("");
  const [error, setError] = useState("");
  const [voiding, setVoiding] = useState<{ record: TrainingRecord; reason: string; step: "reason" | "sign" }>();
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      (mine ? trainingRecordsApi.mine(params) : trainingRecordsApi.list(params)).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [mine],
  );
  const extraParams = useMemo(() => (mine ? {} : { includeVoided: voided === "yes" ? true : undefined }), [mine, voided]);
  const table = useServerTable<TrainingRecord>({ fetcher, defaultSortBy: "completedOn", defaultSortDirection: "desc", extraParams, initialItemsPerPage: 10 });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingRecord>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    ...(mine ? [] : [{ id: "person", header: "Employee", sort: sorted("fullName"), cell: (r: TrainingRecord) => <div><div className="font-medium">{r.fullName}</div><div className="text-xs text-slate-500">{r.employeeCode ?? ""}</div></div> }]),
    { id: "number", header: "Training Number", sort: sorted("trainingNumber"), cell: (r) => r.trainingNumber },
    { id: "topic", header: "Topic", cell: (r) => <div className="max-w-80 whitespace-normal">{r.topicText}</div> },
    { id: "document", header: "Document", sort: sorted("documentNumber"), cell: (r) => (r.documentNumber ? `${r.documentNumber}${r.documentRevision ? ` Rev ${r.documentRevision}` : ""}` : "—") },
    { id: "completed", header: "Completed", sort: sorted("completedOn"), cell: (r) => day(r.completedOn) },
    { id: "result", header: "Result", cell: (r) => (r.result === "READ" ? "Read and understood" : "Passed") },
    {
      id: "state",
      header: "Record",
      cell: (r) => (r.voidedAt ? <Badge color="red">Voided</Badge> : <Badge color="emerald">Valid</Badge>),
    },
    { id: "void", header: "Void reason", cell: (r) => (r.voidedAt ? <div className="max-w-60 whitespace-normal">{r.voidReason}</div> : "—") },
  ];
  const action = canVoid
    ? {
        cell: (r: TrainingRecord) =>
          r.voidedAt ? null : (
            <button type="button" ref={menu.getRef(r.id)} aria-label="More actions" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(event) => menu.toggle(r.id, event)}>
              <MoreVertical className="h-4 w-4" />
            </button>
          ),
      }
    : undefined;
  const { layout, control } = useCustomColumnLayout(mine ? "training.records.mine" : "training.records.all", columns, action);
  const actionRow = table.items.find((row) => row.id === menu.openId);
  const filters: ReportSelectFilter[] = mine
    ? []
    : [{ id: "voided", label: "Voided records", value: voided, options: [{ label: "Hide voided", value: "" }, { label: "Show voided", value: "yes" }], onChange: (v) => { setVoided(v); table.setCurrentPage(1); } }];

  const doVoid = async (signatureToken: string) => {
    if (!voiding) return;
    setBusy(true);
    try {
      await trainingRecordsApi.voidRecord(voiding.record.id, voiding.reason.trim(), signatureToken);
      showToast({ type: "success", title: "Record voided", message: voiding.record.trainingNumber });
      setVoiding(undefined);
      table.reload();
    } catch (e) {
      showToast({ type: "error", title: "The record was not voided", message: trainingError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      <ReportListToolbar
        searchPlaceholder="Search topic, Training Number, document or name…"
        search={table.searchQuery}
        onSearch={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }}
        filters={filters}
        dates={[]}
        hasActiveFilters={Boolean(voided)}
        onClear={() => { setVoided(""); table.setCurrentPage(1); }}
        customControl={control}
        framed={false}
      >
        <DataTable
          rows={table.items}
          getRowKey={(r) => r.id}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading training records…" />}
          emptyState={<TableEmptyState title="No Training Records" description="Records appear here when QA confirms a training as completed." />}
          scrollerRef={drag.scrollerRef}
          scrollProps={drag.dragEvents}
          isDragging={drag.isDragging}
          columns={columns}
          columnLayout={layout}
          action={action}
          pagination={
            table.totalItems > 0 ? (
              <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
            ) : undefined
          }
        />
      </ReportListToolbar>
      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={200}>
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem icon={<IconBan className="h-4 w-4" />} onClick={() => { setVoiding({ record: actionRow, reason: "", step: "reason" }); menu.close(); }}>
              Void record
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal
        isOpen={voiding?.step === "reason"}
        onClose={() => setVoiding(undefined)}
        onConfirm={() => voiding && setVoiding({ ...voiding, step: "sign" })}
        title="Void training record"
        description="The record is not deleted or changed: it stays in the list as voided with your reason and signature."
        confirmText="Continue to signature"
        confirmVariant="destructive"
        confirmDisabled={!voiding?.reason.trim()}
        size="md"
      >
        <FormField label="Reason" required>
          <Textarea rows={3} value={voiding?.reason ?? ""} onChange={(e) => voiding && setVoiding({ ...voiding, reason: e.target.value })} />
        </FormField>
      </FormModal>
      <ESignatureModal
        isOpen={voiding?.step === "sign"}
        onClose={() => setVoiding(undefined)}
        onConfirm={async (data: { signatureToken: string }) => doVoid(data.signatureToken)}
        actionTitle="Void training record"
        meaningDisplayName="Training Record Voided"
        meaningCode="TRAINING_RECORD_VOIDED"
        targetDetails={{ code: voiding?.record.trainingNumber ?? "", title: voiding?.record.fullName ?? "", revision: "" }}
      />
      {busy && null}
    </>
  );
}
