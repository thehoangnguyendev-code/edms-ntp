import { useCallback, useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { MoreVertical } from "lucide-react";
import { IconBan, IconExternalLink, IconFileSearch } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { TrainingScannedTestsModal } from "../../shared/TrainingScannedTestsModal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Textarea } from "../../shared/TrainingFields";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import { useServerTable } from "@/features/settings/shared/hooks/useServerTable";
import { ReportListToolbar, pickerDateToIso, type ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { myTrainingApi } from "@/services/api/myTraining";
import { trainingError, trainingRecordsApi, type TrainingRecord } from "@/services/api/trainingActivities";
import { METHOD_LABEL, day, statusChange } from "../../shared/trainingLabels";
import { resettingDates, useDateRange, useDepartmentNameOptions } from "../../shared/useListFilters";

/**
 * Personal training records. `mine` shows only the records of the person who is logged in; otherwise the person sees the records of the own department (or all
 * departments with the right) and may void a record. Search, filters, sort and paging are done by the server. A record is never edited; a wrong one is voided.
 */
export function TrainingRecordsTable({ mine }: { mine: boolean }) {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canVoid = !mine && hasPermission("training.record.void");
  const canOpenActivity = hasPermission("training.activity.view");
  const navigate = useNavigate();
  const [scans, setScans] = useState<TrainingRecord>();
  const menu = usePortalDropdown();
  const drag = useTableDragScroll();
  const [voided, setVoided] = usePersistedState(`training.records.${mine ? "mine" : "all"}.voided`, "");
  const [method, setMethod] = usePersistedState(`training.records.${mine ? "mine" : "all"}.method`, "");
  const [result, setResult] = usePersistedState(`training.records.${mine ? "mine" : "all"}.result`, "");
  const [recordState, setRecordState] = usePersistedState(`training.records.${mine ? "mine" : "all"}.recordState`, "");
  const [from, setFrom] = usePersistedState(`training.records.${mine ? "mine" : "all"}.from`, "");
  const [to, setTo] = usePersistedState(`training.records.${mine ? "mine" : "all"}.to`, "");
  const scope = mine ? "mine" : "all";
  const [departmentFilter, setDepartmentFilter] = usePersistedState(`training.records.${scope}.department`, "");
  const departments = useDepartmentNameOptions();
  const completedRange = useDateRange(`training.records.${scope}.completedRange`, "Completed Date Range");
  const recordedRange = useDateRange(`training.records.${scope}.recordedRange`, "Recorded Date Range");
  const [error, setError] = useState("");
  const [voiding, setVoiding] = useState<{ record: TrainingRecord; reason: string; step: "reason" | "sign" }>();
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) =>
      (mine ? myTrainingApi.records(params) : trainingRecordsApi.list(params)).catch((e) => {
        setError(trainingError(e));
        throw e;
      }),
    [mine],
  );
  const extraParams = useMemo(() => (mine ? {
    method: method || undefined, result: result || undefined, recordState: recordState || undefined,
    fromDate: pickerDateToIso(from) || undefined, toDate: pickerDateToIso(to) || undefined,
  } : {
    includeVoided: voided === "yes" ? true : undefined, method: method || undefined, result: result || undefined, department: departmentFilter || undefined,
    ...completedRange.params("completedFrom", "completedTo"), ...recordedRange.params("recordedFrom", "recordedTo"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [mine, voided, method, result, recordState, from, to, departmentFilter, completedRange.from, completedRange.to, recordedRange.from, recordedRange.to]);
  const table = useServerTable<TrainingRecord>({ persistKey: `training.records.${mine ? "mine" : "all"}`, liveTypes: ["TRAINING"], fetcher, defaultSortBy: "completedOn", defaultSortDirection: "desc", extraParams, initialItemsPerPage: 10, syncToUrl: !mine });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const columns: DataTableColumn<TrainingRecord>[] = [
    { id: "no", header: "No.", locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    ...(mine ? [] : [
      { id: "employeeCode", header: "Employee ID", sort: sorted("employeeCode"), cell: (r: TrainingRecord) => r.employeeCode ?? "—" },
      {
        id: "person",
        header: "Full Name",
        sort: sorted("fullName"),
        cell: (r: TrainingRecord) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={r.fullName || "User"} src={r.avatar} tone="brand" className="h-8 w-8" />
            <span className="font-medium text-slate-900">{r.fullName}</span>
          </div>
        ),
      },
    ]),
    { id: "number", header: "Training Number", sort: sorted("trainingNumber"), cell: (r) => r.trainingNumber },
    { id: "topic", header: "Topic", sort: sorted("topicText"), cell: (r) => <div className="max-w-80 whitespace-normal">{r.topicText}</div> },
    { id: "document", header: "Document", sort: sorted("documentNumber"), cell: (r) => (r.documentNumber ? `${r.documentNumber}${r.documentRevision ? ` Rev ${r.documentRevision}` : ""}` : "—") },
    { id: "completed", header: "Completed On", sort: sorted("completedOn"), cell: (r) => day(r.completedOn) },
    ...(mine ? [] : [{ id: "recordedOn", header: "Recorded On", sort: sorted("recordedAt"), cell: (r: TrainingRecord) => day(r.recordedAt) }]),
    { id: "result", header: "Result", sort: sorted("result"), cell: (r) => (r.result === "READ" ? "Read and understood" : r.result === "ATTENDED" ? "Attended" : "Passed") },
    {
      id: "state",
      header: "Record",
      sort: mine ? sorted("recordState") : undefined,
      cell: (r) => (r.voidedAt ? <Badge color="red">Voided</Badge> : <Badge color="emerald">Valid</Badge>),
    },
    { id: "void", header: "Void reason", cell: (r) => (r.voidedAt ? <div className="max-w-60 whitespace-normal">{r.voidReason}</div> : "—") },
  ];
  // Every row has a menu: the scanned tests can be seen by the person and by the one who inspects; voiding stays with the right to void.
  const action = {
    cell: (r: TrainingRecord) => (
      <button type="button" ref={menu.getRef(r.id)} aria-label="More actions" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(event) => menu.toggle(r.id, event)}>
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  };
  const { layout, control } = useCustomColumnLayout(mine ? "training.records.mine" : "training.records.all", columns, action);
  const actionRow = table.items.find((row) => row.id === menu.openId);
  const filters: ReportSelectFilter[] = mine
    ? [
        { id: "method", label: "Method", value: method, options: [{ label: "All", value: "" }, ...Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))], onChange: (v) => { setMethod(v); table.setCurrentPage(1); } },
        { id: "result", label: "Result", value: result, options: [{ label: "All", value: "" }, { label: "Read and understood", value: "READ" }, { label: "Passed", value: "PASSED" }, { label: "Attended", value: "ATTENDED" }], onChange: (v) => { setResult(v); table.setCurrentPage(1); } },
        { id: "recordState", label: "Record", value: recordState, options: [{ label: "All", value: "" }, { label: "Valid", value: "VALID" }, { label: "Voided", value: "VOIDED" }], onChange: (v) => { setRecordState(v); table.setCurrentPage(1); } },
      ]
    : [
        { id: "method", label: "Method", value: method, options: [{ label: "All", value: "" }, ...Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))], onChange: (v) => { setMethod(v); table.setCurrentPage(1); } },
        { id: "result", label: "Result", value: result, options: [{ label: "All", value: "" }, { label: "Read and understood", value: "READ" }, { label: "Passed", value: "PASSED" }, { label: "Attended", value: "ATTENDED" }], onChange: (v) => { setResult(v); table.setCurrentPage(1); } },
        { id: "department", label: "Department", value: departmentFilter, options: [{ label: "All", value: "" }, ...departments], onChange: (v) => { setDepartmentFilter(v); table.setCurrentPage(1); } },
        { id: "voided", label: "Voided records", value: voided, options: [{ label: "Hide voided", value: "" }, { label: "Show voided", value: "yes" }], onChange: (v) => { setVoided(v); table.setCurrentPage(1); } },
      ];

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
        searchPlaceholder="Search employee, topic, Training Number or document…"
        search={table.searchQuery}
        onSearch={(value) => { table.setSearchQuery(value); table.setCurrentPage(1); }}
        filters={filters}
        dates={mine ? [{ id: "completed", label: "Completed Date Range", from, to, onChange: (a, b) => { setFrom(a); setTo(b); table.setCurrentPage(1); } }] : resettingDates([completedRange.filter, recordedRange.filter], () => table.setCurrentPage(1))}
        hasActiveFilters={Boolean(voided || method || result || recordState || from || to || departmentFilter || completedRange.isSet || recordedRange.isSet || table.searchQuery)}
        onClear={() => { setVoided(""); setMethod(""); setResult(""); setRecordState(""); setFrom(""); setTo(""); setDepartmentFilter(""); completedRange.clear(); recordedRange.clear(); table.setSearchQuery(""); table.setCurrentPage(1); }}
        customControl={control}
        framed={!mine}
        flush={mine}
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
            <DropdownMenuItem icon={<IconFileSearch className="h-4 w-4" />} onClick={() => { setScans(actionRow); menu.close(); }}>
              View scanned tests
            </DropdownMenuItem>
            {canOpenActivity && (
              <DropdownMenuItem icon={<IconExternalLink className="h-4 w-4" />} onClick={() => { navigate(`/training-management/activities/${actionRow.activityId}`); menu.close(); }}>
                View training activity
              </DropdownMenuItem>
            )}
            {canVoid && !actionRow.voidedAt && (
              <DropdownMenuItem icon={<IconBan className="h-4 w-4" />} onClick={() => { setVoiding({ record: actionRow, reason: "", step: "reason" }); menu.close(); }}>
                Void record
              </DropdownMenuItem>
            )}
          </div>
        )}
      </PortalDropdownMenu>
      {scans && <TrainingScannedTestsModal personId={scans.personUserId} activityId={scans.activityId} onClose={() => setScans(undefined)} />}
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
        changes={statusChange("Valid", "Voided", "Training record")}
        meaningDisplayName="Training Record Voided"
        meaningCode="TRAINING_RECORD_VOIDED"
        targetDetails={{ code: voiding?.record.trainingNumber ?? "", title: voiding?.record.fullName ?? "", revision: "" }}
      />
      {busy && null}
    </>
  );
}
