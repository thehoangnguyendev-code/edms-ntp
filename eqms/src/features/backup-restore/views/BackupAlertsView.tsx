import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import type { DataTableAction, DataTableColumn } from "@/components/ui/table";
import { TABLE_STYLES } from "@/components/ui/table";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks";
import { backupRestoreApi, type BackupAlertRecipient, type BackupAlertRecord } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { ServerListPanel } from "../components/ServerListPanel";
import { formatDateTime } from "../format";

const ALL = "ALL";
const STATE_OPTIONS = [
  { label: "Not yet acknowledged", value: "OPEN" },
  { label: "Acknowledged", value: "ACKNOWLEDGED" },
  { label: "All", value: "ALL" },
];
const SEVERITY_OPTIONS = [{ label: "All", value: ALL }, ...["CRITICAL", "HIGH", "WARNING", "INFO"].map((value) => ({ label: value, value }))];
const SEVERITY_COLOR = { CRITICAL: "red", HIGH: "red", WARNING: "amber", INFO: "blue" } as const;

/**
 * Backup alerts (SDS 15.1). Every alert the backup agent raised is listed; a person who has seen one acknowledges it, and the
 * acknowledgement records who and when. The people who receive alerts are chosen here; they must be active eQMS accounts.
 */
export const BackupAlertsView: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("backup.admin.alerts.manage");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [state, setState] = useState<string>("OPEN");
  const [severity, setSeverity] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<BackupAlertRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [acknowledging, setAcknowledging] = useState<BackupAlertRecord>();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [recipients, setRecipients] = useState<BackupAlertRecipient[]>([]);
  const [newRecipient, setNewRecipient] = useState("");

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .alerts({ search: debouncedSearch.trim() || undefined, state: state as "OPEN" | "ACKNOWLEDGED" | "ALL", severity: severity === ALL ? undefined : severity, page, limit: pageSize })
      .then((data) => {
        if (!live) return;
        setRows(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages || 1);
        setError("");
      })
      .catch((e) => {
        if (!live) return;
        setRows([]);
        setTotal(0);
        setError(getApiErrorMessage(e, "Unable to load the backup alerts."));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [debouncedSearch, state, severity, page, pageSize, reloadKey]);

  useEffect(() => setPage(1), [debouncedSearch, state, severity, pageSize]);

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .alertRecipients()
      .then((list) => {
        if (live) setRecipients(list);
      })
      .catch(() => {
        if (live) setRecipients([]);
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const acknowledge = async () => {
    if (!acknowledging) return;
    setBusy(true);
    try {
      await backupRestoreApi.acknowledgeAlert(acknowledging.id, comment.trim());
      showToast({ type: "success", title: "Alert acknowledged", message: acknowledging.code });
      setAcknowledging(undefined);
      setComment("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: "The alert was not acknowledged", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const addRecipient = async () => {
    const username = newRecipient.trim();
    if (!username) return;
    setBusy(true);
    try {
      await backupRestoreApi.addAlertRecipient(username);
      setNewRecipient("");
      setReloadKey((k) => k + 1);
      showToast({ type: "success", title: "Recipient added", message: username });
    } catch (e) {
      showToast({ type: "error", title: "The recipient was not added", message: getApiErrorMessage(e, "The account must exist and be active.") });
    } finally {
      setBusy(false);
    }
  };

  const removeRecipient = async (username: string) => {
    setBusy(true);
    try {
      await backupRestoreApi.removeAlertRecipient(username);
      setReloadKey((k) => k + 1);
      showToast({ type: "success", title: "Recipient removed", message: username });
    } catch (e) {
      showToast({ type: "error", title: "The recipient was not removed", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<BackupAlertRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    { id: "at", header: "When", label: "When", cell: (row) => formatDateTime(row.at) },
    { id: "severity", header: "Severity", label: "Severity", cell: (row) => <Badge color={SEVERITY_COLOR[row.severity]}>{row.severity}</Badge> },
    { id: "code", header: "Alert", label: "Alert", cell: (row) => row.code },
    { id: "detail", header: "Detail", label: "Detail", cell: (row) => <span className="break-words">{row.detail ?? "—"}</span> },
    { id: "ref", header: "Reference", label: "Reference", cell: (row) => row.ref ?? "—" },
    { id: "ack", header: "Acknowledged", label: "Acknowledged", cell: (row) => (row.acknowledgedAt ? `${row.acknowledgedBy ?? ""} · ${formatDateTime(row.acknowledgedAt)}` : "—") },
  ];

  const action: DataTableAction<BackupAlertRecord> = {
    header: "Actions",
    headerClassName: TABLE_STYLES.headerCell35,
    cell: (row) =>
      canManage && !row.acknowledgedAt ? (
        <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setAcknowledging(row)}>
          Acknowledge
        </Button>
      ) : null,
  };

  return (
    <BackupRestorePage title="Backup Alerts & Recipients" group="Backup" preview={false}>
      <WarningBanner
        variant="info"
        title="How alerts work"
        description="The backup agent raises an alert when something needs attention. Acknowledging it records who saw it and when; the alert stays in the history."
      />
      <ServerListPanel
        tableKey="backup-restore.alerts.v1"
        columns={columns}
        action={action}
        rows={rows}
        getRowKey={(row) => row.id}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Alerts"
        emptyDescription="There are no alerts for this filter."
        search={search}
        onSearch={setSearch}
        searchLabel="Search alerts"
        searchPlaceholder="Alert, detail or reference…"
        filters={[
          { id: "state", label: "State", value: state, options: STATE_OPTIONS, defaultValue: "OPEN", placeholder: "Not yet acknowledged", onChange: setState },
          { id: "severity", label: "Severity", value: severity, options: SEVERITY_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setSeverity },
        ]}
        onClear={() => {
          setSearch("");
          setState("OPEN");
          setSeverity(ALL);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-sm font-semibold text-slate-800">People who receive alerts</h2>
        <p className="mt-1 text-xs text-slate-500">Only active eQMS accounts can be added.</p>
        <ul className="mt-3 divide-y divide-slate-100">
          {recipients.length === 0 && <li className="py-2 text-sm text-slate-500">No recipients yet.</li>}
          {recipients.map((r) => (
            <li key={r.username} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{r.username}</span>
              {canManage && (
                <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => removeRecipient(r.username)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <FormField label="Username">
              <Input value={newRecipient} placeholder="username" onChange={(event) => setNewRecipient(event.target.value)} />
            </FormField>
            <Button size="sm" disabled={busy || !newRecipient.trim()} onClick={addRecipient}>
              Add recipient
            </Button>
          </div>
        )}
      </div>

      <FormModal
        isOpen={!!acknowledging}
        onClose={() => setAcknowledging(undefined)}
        title={`Acknowledge ${acknowledging?.code ?? "alert"}`}
        description="Your name and the time are recorded with the alert. A note is optional."
        confirmText="Acknowledge"
        confirmDisabled={busy}
        onConfirm={acknowledge}
      >
        <FormField label="Note">
          <Textarea rows={3} value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} />
        </FormField>
      </FormModal>
    </BackupRestorePage>
  );
};
