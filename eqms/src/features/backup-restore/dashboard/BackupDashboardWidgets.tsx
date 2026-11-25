import React, { useEffect, useMemo, useState } from "react";
import type { ChartConfiguration } from "chart.js";
import { ChartCanvas } from "@/components/ui/chart";
import { AlertOctagon, AlertTriangle, ChevronDown, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { cn } from "@/components/ui/utils";
import { Card, CardHeader, KpiStrip, type KpiCellData } from "@/features/self-service/dashboard/shared/dashboardUi";
import { PanelError } from "@/features/self-service/dashboard/shared/dashboardParts";
import type { DashboardWidget } from "@/features/self-service/dashboard/shared/DashboardWidgets";
import { backupRestoreApi, type BackupDailyPoint, type BackupOverview, type ManualCopyStatus, type StoreScrubRecord } from "@/services/api/backupRestore";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatBytes, formatDateTime } from "../format";
import { groupAlerts, toAlerts, type Alert, type AlertGroup } from "./backupAlerts";
import { refreshBackupStatus, useBackupStatus } from "./useBackupStatus";
import { tr } from "@/i18n";

const OK = "#10b981";
const WARN = "#f59e0b";
const BAD = "#ef4444";

/** How many kinds of problem are shown before "Show more"; the rest stay one click away, never hidden. */
const GROUPS_SHOWN = 4;

const chartConfig = {
  verified: { label: "Verified", color: OK },
  unverified: { label: tr("Completed, not verified"), color: WARN },
  failed: { label: "Failed", color: BAD },
};

/** The last 30 days as a Chart.js stacked column chart: one column per day, one colour per result. */
const dailyChartConfiguration = (rows: { label: string; verified: number; unverified: number; failed: number }[]): ChartConfiguration<"bar"> => ({
  type: "bar",
  data: {
    labels: rows.map((row) => row.label),
    datasets: (["verified", "unverified", "failed"] as const).map((key) => ({
      label: chartConfig[key].label,
      data: rows.map((row) => row[key]),
      backgroundColor: chartConfig[key].color,
      stack: "runs",
      borderRadius: key === "failed" ? { topLeft: 3, topRight: 3 } : 0,
      categoryPercentage: 0.78,
    })),
  },
  options: {
    animation: { duration: 700, easing: "easeOutQuad" },
    layout: { padding: { top: 8, right: 8 } },
    interaction: { mode: "index", intersect: false },
    scales: {
      x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { autoSkip: false, font: { size: 12 }, callback(value, index) { return index % 4 === 0 ? String(this.getLabelForValue(Number(value))) : ""; } } },
      y: { stacked: true, beginAtZero: true, border: { display: false }, grid: { color: "#f1f5f9" }, ticks: { precision: 0, font: { size: 12 } } },
    },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: "#ffffff", titleColor: "#0f172a", bodyColor: "#334155", borderColor: "#e2e8f0", borderWidth: 1, padding: 10, boxPadding: 4 },
    },
  },
});

