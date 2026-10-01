import React, { useCallback, useEffect, useState } from "react";
import { Check, FileUp, PenTool, Printer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateTime } from "@/utils/format";
import { executedRecordApi, type ExecutedRecord } from "@/services/api/executedRecords";
import { formSettingsApi, type FormSettings } from "@/services/api/formSettings";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { ROUTES } from "@/app/routes.constants";
import { SubmitExecutedRecordModal } from "./SubmitExecutedRecordModal";
import { FormSettingsCard } from "./FormSettingsCard";

const STATUS_BADGE: Record<string, "emerald" | "amber" | "red" | "slate"> = {
  EXECUTED: "emerald",
  PENDING_APPROVAL: "amber",
  REJECTED: "red",
  SUBMITTED: "slate",
};
const STATUS_LABEL: Record<string, string> = {
  EXECUTED: "Executed",
  PENDING_APPROVAL: "Pending Approval",
  REJECTED: "Rejected",
  SUBMITTED: "Submitted",
};
const METHOD_LABEL: Record<string, string> = { EFORM: "eForm", PAPER_SCAN: "Paper" };

/** Executed Records tab on a Form's own Document Detail -- scoped list + the two capture entry
 *  points (Fill eForm / Record Physical Copy), gated by this Form's own FormSettings. */
