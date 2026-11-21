import React, { useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { IconCheck } from "@tabler/icons-react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { flagColor } from "@/utils/status";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import type { DataTableAction, DataTableColumn } from "@/components/ui/table";
import { DataTable, TABLE_STYLES } from "@/components/ui/table";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { Switch } from "@/components/ui/switch/Switch";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks";
import { dateToInstant } from "@/features/settings/announcements/announcementFilters";
import {
  backupRestoreApi,
  type AlertRuleRecord,
  type BackupAlertRecipient,
  type BackupAlertRecord,
} from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { ServerListPanel } from "@/features/backup-restore/components/ServerListPanel";
import { formatDateTime } from "@/features/backup-restore/format";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { readableCode } from "@/utils/machineText";

const ALL = "ALL";
const STATE_OPTIONS = [
  { label: "Not yet acknowledged", value: "OPEN" },
  { label: "Acknowledged", value: "ACKNOWLEDGED" },
  { label: "All", value: "ALL" },
];
const SEVERITY_OPTIONS = [{ label: "All", value: ALL }, ...["CRITICAL", "HIGH", "WARNING", "INFO"].map((value) => ({ label: readableCode(value), value }))];
type SortKey = "at" | "severity" | "code" | "ref" | "acknowledgedAt";
const SEVERITY_COLOR = { CRITICAL: "red", HIGH: "red", WARNING: "amber", INFO: "blue" } as const;

const TABS: TabItem[] = [
  { id: "alerts", label: "Alerts" },
  { id: "recipients", label: "Recipients" },
  { id: "rules", label: "Rules" },
];

/** The alerts the Backup Agent raised. Each can be acknowledged by a person, which records who and when; nothing is deleted. */
const AlertsTab: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [state, setState] = useState<string>("OPEN");
  const [severity, setSeverity] = useState(ALL);
  const [raisedFrom, setRaisedFrom] = useState("");
  const [raisedTo, setRaisedTo] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "at", direction: "desc" });
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

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .alerts({
        search: debouncedSearch.trim() || undefined,
        state: state as "OPEN" | "ACKNOWLEDGED" | "ALL",
        severity: severity === ALL ? undefined : severity,
        from: dateToInstant(raisedFrom, "start"),
        to: dateToInstant(raisedTo, "end"),
        sortBy: sort.key,
        sortDirection: sort.direction,
        page,
        limit: pageSize,
      })
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
  }, [debouncedSearch, state, severity, raisedFrom, raisedTo, sort, page, pageSize, reloadKey]);

  useEffect(() => setPage(1), [debouncedSearch, state, severity, raisedFrom, raisedTo, pageSize]);

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

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const columns: DataTableColumn<BackupAlertRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => (page - 1) * pageSize + index + 1 },
    { id: "alertNumber", header: "Alert Number", label: "Alert Number", cell: (row) => <span className="text-xs sm:text-sm font-medium text-emerald-600 whitespace-nowrap">{row.alertNumber ?? "—"}</span> },
    { id: "at", header: "When", label: "When", sort: sortFor("at"), cell: (row) => formatDateTime(row.at) },
    { id: "severity", header: "Severity", label: "Severity", sort: sortFor("severity"), cell: (row) => <Badge color={SEVERITY_COLOR[row.severity]}>{row.severityLabel ?? readableCode(row.severity)}</Badge> },
    { id: "code", header: "Alert", label: "Alert", sort: sortFor("code"), cell: (row) => row.codeLabel ?? readableCode(row.code) },
    { id: "detail", header: "Detail", label: "Detail", cell: (row) => <span className="break-words">{row.detail ?? "—"}</span> },
    { id: "ref", header: "Reference", label: "Reference", sort: sortFor("ref"), cell: (row) => row.ref ?? "—" },
    { id: "ack", header: "Acknowledged", label: "Acknowledged", sort: sortFor("acknowledgedAt"), cell: (row) => (row.acknowledgedAt ? `${row.acknowledgedBy ?? ""} · ${formatDateTime(row.acknowledgedAt)}` : "—") },
  ];

  const menu = usePortalDropdown();
  const [menuRow, setMenuRow] = useState<BackupAlertRecord | null>(null);
  const action: DataTableAction<BackupAlertRecord> = {
    header: "Action",
    headerClassName: TABLE_STYLES.headerCell35,
    cell: (row) =>
      canManage && !row.acknowledgedAt ? (
        <button
        type="button"
        ref={menu.getRef(row.id)}
        aria-label="More actions"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
        onClick={(event) => { setMenuRow(row); menu.toggle(row.id, event); }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      ) : null,
  };

  return (
    <>
      <WarningBanner
        variant="info"
        title="How alerts work"
        description="The Backup Agent raises an alert when something needs attention. Every alert is recorded and listed here. Acknowledging one records who saw it and when; the alert stays in the history."
      />
      <PortalDropdownMenu isOpen={!!menuRow && menu.openId === menuRow.id} onClose={menu.close} position={menu.position} minWidth={200}>
        {menuRow && (
          <div className="py-1">
            <DropdownMenuItem icon={<IconCheck className="h-4 w-4" />} disabled={busy} onClick={() => { setAcknowledging(menuRow); menu.close(); }}>
              Acknowledge
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
      <ServerListPanel
        tableKey="backup-restore.alerts.v1"
        framed={false}
        tableFramed
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
        dates={[{ id: "raised", label: "Raised", from: raisedFrom, to: raisedTo, onFromChange: setRaisedFrom, onToChange: setRaisedTo }]}
        onClear={() => {
          setSearch("");
          setState("OPEN");
          setSeverity(ALL);
          setRaisedFrom("");
          setRaisedTo("");
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
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
    </>
  );
};

/** The people who are told about alerts. They must be active eQMS accounts. */
const RecipientsTab: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const { showToast } = useToast();
  const [recipients, setRecipients] = useState<BackupAlertRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [newRecipient, setNewRecipient] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .alertRecipients()
      .then((list) => {
        if (!live) return;
        setRecipients(list);
        setError("");
      })
      .catch((e) => {
        if (!live) return;
        setRecipients([]);
        setError(getApiErrorMessage(e, "Unable to load the recipients."));
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const add = async () => {
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

  const remove = async (username: string) => {
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

  return (
    <div className="space-y-4">
      <WarningBanner
        variant="info"
        title="Who is told"
        description="Each recipient gets a notification in the application, and an e-mail where the rule asks for one. With no recipient, alerts are only listed."
      />
      {error && <WarningBanner variant="error" title="Unable to load" description={error} />}
      <DataTable
        rows={recipients}
        getRowKey={(row) => row.username}
        isLoading={loading}
        columns={[
          { id: "username", header: "Username", cell: (row) => row.username },
          { id: "addedBy", header: "Added by", cell: (row) => row.addedBy ?? "—" },
          { id: "addedAt", header: "Added", cell: (row) => (row.addedAt ? formatDateTime(row.addedAt) : "—") },
        ]}
        action={{
          header: "Actions",
          cell: (row) =>
            canManage ? (
              <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => remove(row.username)}>
                Remove
              </Button>
            ) : null,
        }}
      />
      {canManage && (
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Username">
            <Input value={newRecipient} placeholder="username" onChange={(event) => setNewRecipient(event.target.value)} />
          </FormField>
          <Button size="sm" disabled={busy || !newRecipient.trim()} onClick={add}>
            Add recipient
          </Button>
        </div>
      )}
    </div>
  );
};

type RuleEdit = { rule: AlertRuleRecord; inApp: boolean; email: boolean; threshold: string; reason: string };

/** Which channels tell people about each kind of alert, and the limit where an alert has one. A change needs a reason and is recorded in the Audit Trail. */
const RulesTab: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const { showToast } = useToast();
  const [rules, setRules] = useState<AlertRuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [edit, setEdit] = useState<RuleEdit>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .alertRules()
      .then((list) => {
        if (!live) return;
        setRules(list);
        setError("");
      })
      .catch((e) => {
        if (!live) return;
        setError(getApiErrorMessage(e, "Unable to load the alert rules."));
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const hasLimit = !!edit && edit.rule.thresholdValue !== null;
  const limitValue = Number(edit?.threshold);
  const limitOk = !hasLimit || (Number.isInteger(limitValue) && limitValue >= (edit?.rule.thresholdMin ?? 0) && limitValue <= (edit?.rule.thresholdMax ?? 0));
  const unchanged = !!edit && edit.inApp === edit.rule.inApp && edit.email === edit.rule.email && (!hasLimit || limitValue === edit.rule.thresholdValue);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await backupRestoreApi.changeAlertRule(edit.rule.code, { inApp: edit.inApp, email: edit.email, threshold: hasLimit ? limitValue : null, reason: edit.reason.trim() });
      showToast({ type: "success", title: "Alert rule changed", message: edit.rule.label });
      setEdit(undefined);
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: "The rule was not changed", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const yesNo = (on: boolean) => <Badge color={flagColor(on)}>{on ? "On" : "Off"}</Badge>;

  return (
    <div className="space-y-4">
      <WarningBanner
        variant="info"
        title="What a rule changes"
        description="Every alert is always recorded and listed, whatever its rule says. A rule chooses who is told: in the application, by e-mail, or neither. Where an alert has a limit, the rule sets it. Changes to the rules, the recipients and acknowledgements are in the Audit Trail."
      />
      {error && <WarningBanner variant="error" title="Unable to load" description={error} />}
      <DataTable
        rows={rules}
        getRowKey={(row) => row.code}
        isLoading={loading}
        columns={[
          { id: "no", header: "No.", headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => index + 1 },
          {
            id: "event",
            header: "When",
            cell: (row) => (
              <div className="max-w-96 whitespace-normal">
                <span className="font-medium text-slate-900">{row.label}</span>
                <span className="block text-xs text-slate-500">{row.hint}</span>
              </div>
            ),
          },
          { id: "limit", header: "Limit", cell: (row) => (row.thresholdValue === null ? "—" : `${row.thresholdValue} ${row.thresholdUnit ?? ""}`) },
          { id: "inApp", header: "In the application", cell: (row) => yesNo(row.inApp) },
          { id: "email", header: "E-mail", cell: (row) => yesNo(row.email) },
          { id: "changed", header: "Last changed", cell: (row) => (row.updatedAt ? `${row.updatedBy ?? ""} · ${formatDateTime(row.updatedAt)}` : "Never") },
        ]}
        action={{
          header: "Actions",
          cell: (row) =>
            canManage ? (
              <Button
                variant="outline-emerald"
                size="sm"
                disabled={busy}
                onClick={() => setEdit({ rule: row, inApp: row.inApp, email: row.email, threshold: row.thresholdValue === null ? "" : String(row.thresholdValue), reason: "" })}
              >
                Change
              </Button>
            ) : null,
        }}
      />

      <FormModal
        isOpen={!!edit}
        onClose={() => setEdit(undefined)}
        title={`Change Rule: ${edit?.rule.label ?? ""}`}
        description="The change is recorded in the Audit Trail with your name, the time and the reason."
        confirmText="Save"
        confirmDisabled={!edit || busy || !edit.reason.trim() || !limitOk || unchanged}
        onConfirm={save}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-900">Tell the recipients in the application</span>
            <Switch size="sm" checked={edit?.inApp ?? false} onChange={(inApp) => edit && setEdit({ ...edit, inApp })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-900">Tell the recipients by e-mail</span>
            <Switch size="sm" checked={edit?.email ?? false} onChange={(email) => edit && setEdit({ ...edit, email })} />
          </div>
          {hasLimit && edit && (
            <FormField label={`Limit (${edit.rule.thresholdUnit ?? ""})`} required hint={`Between ${edit.rule.thresholdMin} and ${edit.rule.thresholdMax}.`}>
              <Input type="number" min={edit.rule.thresholdMin ?? 0} max={edit.rule.thresholdMax ?? undefined} value={edit.threshold} onChange={(event) => setEdit({ ...edit, threshold: event.target.value })} />
            </FormField>
          )}
          <FormField label="Reason" required>
            <Textarea rows={3} maxLength={500} value={edit?.reason ?? ""} onChange={(event) => edit && setEdit({ ...edit, reason: event.target.value })} />
          </FormField>
        </div>
      </FormModal>
    </div>
  );
};

/**
 * Backup Alerts & Recipients (SDS 15.1): the alerts the Backup Agent raised, the people who are told, and the rules that say how. All of it
 * reads and writes real data; the tab is kept in the address (?tab=) so a link opens the right one.
 */
export const BackupAlertsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("backup.admin.alerts.manage");
  const requested = searchParams.get("tab");
  const active = TABS.find((tab) => tab.id === requested)?.id ?? "alerts";

  return (
    <BackupAdminLivePage title="Backup Alerts & Recipients">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav tabs={TABS} activeTab={active} onChange={(id) => setSearchParams({ tab: id }, { replace: true })} layoutId="backup-alerts-tab" ariaLabel="Backup alerts" />
        <div className="space-y-4 p-4 md:p-5">
          {active === "alerts" && <AlertsTab canManage={canManage} />}
          {active === "recipients" && <RecipientsTab canManage={canManage} />}
          {active === "rules" && <RulesTab canManage={canManage} />}
        </div>
      </div>
    </BackupAdminLivePage>
  );
};