const GroupRow: React.FC<{ group: AlertGroup }> = ({ group }) => {
  const [open, setOpen] = useState(false);
  const isError = group.severity === "error";
  const Icon = isError ? AlertOctagon : AlertTriangle;
  const latest = group.items[0];
  const many = group.items.length > 1;
  return (
    <li className={cn("rounded-lg border", isError ? "border-red-100 bg-red-50/60" : "border-amber-100 bg-amber-50/60")}>
      <button
        type="button"
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
        aria-label={`${group.title}${many ? `, ${group.items.length} times` : ""}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", isError ? "text-red-600" : "text-amber-600")} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium text-slate-900">{group.title}</p>
            {many && (
              <Badge color={isError ? "red" : "amber"} size="sm">
                ×{group.items.length}
              </Badge>
            )}
          </div>
          <p className={cn("mt-0.5 break-words text-xs text-slate-600", !open && "line-clamp-1")}>{latest.description}</p>
        </div>
        {latest.at && <span className="hidden shrink-0 text-2xs tabular-nums text-slate-500 sm:block md:text-xs">{formatDateTime(latest.at)}</span>}
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto border-t border-white/70 px-3 py-2.5 pl-10">
          {group.items.map((item) => (
            <li key={item.id} className="text-xs text-slate-600">
              <span className="tabular-nums text-slate-500">{item.at ? formatDateTime(item.at) : "—"}</span>
              {item.ref && <span className="ml-2 font-mono text-slate-700">{item.ref}</span>}
              <span className="block break-words text-slate-600">{item.description}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

/** Where problems are announced: grouped by kind, serious first, the rest one click away; a calm all-clear when there is none. */
const AttentionCard: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  const groups = useMemo(() => groupAlerts(alerts), [alerts]);
  const [showAll, setShowAll] = useState(false);
  const errors = alerts.filter((alert) => alert.severity === "error").length;
  const warnings = alerts.length - errors;
  const visible = showAll ? groups : groups.slice(0, GROUPS_SHOWN);
  const hidden = groups.length - visible.length;

  return (
    <Card aria-label={tr("Needs attention")} role="region">
      <CardHeader
        title={tr("Needs attention")}
        subtitle={alerts.length === 0 ? tr("Every backup control is within its target") : `${errors} need action · ${warnings} to review · ${groups.length} kind${groups.length === 1 ? "" : "s"} of problem`}
        badge={
          <Badge color={errors > 0 ? "red" : alerts.length > 0 ? "amber" : "emerald"} size="sm">
            {alerts.length === 0 ? "All clear" : `${alerts.length} open`}
          </Badge>
        }
      />
      <div className="px-4 pb-4 pt-3">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <p className="text-sm text-slate-700">{tr("No failed backup, unverified backup or broken ledger.")}</p>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {visible.map((group) => (
                <GroupRow key={group.key} group={group} />
              ))}
            </ul>
            {(hidden > 0 || showAll) && groups.length > GROUPS_SHOWN && (
              <div className="mt-3">
                <Button size="sm" variant="ghost" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? tr("Show fewer") : `Show ${hidden} more kind${hidden === 1 ? "" : "s"} of problem`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
};

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-2">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-right font-medium text-slate-900">{children}</dd>
  </div>
);

type DailyRow = { label: string; verified: number; unverified: number; failed: number; total: number };

/** Stacked so each day's height is its real run count: verified, then completed-but-unverified, then failed. */
const toRows = (points: BackupDailyPoint[]): DailyRow[] =>
  points.map((p) => ({
    label: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}`,
    verified: p.completed - p.notVerified,
    unverified: p.notVerified,
    failed: p.failed,
    total: p.completed + p.failed,
  }));

const LEGEND: { key: keyof typeof chartConfig; color: string }[] = [
  { key: "verified", color: OK },
  { key: "unverified", color: WARN },
  { key: "failed", color: BAD },
];

