import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form/FormSection";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import type { DataTableColumn } from "@/components/ui/table";
import { TABLE_STYLES } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { useDebounce } from "@/hooks";
import { Database, RotateCcw, Server, FileText, Info, ShieldCheck, ClipboardCheck } from "lucide-react";
import { ROUTES } from "@/app/routes.constants";
import { backupRestoreApi, type RestoreReadiness, type RestoreRequestTarget, type RestoreRequestType } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "./components/BackupRestorePage";
import { ServerListPanel } from "./components/ServerListPanel";
import { BACKUP_STATUS_COLOR, VERIFICATION_COLOR, statusLabel, type BackupRecord } from "./types";
import { formatBytes, formatDateTime } from "./format";
import { IconBrandTelegram, IconChecks, IconLayersSelected } from "@tabler/icons-react";

const STEPS = ["Select Backup", "Type & Target", "Pre-checks", "Review & Submit"];
const BACKUPS_PER_PAGE = 10;
const ALL = "ALL";
const BACKUP_TYPE_OPTIONS = [
  { label: "All", value: ALL },
  { label: "Full", value: "FULL" },
  { label: "Incremental", value: "INCREMENTAL" },
];
const TYPE_OPTIONS: { value: RestoreRequestType; title: string; text: string }[] = [
  { value: "R-FULL", title: "Full restore", text: "Database and document files, both from this backup, so they agree with each other." },
  { value: "R-DB", title: "Database only", text: "Records only. Document files are not touched and may not match the restored records." },
  { value: "R-OBJ", title: "Document files only", text: "Document files only. Records are not touched." },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((option) => [option.value, option.title]));

type Severity = "ok" | "warning" | "blocking";
interface Check {
  label: string;
  detail: string;
  severity: Severity;
}
const SEVERITY_BADGE = { ok: ["emerald", "Pass"], warning: ["amber", "Warning"], blocking: ["red", "Blocks request"] } as const;
type BackupSortKey = "backupNumber" | "startedAt" | "type" | "sizeBytes";

/** A bordered block with an uppercase title, as on Document Properties. */
const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3.5">
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
    {children}
  </div>
);

const LABEL_CLASS = "block text-xs sm:text-sm font-medium text-slate-700 mb-1.5";
const INPUT_CLASS = "w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50";
const TEXTAREA_CLASS = "w-full resize-none px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";

