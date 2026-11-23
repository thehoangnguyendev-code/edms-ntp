import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable, TablePagination } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Fact } from "@/features/backup-restore/components/Fact";
import { formatDate, formatDateTime } from "@/features/backup-restore/format";
import { backupRestoreApi, type ManualCopyRecord, type ManualCopyStatus } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { tr } from "@/i18n";

const STATE: Record<ManualCopyStatus["state"], { label: string; color: "emerald" | "amber" | "red" | "slate" }> = {
  ON_TIME: { label: "On time", color: "emerald" },
  OVERDUE: { label: "Overdue", color: "red" },
  NEVER_RECORDED: { label: tr("None recorded yet"), color: "amber" },
  NOT_DECLARED: { label: tr("Not declared in the policy"), color: "slate" },
};

const todayText = () => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const EMPTY = () => ({ copiedOn: todayText(), backupNumber: "", place: "", madeBy: "", note: "" });

/**
 * The copy a person makes by hand (the third copy of the 3-2-1 rule). The Backup Agent cannot see that copy, so a person records each
 * one here: the day, where it is kept, who made it and the newest backup it holds. The next one is due as the active policy says; an
 * overdue copy raises an alert. Nothing here is filled in by the system.
 */
export const ManualCopyPanel: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canRecord = hasPermission("backup.admin.manual_copy.manage");
  const [status, setStatus] = useState<ManualCopyStatus>();
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ManualCopyRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<ReturnType<typeof EMPTY>>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([backupRestoreApi.manualCopyStatus(), backupRestoreApi.manualCopies({ page, limit: pageSize })])
      .then(([s, list]) => {
        if (!live) return;
        setStatus(s);
        setRows(list.data);
        setTotal(list.pagination.total);
        setTotalPages(list.pagination.totalPages || 1);
        setError("");
      })
      .catch((e) => live && setError(getApiErrorMessage(e, "The manual copy records could not be read.")));
    return () => {
      live = false;
    };
  }, [page, pageSize, reloadKey]);

  const valid = !!form && !!form.copiedOn && !!form.place.trim() && !!form.madeBy.trim();

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await backupRestoreApi.recordManualCopy({
        copiedOn: form.copiedOn,
        backupNumber: form.backupNumber.trim() || undefined,
        place: form.place.trim(),
        madeBy: form.madeBy.trim(),
        note: form.note.trim() || undefined,
      });
      showToast({ type: "success", title: tr("Copy recorded"), message: form.place.trim() });
      setForm(undefined);
      setPage(1);
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: tr("The copy was not recorded"), message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const state = status ? STATE[status.state] : undefined;

  return (
    <div className="space-y-4">
      {error && <WarningBanner variant="error" title={tr("Unable to load")} description={error} />}
      {status && !status.declared && (
        <WarningBanner variant="info" title={tr("The policy declares no manual copy")} description={tr("A manual copy counts toward the 3-2-1 rule only when the active Backup Policy declares it. Records can still be kept here.")} />
      )}
      {status?.state === "OVERDUE" && <WarningBanner variant="error" title={tr("The manual copy is overdue")} description={`It was due on ${formatDate(status.nextDueOn)}.`} />}
      {status?.state === "NEVER_RECORDED" && <WarningBanner variant="warning" title={tr("No manual copy has been recorded")} description={tr("The policy relies on a copy made by hand. Record each one here when it is made.")} />}
      {status && (
        <div className="space-y-3">
          <Fact label={tr("State")}>{state && <Badge color={state.color}>{state.label}</Badge>}</Fact>
          <Fact label={tr("What the policy says")}>{status.declared ? `${status.description}. Made every ${status.everyDays} day(s) by a person.` : "—"}</Fact>
          <Fact label={tr("Last copy")}>
            {status.lastCopiedOn ? `${formatDate(status.lastCopiedOn)} at ${status.lastPlace}, by ${status.lastMadeBy}${status.lastBackupNumber ? `, up to ${status.lastBackupNumber}` : ""}` : "—"}
          </Fact>
          <Fact label={tr("Next one due")}>{status.nextDueOn ? formatDate(status.nextDueOn) : "—"}</Fact>
        </div>
      )}
      {canRecord && (
        <div>
          <Button size="sm" variant="default" onClick={() => setForm(EMPTY())}>
            {tr("Record a Copy")}
          </Button>
        </div>
      )}
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        columns={[
          { id: "day", header: "Copied on", cell: (row) => formatDate(row.copiedOn) },
          { id: "place", header: "Kept at", cell: (row) => row.place },
          { id: "by", header: "Made by", cell: (row) => row.madeBy },
          { id: "backup", header: tr("Newest backup held"), cell: (row) => row.backupNumber ?? "—" },
          { id: "note", header: "Note", cell: (row) => <span className="block max-w-xs whitespace-normal break-words text-xs">{row.note ?? "—"}</span> },
          { id: "recorded", header: "Recorded", cell: (row) => `${row.recordedBy} · ${formatDateTime(row.recordedAt)}` },
        ]}
      />
      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        itemsPerPageOptions={[5, 10, 20]}
      />

      <FormModal
        isOpen={!!form}
        onClose={() => setForm(undefined)}
        title={tr("Record a Manual Copy")}
        description={tr("Record a copy that has been made. It is kept with your name and the time and cannot be edited or removed.")}
        confirmText="Record"
        confirmDisabled={!valid || busy}
        onConfirm={save}
      >
        <div className="space-y-4">
          <FormField label={tr("Day the copy was made")} required>
            <Input type="date" max={todayText()} value={form?.copiedOn ?? ""} onChange={(e) => form && setForm({ ...form, copiedOn: e.target.value })} />
          </FormField>
          <FormField label={tr("Where it is kept")} required hint={tr("For example: the safe at head office.")}>
            <Input maxLength={200} value={form?.place ?? ""} onChange={(e) => form && setForm({ ...form, place: e.target.value })} />
          </FormField>
          <FormField label={tr("Who made it")} required>
            <Input maxLength={120} value={form?.madeBy ?? ""} onChange={(e) => form && setForm({ ...form, madeBy: e.target.value })} />
          </FormField>
          <FormField label={tr("Newest backup it holds")} hint={tr("For example BK-20261110-1900-0001. It must be a completed backup.")}>
            <Input maxLength={40} value={form?.backupNumber ?? ""} onChange={(e) => form && setForm({ ...form, backupNumber: e.target.value })} />
          </FormField>
          <FormField label={tr("Note")}>
            <Textarea rows={3} maxLength={1000} value={form?.note ?? ""} onChange={(e) => form && setForm({ ...form, note: e.target.value })} />
          </FormField>
        </div>
      </FormModal>
    </div>
  );
};