/** The newest check of the live file store: what it read, and what differed from the backup index or from the checksum recorded when a document was signed. */
const StoreScrubCard: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canStart = hasPermission("backup.backup.verify");
  const { showToast } = useToast();
  const [run, setRun] = useState<StoreScrubRecord | null | undefined>();
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .storeScrubs({ page: 1, limit: 1 })
      .then((page) => {
        if (!live) return;
        setRun(page.data[0] ?? null);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const start = async () => {
    setStarting(true);
    try {
      await backupRestoreApi.startStoreScrub();
      showToast({ type: "success", title: tr("Check started"), message: tr("The result appears here when it ends.") });
      window.setTimeout(() => setReloadKey((k) => k + 1), 4000);
    } catch (e) {
      showToast({ type: "error", title: tr("The check was not started"), message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setStarting(false);
    }
  };

  const differences = run ? run.differentFiles + run.missingFiles + run.referenceDifferences : 0;
  return (
    <Card aria-label={tr("File store check")} role="region">
      <CardHeader
        title={tr("File store check")}
        subtitle={tr("Reads the stored files and compares them with the backup. Reports only; nothing is changed.")}
        badge={
          run ? (
            <Badge color={run.status === "RUNNING" ? "blue" : run.status === "FAILED" || differences > 0 ? "red" : "emerald"} size="sm">
              {run.status === "RUNNING" ? "Running" : run.status === "FAILED" ? "Failed" : differences > 0 ? tr("Differences found") : tr("No differences")}
            </Badge>
          ) : undefined
        }
      />
      {failed ? (
        <p className="px-4 pb-4 pt-2 text-sm text-slate-600">{tr("The result could not be read.")}</p>
      ) : run === undefined ? (
        <p className="px-4 pb-4 pt-2 text-sm text-slate-500">{tr("Reading…")}</p>
      ) : run === null ? (
        <p className="px-4 pb-4 pt-2 text-sm text-slate-600">{tr("No check has run yet. One runs every Sunday at 03:30.")}</p>
      ) : (
        <dl className="divide-y divide-slate-100 px-4 pb-3 pt-2 text-sm">
          <Fact label={tr("Last check")}>{formatDateTime(run.finishedAt ?? run.startedAt)}</Fact>
          <Fact label={tr("Started by")}>{run.trigger === "SCHEDULED" ? tr("The weekly schedule") : run.requestedBy}</Fact>
          <Fact label={tr("Files read")}>
            <span className="tabular-nums">{run.checkedFiles}</span>
          </Fact>
          <Fact label={tr("Differ from the backup")}>
            <span className="tabular-nums">{run.differentFiles}</span>
          </Fact>
          <Fact label={tr("Missing from the store")}>
            <span className="tabular-nums">{run.missingFiles}</span>
          </Fact>
          <Fact label={tr("Checksum recorded at signing differs")}>
            <span className="tabular-nums">{run.referenceDifferences}</span>
          </Fact>
        </dl>
      )}
      {canStart && (
        <div className="px-4 pb-4">
          <Button size="sm" variant="outline-emerald" disabled={starting || run?.status === "RUNNING"} onClick={() => void start()}>
            {tr("Check Now")}
          </Button>
        </div>
      )}
    </Card>
  );
};

/** The copy a person makes by hand, as the active policy asks for it. It is recorded on the Backup Storage & Encryption screen. */
const ManualCopyCard: React.FC = () => {
  const [status, setStatus] = useState<ManualCopyStatus | undefined>();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .manualCopyStatus()
      .then((s) => live && setStatus(s))
      .catch(() => live && setHidden(true));
    return () => {
      live = false;
    };
  }, []);

  if (hidden || !status) {
    return (
      <Card aria-label={tr("Manual copy")} role="region">
        <CardHeader title={tr("Manual copy")} subtitle={tr("The copy a person makes by hand.")} />
        <p className="px-4 pb-4 pt-3 text-sm text-slate-500">{hidden ? tr("The manual copy status could not be read.") : "Reading…"}</p>
      </Card>
    );
  }
  const tone = status.state === "ON_TIME" ? "emerald" : status.state === "NOT_DECLARED" ? "slate" : status.state === "OVERDUE" ? "red" : "amber";
  const label = { ON_TIME: "On time", OVERDUE: "Overdue", NEVER_RECORDED: "None recorded", NOT_DECLARED: "Not in the policy" }[status.state];
  return (
    <Card aria-label={tr("Manual copy")} role="region">
      <CardHeader title={tr("Manual copy")} subtitle={tr("The copy a person makes by hand. The system cannot see it, so it is recorded.")} badge={<Badge color={tone} size="sm">{label}</Badge>} />
      <dl className="divide-y divide-slate-100 px-4 pb-3 pt-2 text-sm">
        <Fact label={tr("Last copy")}>{status.lastCopiedOn ? formatDateTime(status.lastCopiedOn) : "—"}</Fact>
        <Fact label={tr("Next one due")}>{status.nextDueOn ? formatDateTime(status.nextDueOn) : "—"}</Fact>
      </dl>
    </Card>
  );
};

/** The last 30 days, one column per day. Shows a failed load as a failure, never as zeros. */
const DailyChart: React.FC<{ points: BackupDailyPoint[] | null; failed: boolean }> = ({ points, failed }) => {
  const rows = useMemo(() => (points ? toRows(points) : []), [points]);
  const dailyConfig = useMemo(() => dailyChartConfiguration(rows), [rows]);
  const runs = rows.reduce((sum, row) => sum + row.total, 0);
  return (
    <Card aria-label={tr("Last 30 days")} role="region">
      <CardHeader
        title={tr("Last 30 days")}
        subtitle={tr("Backup runs per day, by result")}
        badge={points && !failed ? <Badge color="slate" size="sm">{runs} {tr("runs")}</Badge> : undefined}
      />
      <div className="px-4 pb-4 pt-3">
        {failed ? (
          <WarningBanner variant="error" title={tr("Could not load the 30-day history.")} description={tr("No chart is drawn rather than one built on guessed numbers.")} />
        ) : !points ? (
          <div className="h-64 animate-pulse rounded-lg bg-slate-50" aria-hidden="true" />
        ) : (
          <>
            <div className="h-64 w-full">
              <ChartCanvas config={dailyConfig} ariaLabel="Backup runs per day for the last 30 days, by result" />
            </div>
            <ul className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600" aria-label={tr("Chart legend")}>
              {LEGEND.map(({ key, color }) => (
                <li key={key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                  {chartConfig[key].label}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
};

const dash = "—";

/** A refresh that failed after a good read: the card keeps the last values and says so. */
const StaleNote: React.FC = () => {
  const { overview, error } = useBackupStatus();
  return overview && error ? <p className="px-4 pb-2 text-2xs text-amber-700">{tr("Showing the last values read.")} {error}</p> : null;
};

/** One figure of the overview. While it is unread it shows a dash, and a failed first read says so with a retry, never a zero. */
const KpiWidget: React.FC<{ label: string; title: string; accent: string; cell: (overview: BackupOverview) => KpiCellData }> = ({ label, title, accent, cell }) => {
  const { overview, error } = useBackupStatus();
  const shown = overview ? cell(overview) : { title, accent, value: dash, footValue: dash, footLabel: "Not read yet" };
  return (
    <>
      <KpiStrip label={label} className="!grid-cols-1" cells={[shown]} />
      {error && !overview && <PanelError message={error} onRetry={refreshBackupStatus} />}
      <StaleNote />
    </>
  );
};

/** A card built on the overview: it waits for the first read and does not invent figures when it fails. */
const OverviewCard: React.FC<{ label: string; children: (overview: BackupOverview) => React.ReactNode }> = ({ label, children }) => {
  const { overview, error } = useBackupStatus();
  if (overview) {
    return (
      <>
        {children(overview)}
        <StaleNote />
      </>
    );
  }
  return (
    <Card aria-busy={!error}>
      <CardHeader title={label} />
      {error ? <PanelError message={error} onRetry={refreshBackupStatus} /> : <p className="px-4 pb-4 pt-3 text-sm text-slate-500">{tr("Reading the backup status…")}</p>}
    </Card>
  );
};

const AttentionWidget: React.FC = () => (
  <OverviewCard label={tr("Needs attention")}>{(overview) => <AttentionCard alerts={toAlerts(overview)} />}</OverviewCard>
);

const DailyWidget: React.FC = () => {
  const { daily, dailyFailed } = useBackupStatus();
  return <DailyChart points={daily} failed={dailyFailed} />;
};

const LedgerWidget: React.FC = () => (
  <OverviewCard label={tr("Backup ledger")}>
    {(overview) => (
      <Card aria-label={tr("Backup ledger")} role="region">
        <CardHeader
          title={tr("Backup ledger")}
          subtitle={tr("Tamper-evident history, kept outside the eQMS database.")}
          badge={
            <Badge color={overview.ledger.ok ? "emerald" : "red"} size="sm">
              {overview.ledger.ok ? "Intact" : "Broken"}
            </Badge>
          }
        />
        <dl className="divide-y divide-slate-100 px-4 pb-3 pt-2 text-sm">
          <Fact label={tr("Events checked")}>
            <span className="tabular-nums">{overview.ledger.checked}</span>
          </Fact>
          <Fact label={tr("Compared with the copy outside the database")}>{overview.ledger.fileCopyCompared ? "Yes" : tr("No copy found")}</Fact>
        </dl>
      </Card>
    )}
  </OverviewCard>
);

/**
 * The backup cards of the dashboard. They exist only for a person who may view Backup & Restore (the same permission the
 * server asks for on every backup read), so an id kept in a saved layout never shows them to anyone else.
 * The first four are on by default for those people; the others are in the library.
 */
export function useBackupDashboardWidgets(): DashboardWidget[] {
  const { hasPermission } = usePermissions();
  return useMemo<DashboardWidget[]>(
    () =>
      hasPermission("backup.module.view")
        ? [
            { id: "backup-last-success", label: tr("Last successful backup"), width: "half", content: <KpiWidget label={tr("Last successful backup")} title={tr("Last successful backup")} accent={OK} cell={(o) => ({ title: tr("Last successful backup"), accent: o.lastCompleted ? OK : BAD, value: o.lastCompleted ? formatDateTime(o.lastCompleted.finishedAt) : "None yet", footValue: o.lastCompleted ? formatBytes(o.lastCompleted.sizeBytes) : "—", footLabel: o.lastCompleted ? `backup ${o.lastCompleted.backupNumber}` : tr("no backup has completed") })} /> },
            { id: "backup-failed", label: tr("Failed backups"), width: "half", content: <KpiWidget label={tr("Failed backups")} title={tr("Failed backups")} accent={OK} cell={(o) => ({ title: tr("Failed backups"), accent: o.failed > 0 ? BAD : OK, value: o.failed, footValue: o.openAlerts.length, footLabel: "open alerts" })} /> },
            { id: "backup-attention", label: tr("Backup: needs attention"), width: "half", content: <AttentionWidget /> },
            { id: "backup-daily", label: tr("Backup runs, last 30 days"), width: "half", content: <DailyWidget /> },
            { id: "backup-completed", label: tr("Completed backups"), width: "half", defaultVisible: false, content: <KpiWidget label={tr("Completed backups")} title={tr("Completed backups")} accent={OK} cell={(o) => ({ title: tr("Completed backups"), accent: OK, value: o.completed, footValue: o.running, footLabel: "running now" })} /> },
            { id: "backup-unverified", label: tr("Backups without a passing check"), width: "half", defaultVisible: false, content: <KpiWidget label={tr("Backups without a passing check")} title={tr("Without a passing check")} accent={OK} cell={(o) => ({ title: tr("Without a passing check"), accent: o.notVerified > 0 ? WARN : OK, value: o.notVerified, footValue: o.environment, footLabel: "environment" })} /> },
            { id: "backup-ledger", label: tr("Backup ledger"), width: "half", defaultVisible: false, content: <LedgerWidget /> },
            { id: "backup-store-check", label: tr("File store check"), width: "half", defaultVisible: false, content: <StoreScrubCard /> },
            { id: "backup-manual-copy", label: tr("Manual copy"), width: "half", defaultVisible: false, content: <ManualCopyCard /> },
          ]
        : [],
    [hasPermission],
  );
}
