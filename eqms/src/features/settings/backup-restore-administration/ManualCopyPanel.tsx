import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { FormModal } from "@/components/ui/modal/FormModal";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable, TablePagination } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Fact } from "@/features/backup-restore/components/Fact";
import { PagedTable } from "@/features/backup-restore/components/PagedTable";
import { formatDate, formatDateTime } from "@/features/backup-restore/format";
import { backupRestoreApi, type ManualCopyRecord, type ManualCopyStatus } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";

const STATE: Record<ManualCopyStatus["state"], { label: string; color: "emerald" | "amber" | "red" | "slate" }> = {
  ON_TIME: { label: "On time", color: "emerald" },
  OVERDUE: { label: "Overdue", color: "red" },
  NEVER_RECORDED: { label: "None recorded yet", color: "amber" },
  NOT_DECLARED: { label: "Not declared in the policy", color: "slate" },
};

/** Today in the picker's dd/MM/yyyy format. */
const todayText = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/** The picker's dd/MM/yyyy as the yyyy-mm-dd the server takes. */
const toIsoDay = (value: string) => {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value;
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
        copiedOn: toIsoDay(form.copiedOn),
        backupNumber: form.backupNumber.trim() || undefined,
        place: form.place.trim(),
        madeBy: form.madeBy.trim(),
        note: form.note.trim() || undefined,
      });
      showToast({ type: "success", title: "Copy recorded", message: form.place.trim() });
      setForm(undefined);
      setPage(1);
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: "The copy was not recorded", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const state = status ? STATE[status.state] : undefined;

  return (
    <div className="space-y-4">
      {error && <WarningBanner variant="error" title="Unable to load" description={error} />}
      {status && !status.declared && (
        <WarningBanner variant="info" title="The policy declares no manual copy" description="A manual copy counts toward the 3-2-1 rule only when the active Backup Policy declares it. Records can still be kept here." />
      )}
      {status?.state === "OVERDUE" && <WarningBanner variant="error" title="The manual copy is overdue" description={`It was due on ${formatDate(status.nextDueOn)}.`} />}
      {status?.state === "NEVER_RECORDED" && <WarningBanner variant="warning" title="No manual copy has been recorded" description="The policy relies on a copy made by hand. Record each one here when it is made." />}
      {status && (
        <div className="space-y-3">
          <Fact label="State">{state && <Badge color={state.color}>{state.label}</Badge>}</Fact>
          <Fact label="What the policy says">{status.declared ? `${status.description}. Made every ${status.everyDays} day(s) by a person.` : "—"}</Fact>
          <Fact label="Last copy">
            {status.lastCopiedOn ? `${formatDate(status.lastCopiedOn)} at ${status.lastPlace}, by ${status.lastMadeBy}${status.lastBackupNumber ? `, up to ${status.lastBackupNumber}` : ""}` : "—"}
          </Fact>
          <Fact label="Next one due">{status.nextDueOn ? formatDate(status.nextDueOn) : "—"}</Fact>
        </div>
      )}
      {canRecord && (
        <div>
          <Button size="sm" variant="default" onClick={() => setForm(EMPTY())}>
            Record a Copy
          </Button>
        </div>
      )}
      <PagedTable
        rows={rows}
        getRowKey={(row) => row.id}
        columns={[
          { id: "day", header: "Copied on", cell: (row) => formatDate(row.copiedOn) },
          { id: "place", header: "Kept at", cell: (row) => row.place },
          { id: "by", header: "Made by", cell: (row) => row.madeBy },
          { id: "backup", header: "Newest backup held", cell: (row) => row.backupNumber ?? "—" },
          { id: "note", header: "Note", cell: (row) => <span className="block max-w-xs whitespace-normal break-words text-xs">{row.note ?? "—"}</span> },
          { id: "recorded", header: "Recorded", cell: (row) => `${row.recordedBy} · ${formatDateTime(row.recordedAt)}` },
        ]}
        paging={{ page: page, pageSize: pageSize, totalItems: total, totalPages: totalPages, onPageChange: setPage, onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        }, pageSizeOptions: [5, 10, 20] }}
      />

      <FormModal
        isOpen={!!form}
        onClose={() => setForm(undefined)}
        title="Record a Manual Copy"
        description="Record a copy that has been made. It is kept with your name and the time and cannot be edited or removed."
        confirmText="Record"
        confirmDisabled={!valid || busy}
        onConfirm={save}
      >
        <div className="space-y-4">
          <DateTimePicker
            label={
              <>
                Day the copy was made <span className="text-red-500">*</span>
              </>
            }
            value={form?.copiedOn ?? ""}
            onChange={(value) => form && setForm({ ...form, copiedOn: value })}
            placeholder="Select the day"
          />
          <FormField label="Where it is kept" required hint="For example: the safe at head office.">
            <Input maxLength={200} value={form?.place ?? ""} onChange={(e) => form && setForm({ ...form, place: e.target.value })} />
          </FormField>
          <FormField label="Who made it" required>
            <Input maxLength={120} value={form?.madeBy ?? ""} onChange={(e) => form && setForm({ ...form, madeBy: e.target.value })} />
          </FormField>
          <FormField label="Newest backup it holds" hint="Optional. For example BK-20261110-1900-0001. It must be a completed backup.">
            <Input maxLength={40} value={form?.backupNumber ?? ""} onChange={(e) => form && setForm({ ...form, backupNumber: e.target.value })} />
          </FormField>
          <FormField label="Note" hint="Optional.">
            <Textarea rows={3} maxLength={1000} value={form?.note ?? ""} onChange={(e) => form && setForm({ ...form, note: e.target.value })} />
          </FormField>
        </div>
      </FormModal>
    </div>
  );
};