export const ExecutedRecordsTab: React.FC<{ formDocumentId: string }> = ({ formDocumentId }) => {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();

  const [settings, setSettings] = useState<FormSettings | null>(null);
  const [rows, setRows] = useState<ExecutedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: "created" | "number" | "status" | "method" | "filled"; direction: "asc" | "desc" }>({
    key: "created",
    direction: "desc",
  });

  const [openModal, setOpenModal] = useState<"EFORM" | "PAPER_SCAN" | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ExecutedRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSigning, setRejectSigning] = useState(false);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  // Picks up a Design session committed from its own browser tab (see "Design eForm Fields"
  // below), and any Executed Record created/approved/rejected elsewhere.
  useEntityChanged(["FORM_SETTINGS", "EXECUTED_RECORD"], reload, { debounceMs: 1200 });

  useEffect(() => {
    formSettingsApi.getFormSettings(formDocumentId).then(setSettings).catch(() => setSettings(null));
  }, [formDocumentId, reloadKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    executedRecordApi
      .getExecutedRecords({ formDocumentId, page: currentPage, limit: itemsPerPage, sortBy: sortConfig.key, sortDirection: sortConfig.direction })
      .then((page) => {
        if (!active) return;
        setRows(page.data);
        setTotalItems(page.pagination.total);
        setTotalPages(page.pagination.totalPages);
      })
      .catch((err) => active && setError(extractApiMessage(err, "Unable to load Executed Records.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [formDocumentId, currentPage, itemsPerPage, reloadKey, sortConfig]);

  const handleSort = (key: typeof sortConfig.key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };
  const sort = (key: typeof sortConfig.key) => ({
    direction: sortConfig.key === key ? sortConfig.direction : undefined,
    onSort: () => handleSort(key),
  });

  const canApprove = hasPermission("documents.form.approve_executed_record");
  const canReject = hasPermission("documents.form.reject_executed_record");

  const handleApproved = async (data: { reason: string; signatureToken: string }) => {
    if (!approvingId) return;
    await executedRecordApi.approveExecutedRecord(approvingId, { comment: data.reason, signatureToken: data.signatureToken });
    setApprovingId(null);
    showToast({ type: "success", title: "Approved", message: "Executed Record approved." });
    reload();
  };

  const submitReject = async (data: { signatureToken: string }) => {
    if (!rejectTarget) return;
    await executedRecordApi.rejectExecutedRecord(rejectTarget.id, { reason: rejectReason, signatureToken: data.signatureToken });
    setRejectSigning(false);
    setRejectTarget(null);
    setRejectReason("");
    showToast({ type: "success", title: "Rejected", message: "Executed Record rejected." });
    reload();
  };

  const columns: DataTableColumn<ExecutedRecord>[] = [
    {
      id: "no",
      header: "No.",
      headerClassName: "w-16",
      cell: (_, index) => (currentPage - 1) * itemsPerPage + index + 1,
    },
    {
      id: "number",
      header: "Record No.",
      sort: sort("number"),
      cell: (r) => <span className="font-semibold text-slate-900">{r.recordNumber}</span>,
    },
    {
      id: "method",
      header: "Method",
      sort: sort("method"),
      cell: (r) => <Badge color="blue" size="sm">{METHOD_LABEL[r.captureMethod] ?? r.captureMethod}</Badge>,
    },
    { id: "filledBy", header: "Filled By", cell: (r) => r.filledByName ?? "—" },
    {
      id: "status",
      header: "Status",
      sort: sort("status"),
      cell: (r) => <Badge color={STATUS_BADGE[r.status] ?? "slate"} size="sm">{STATUS_LABEL[r.status] ?? r.status}</Badge>,
    },
    {
      id: "filledAt",
      header: "Filled",
      sort: sort("filled"),
      cell: (r) => formatDateTime(r.filledAt ?? ""),
    },
  ];

  const action = (canApprove || canReject)
    ? {
        header: "Actions",
        cell: (r: ExecutedRecord) =>
          r.status === "PENDING_APPROVAL" ? (
            <div className="flex items-center justify-center gap-1.5">
              {canApprove && (
                <Button size="sm" variant="outline-emerald" className="gap-1 px-2" onClick={() => setApprovingId(r.id)}>
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
              )}
              {canReject && (
                <Button size="sm" variant="outline" className="gap-1 px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setRejectTarget(r)}>
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              )}
            </div>
          ) : null,
      }
    : undefined;

  const canConfigure = hasPermission("documents.form.configure");
  const canDesign = hasPermission("documents.form.design_efield");

  return (
    <div className="space-y-4">
      {canConfigure && (
        <FormSettingsCard formDocumentId={formDocumentId} settings={settings} onSaved={reload} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Every eForm submission and scanned paper copy filed against this Form.</p>
        <div className="flex items-center gap-2">
          {canDesign && settings?.allowEform && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              title="Adds fillable fields (text boxes, checkboxes, signature roles) on top of this Form's current Draft content -- edit the content itself first via the Document tab's own Edit button, then come here to lay out the interactive fields."
              onClick={() => window.open(ROUTES.DOCUMENTS.DESIGN_EFORM(formDocumentId), "_blank")}
            >
              <PenTool className="h-4 w-4" /> Design eForm Fields
            </Button>
          )}
          {settings?.canFillEform && (
            // Live in-browser Fill/Sign now happens from the electronic Controlled Copy itself
            // (request one, assign signers at Ready for Distribution, then fill/sign from there) --
            // this manual-upload path stays as the fallback when a filled file already exists
            // outside the system.
            <Button size="sm" variant="outline-emerald" className="gap-1.5" onClick={() => setOpenModal("EFORM")}>
              <FileUp className="h-4 w-4" /> Submit Filled eForm
            </Button>
          )}
          {settings?.canRecordPaper && (
            <Button size="sm" variant="outline-emerald" className="gap-1.5" onClick={() => setOpenModal("PAPER_SCAN")}>
              <Printer className="h-4 w-4" /> Record Physical Copy
            </Button>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          action={action}
          getRowKey={(r) => r.id}
          isLoading={loading}
          emptyState={<TableEmptyState title="No Executed Records yet" description="Nothing has been filled or recorded for this Form yet." />}
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

      {openModal && (
        <SubmitExecutedRecordModal
          isOpen
          onClose={() => setOpenModal(null)}
          onCreated={reload}
          captureMethod={openModal}
          formDocumentId={formDocumentId}
        />
      )}

      {approvingId && (
        <ESignatureModal
          isOpen
          onClose={() => setApprovingId(null)}
          onConfirm={handleApproved}
          actionTitle="Approve Executed Record"
          meaningCode="EFORM_APPROVED"
        />
      )}

      <FormModal
        isOpen={Boolean(rejectTarget) && !rejectSigning}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        onConfirm={() => setRejectSigning(true)}
        title="Reject Executed Record?"
        description={`Rejecting ${rejectTarget?.recordNumber ?? ""} is final -- it cannot be reopened. A correction requires a fresh submission.`}
        confirmText="Continue to sign"
        confirmDisabled={rejectReason.trim().length === 0}
        size="md"
      >
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          placeholder="Reason for rejection..."
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </FormModal>

      {rejectSigning && rejectTarget && (
        <ESignatureModal
          isOpen
          onClose={() => setRejectSigning(false)}
          onConfirm={submitReject}
          actionTitle="Reject Executed Record"
          meaningCode="EFORM_REJECTED"
          targetDetails={{ code: rejectTarget.recordNumber }}
        />
      )}
    </div>
  );
};