const ChoiceCard: React.FC<{ active: boolean; title: string; text: string; danger?: boolean; onClick: () => void }> = ({ active, title, text, danger, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg border p-3.5 text-left transition-colors ${
      active ? (danger ? "border-red-400 bg-red-50" : "border-emerald-500 bg-emerald-50") : "border-slate-200 bg-white hover:bg-slate-50"
    }`}
  >
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{text}</p>
  </button>
);

/**
 * Asks for a restore. Submitting only records the request; a second person must approve it with an e-signature before anything runs.
 * Only completed and verified backups are offered; the backend checks the same rules again.
 */
export const RestoreRequestView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const requestedBackup = params.get("backup");

  // The backup table is read from the server page by page; the chosen backup is kept as a whole record, not as a row of the page.
  const [backupRows, setBackupRows] = useState<BackupRecord[]>([]);
  const [backupTotal, setBackupTotal] = useState(0);
  const [backupTotalPages, setBackupTotalPages] = useState(1);
  const [backupPage, setBackupPage] = useState(1);
  const [backupPageSize, setBackupPageSize] = useState(BACKUPS_PER_PAGE);
  const [backupSearch, setBackupSearch] = useState("");
  const debouncedBackupSearch = useDebounce(backupSearch, 400);
  const [backupType, setBackupType] = useState(ALL);
  const [backupSort, setBackupSort] = useState<{ key: BackupSortKey; direction: "asc" | "desc" }>({ key: "startedAt", direction: "desc" });
  const [backupLoading, setBackupLoading] = useState(true);
  const [backupHasLoaded, setBackupHasLoaded] = useState(false);
  const [backupsError, setBackupsError] = useState("");
  const [backup, setBackup] = useState<BackupRecord>();
  const backupNumber = backup?.id ?? "";

  const [step, setStep] = useState(0);
  const [type, setType] = useState<RestoreRequestType>("R-FULL");
  const [target, setTarget] = useState<RestoreRequestTarget>("VALIDATION");
  const [reason, setReason] = useState("");
  const [changeRef, setChangeRef] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The test-restore rule is decided on the server (SDS 14.1); the form shows its answer.
  const [readiness, setReadiness] = useState<RestoreReadiness>();
  const [readinessError, setReadinessError] = useState("");

  useEffect(() => {
    let live = true;
    setBackupLoading(true);
    setBackupsError("");
    backupRestoreApi
      .list({
        search: debouncedBackupSearch.trim() || undefined,
        status: "COMPLETED",
        verification: "VERIFIED",
        type: backupType === ALL ? undefined : backupType,
        sortBy: backupSort.key,
        sortDirection: backupSort.direction,
        page: backupPage,
        limit: backupPageSize,
      })
      .then((data) => {
        if (!live) return;
        setBackupRows(data.data);
        setBackupTotal(data.pagination.total);
        setBackupTotalPages(data.pagination.totalPages || 1);
        if (data.pagination.page !== backupPage) setBackupPage(data.pagination.page);
      })
      .catch((e) => {
        if (!live) return;
        setBackupRows([]);
        setBackupTotal(0);
        setBackupsError(getApiErrorMessage(e, "Unable to load the backups."));
      })
      .finally(() => {
        if (!live) return;
        setBackupLoading(false);
        setBackupHasLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [debouncedBackupSearch, backupType, backupSort, backupPage, backupPageSize]);

  useEffect(() => setBackupPage(1), [debouncedBackupSearch, backupType]);

  // A link from a backup's own screen names the backup: read it once and select it.
  useEffect(() => {
    if (!requestedBackup) return;
    let live = true;
    backupRestoreApi
      .get(requestedBackup)
      .then((record) => {
        if (live) setBackup(record);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [requestedBackup]);

  useEffect(() => {
    if (!backupNumber) {
      setReadiness(undefined);
      setReadinessError("");
      return;
    }
    let live = true;
    backupRestoreApi
      .restoreReadiness(backupNumber)
      .then((answer) => {
        if (!live) return;
        setReadiness(answer);
        setReadinessError("");
      })
      .catch((e) => {
        if (!live) return;
        setReadiness(undefined);
        setReadinessError(getApiErrorMessage(e, "Unable to check the test restores of this backup."));
      });
    return () => {
      live = false;
    };
  }, [backupNumber]);

  const sortFor = (key: BackupSortKey) => ({
    direction: backupSort.key === key ? backupSort.direction : undefined,
    onSort: () => {
      setBackupSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setBackupPage(1);
    },
  });

  const backupColumns: DataTableColumn<BackupRecord>[] = [
    { id: "no", header: "No.", label: "No.", headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_b, index) => (backupPage - 1) * backupPageSize + index + 1 },
    {
      id: "backupNumber",
      header: "Backup Number",
      label: "Backup Number",
      sort: sortFor("backupNumber"),
      cell: (b) => (
        <button
          type="button"
          className="font-medium text-emerald-600 hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(ROUTES.BACKUP_RESTORE.BACKUP_DETAIL(b.id));
          }}
        >
          {b.id}
        </button>
      ),
    },
    { id: "startedAt", header: "Started", label: "Started", sort: sortFor("startedAt"), cell: (b) => formatDateTime(b.startedAt) },
    { id: "type", header: "Type", label: "Type", sort: sortFor("type"), cell: (b) => statusLabel(b.type) },
    { id: "size", header: "Size", label: "Size", sort: sortFor("sizeBytes"), cell: (b) => formatBytes(b.sizeBytes) },
    { id: "schema", header: "Schema", label: "Schema", cell: (b) => `V${b.schemaVersion}` },
    { id: "status", header: "Status", label: "Status", cell: (b) => <Badge color={BACKUP_STATUS_COLOR[b.status]}>{statusLabel(b.status)}</Badge> },
    { id: "integrity", header: "Integrity", label: "Integrity", cell: (b) => <Badge color={VERIFICATION_COLOR[b.verification]}>{statusLabel(b.verification)}</Badge> },
    { id: "verifiedAt", header: "Verified", label: "Verified", cell: (b) => formatDateTime(b.verifiedAt ?? null) },
  ];

  const production = target === "PRODUCTION";



  const checks = useMemo<Check[]>(() => {
    if (!backup) return [];
    const list: Check[] = [
      {
        label: "Backup integrity",
        detail: backup.verifiedAt ? `Checksums verified ${formatDateTime(backup.verifiedAt)}.` : "Checksums verified.",
        severity: "ok",
      },
      {
        label: "Reason",
        detail: reason.trim() ? "Recorded." : "A reason is required.",
        severity: reason.trim() ? "ok" : "blocking",
      },
    ];
    if (production) {
      list.push({
        label: "Change control reference",
        detail: changeRef.trim() ? `Linked to ${changeRef.trim()}.` : "A production restore must reference an approved change.",
        severity: changeRef.trim() ? "ok" : "blocking",
      });
      const window = readiness?.maxAgeDays ?? 30;
      list.push(
        readinessError
          ? { label: "Test restore", detail: readinessError, severity: "blocking" }
          : !readiness
            ? { label: `Test restore in the last ${window} days`, detail: "Checking the test restores of this backup.", severity: "blocking" }
            : {
                label: `Test restore in the last ${window} days`,
                detail: readiness.testRestore
                  ? `${readiness.testRestore.rehearsalId} passed ${formatDateTime(readiness.testRestore.finishedAt)}.`
                  : `No passed test restore of this backup in the last ${window} days. Run a test restore first.`,
                severity: readiness.testRestore ? "ok" : "blocking",
              },
      );
    }
    return list;
  }, [backup, reason, production, changeRef, readiness, readinessError]);

  const consequences = useMemo(() => {
    if (!backup) return [];
    const lines = [
      "Submitting records a request. Nothing is restored yet.",
      "A second person must approve it with an e-signature. The approver cannot be you.",
    ];
    lines.push(
      production
        ? "A production restore replaces live data. It must run in a maintenance window."
        : "A validation restore goes to the validation environment only. Live data is not touched.",
    );
    lines.push("Running an approved restore is not built yet. An approved request is recorded but does not run.");
    return lines;
  }, [backup, production]);

  const blocked = checks.some((c) => c.severity === "blocking");
  const canNext =
    (step === 0 && !!backup) ||
    (step === 1 && reason.trim().length > 0 && (!production || changeRef.trim().length > 0)) ||
    (step === 2 && !blocked) ||
    step === 3;

  const back = () => navigate(ROUTES.BACKUP_RESTORE.RESTORES);

  const submit = async () => {
    if (!backup) return;
    setSubmitting(true);
    try {
      const created = await backupRestoreApi.createRestoreRequest(backup.id, {
        type,
        target,
        reason: reason.trim(),
        changeControlRef: production ? changeRef.trim() : undefined,
      });
      showToast({ type: "success", title: "Restore requested", message: `${created.restoreNumber} waits for a second person's approval.` });
      navigate(ROUTES.BACKUP_RESTORE.RESTORES);
    } catch (e) {
      showToast({ type: "error", title: "The request was not created", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BackupRestorePage
      title="New Restore Request"
      group="Restore"
      parent={{ label: "Restore Requests", path: ROUTES.BACKUP_RESTORE.RESTORES }}
      preview={false}
      actions={
        <Button variant="outline-emerald" size="sm" onClick={back}>
          Cancel
        </Button>
      }
    >
      <WorkflowStepper steps={STEPS} currentStepIndex={step} />

      {step === 0 && (
        <FormSection title="Select a backup" icon={<Database className="h-4 w-4" />} description="Only completed and verified backups can be restored.">
          <ServerListPanel
            tableKey="backup-restore.new-request.backups"
            columns={backupColumns}
            rows={backupRows}
            getRowKey={(b) => b.id}
            loading={backupLoading}
            hasLoaded={backupHasLoaded}
            error={backupsError}
            emptyTitle="No Backup To Restore"
            emptyDescription="No completed and verified backup matches. Try changing your search or filter."
            search={backupSearch}
            onSearch={setBackupSearch}
            searchLabel="Search backups"
            searchPlaceholder="Backup Number…"
            filters={[{ id: "type", label: "Type", value: backupType, options: BACKUP_TYPE_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setBackupType }]}
            onClear={() => {
              setBackupSearch("");
              setBackupType(ALL);
              setBackupPage(1);
            }}
            page={backupPage}
            totalPages={backupTotalPages}
            totalItems={backupTotal}
            pageSize={backupPageSize}
            onPageChange={setBackupPage}
            onPageSizeChange={(size) => {
              setBackupPageSize(size);
              setBackupPage(1);
            }}
            selection={{
              visible: true,
              cell: (b) => (
                // The checkbox handles its own click: the row's click (which also selects) must not run after it.
                <div onClick={(event) => event.stopPropagation()}>
                  <Checkbox checked={b.id === backupNumber} onChange={(checked) => setBackup(checked ? b : undefined)} />
                </div>
              ),
            }}
            onRowClick={(b) => setBackup(b)}
            rowClassName={(b) => (b.id === backupNumber ? "bg-emerald-50 hover:bg-emerald-50" : "")}
          />
        </FormSection>
      )}

      {step === 1 && (
        <FormSection title="Type & Target" icon={<IconLayersSelected className="h-4 w-4" />} description="What is restored, where it goes, and why.">
          <div className="space-y-4">
            <Group title="Type of restore">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {TYPE_OPTIONS.map((option) => (
                    <ChoiceCard key={option.value} active={type === option.value} title={option.title} text={option.text} onClick={() => setType(option.value)} />
                  ))}
              </div>
            </Group>
            <Group title="Restore into">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ChoiceCard
                    active={!production}
                    title="Validation environment"
                    text="A separate copy. Live data is not touched. Use it for drills and to inspect old data."
                    onClick={() => setTarget("VALIDATION")}
                  />
                  <ChoiceCard
                    active={production}
                    danger
                    title="Production"
                    text="Replaces live data. Needs a passed test restore in the last 30 days, an approved change and a second approver."
                    onClick={() => setTarget("PRODUCTION")}
                  />
              </div>
            </Group>
            <Group title="Justification">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className={production ? "" : "md:col-span-2"}>
                  <label htmlFor="restore-reason" className={LABEL_CLASS}>
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="restore-reason"
                    rows={3}
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Why is this restore needed?"
                    className={TEXTAREA_CLASS}
                  />
                </div>
                {production && (
                  <div>
                    <label htmlFor="restore-change-ref" className={LABEL_CLASS}>
                      Change control reference <span className="text-red-500">*</span>
                    </label>
                    <input id="restore-change-ref" maxLength={120} value={changeRef} onChange={(event) => setChangeRef(event.target.value)} className={INPUT_CLASS} />
                    <p className="mt-1 text-xs text-slate-500">For example CC-2026-0142</p>
                  </div>
                )}
              </div>
            </Group>
          </div>
        </FormSection>
      )}

      {step === 2 && (
        <FormSection title="Pre-checks" icon={<IconChecks className="h-4 w-4" />} description="A blocking check must be resolved before the request can be submitted.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Group title="What will happen">
              <ul className="list-disc space-y-2 pl-5 text-xs sm:text-sm text-slate-700">
                {consequences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Group>
            <Group title="Checks">
              <ul className="divide-y divide-slate-200">
                {checks.map((check) => {
                  const [color, text] = SEVERITY_BADGE[check.severity];
                  return (
                    <li key={check.label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-slate-900">{check.label}</p>
                        <p className="text-xs text-slate-500">{check.detail}</p>
                      </div>
                      <Badge color={color}>{text}</Badge>
                    </li>
                  );
                })}
              </ul>
            </Group>
          </div>
          {blocked && <WarningBanner className="mt-4" variant="error" description="Go back and resolve the blocking check, or choose the validation environment." />}
        </FormSection>
      )}

      {step === 3 && backup && (
        <FormSection title="Review & Submit" icon={<IconBrandTelegram className="h-4 w-4" />} description="Check the request before it goes to a second person.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Group title="Request">
              <dl className="divide-y divide-slate-200">
                {[
                  ["Backup Number", `${backup.id} · ${formatDateTime(backup.startedAt)}`],
                  ["Type", TYPE_LABEL[type] ?? type],
                  ["Target", production ? "Production — replaces live data" : "Validation environment"],
                  ["Reason", reason.trim()],
                  ...(production ? [["Change control", changeRef.trim()]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
                    <dt className="w-40 shrink-0 text-xs sm:text-sm font-medium text-slate-700">{label}</dt>
                    <dd className="min-w-0 break-words text-xs sm:text-sm text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </Group>
            <Group title="Confirmation">
              <WarningBanner
                variant={production ? "error" : "info"}
                description={
                  production
                    ? "Submitting asks a second person to approve. Nothing is restored until they approve with an e-signature and the restore runs in a maintenance window."
                    : "Submitting asks a second person to approve. The restore would run into the validation environment only."
                }
              />
              <Checkbox label="I understand what this restore will replace." checked={confirmed} onChange={setConfirmed} />
            </Group>
          </div>
        </FormSection>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="outline-emerald" size="sm" onClick={() => (step === 0 ? back() : setStep(step - 1))}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < 3 ? (
          <Button size="sm" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          <Button size="sm" disabled={!confirmed || blocked || submitting} onClick={() => void submit()}>
            Submit for Approval
          </Button>
        )}
      </div>
    </BackupRestorePage>
  );
};
