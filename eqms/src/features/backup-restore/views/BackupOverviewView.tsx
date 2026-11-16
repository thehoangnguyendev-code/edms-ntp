import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChartConfiguration } from "chart.js";
import { ChartCanvas } from "@/components/ui/chart";
import { AlertOctagon, AlertTriangle, ChevronDown, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { cn } from "@/components/ui/utils";
import { Card, CardHeader, KpiStrip, type KpiCellData } from "@/features/self-service/dashboard/shared/dashboardUi";
import { backupRestoreApi, type BackupDailyPoint, type BackupOverview, type ManualCopyStatus, type StoreScrubRecord } from "@/services/api/backupRestore";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { statusLabel } from "../types";
import { formatBytes, formatDateTime } from "../format";
import { displayTime } from "@/utils/format";

const OK = "#10b981";
const WARN = "#f59e0b";
const BAD = "#ef4444";

/** How many kinds of problem are shown before "Show more"; the rest stay one click away, never hidden. */
const GROUPS_SHOWN = 4;

/** The status is read again this often while the page is open and visible. */
const REFRESH_MS = 30_000;
const DAYS = 30;

const chartConfig = {
  verified: { label: "Verified", color: OK },
  unverified: { label: "Completed, not verified", color: WARN },
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

export interface Alert {
  id: string;
  severity: "error" | "warning";
  /** Machine code of the problem; alerts with the same code and severity are the same kind of problem. */
  code: string;
  title: string;
  description: string;
  ref?: string | null;
  at?: string;
}

/** The same problem happening again is one line with a count, not a new line each time. */
export interface AlertGroup {
  key: string;
  severity: Alert["severity"];
  title: string;
  items: Alert[];
}

const ALERT_TITLE: Record<string, string> = {
  BACKUP_DUMP_FAILED: "A backup failed while reading the database",
  BACKUP_TARGET_UNAVAILABLE: "A backup failed because the target cannot be written",
  BACKUP_INSUFFICIENT_SPACE: "A backup was stopped: not enough free space",
  BACKUP_ENCRYPTION_KEY_MISSING: "A backup was stopped: the encryption key is missing",
  BACKUP_SOURCE_UNAVAILABLE: "A backup failed: the database could not be reached",
  BACKUP_VERIFY_FAILED: "A backup did not pass its integrity check",
  LEDGER_CHAIN_BROKEN: "The backup ledger has been changed",
  AGENT_RESTARTED: "The agent stopped while a backup was running",
  NOT_VERIFIED: "Backups without a passing integrity check",
};

export const toAlerts = (overview: BackupOverview): Alert[] => {
  const alerts: Alert[] = overview.openAlerts.map((alert) => ({
    id: alert.id,
    code: alert.code,
    severity: alert.severity === "CRITICAL" || alert.severity === "HIGH" ? "error" : "warning",
    title: ALERT_TITLE[alert.code] ?? statusLabel(alert.code),
    description: alert.detail ?? "No detail recorded.",
    ref: alert.ref,
    at: alert.at,
  }));
  if (!overview.ledger.ok) {
    alerts.unshift({
      id: "ledger",
      code: "LEDGER_CHAIN_BROKEN",
      severity: "error",
      title: ALERT_TITLE.LEDGER_CHAIN_BROKEN,
      description: overview.ledger.reason ?? "The history of backups no longer matches itself. Treat every backup made since as unproven and tell QA.",
    });
  }
  if (overview.notVerified > 0) {
    alerts.push({
      id: "not-verified",
      code: "NOT_VERIFIED",
      severity: "warning",
      title: `${overview.notVerified} backup${overview.notVerified === 1 ? " has" : "s have"} no passing integrity check`,
      description: "A backup that has not passed its check cannot be relied on for a restore.",
    });
  }
  return alerts;
};

/** Groups by kind of problem, errors before warnings, and inside a group the newest first. */
export const groupAlerts = (alerts: Alert[]): AlertGroup[] => {
  const groups = new Map<string, AlertGroup>();
  for (const alert of alerts) {
    const key = `${alert.severity}:${alert.code}`;
    const group = groups.get(key) ?? { key, severity: alert.severity, title: alert.title, items: [] };
    group.items.push(alert);
    groups.set(key, group);
  }
  const newest = (group: AlertGroup) => group.items.reduce((max, item) => Math.max(max, item.at ? Date.parse(item.at) : 0), 0);
  // A tampered ledger is more serious than any failed backup: it casts doubt on every backup made since.
  const rank = (group: AlertGroup) => (group.key === "error:LEDGER_CHAIN_BROKEN" ? 0 : 1);
  return [...groups.values()]
    .map((group) => ({ ...group, items: [...group.items].sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? "") || 0) }))
    .sort((a, b) => (a.severity === b.severity ? rank(a) - rank(b) || newest(b) - newest(a) : a.severity === "error" ? -1 : 1));
};

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
    <Card aria-label="Needs attention" role="region">
      <CardHeader
        title="Needs attention"
        subtitle={alerts.length === 0 ? "Every backup control is within its target" : `${errors} need action · ${warnings} to review · ${groups.length} kind${groups.length === 1 ? "" : "s"} of problem`}
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
            <p className="text-sm text-slate-700">No failed backup, unverified backup or broken ledger.</p>
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
                  {showAll ? "Show fewer" : `Show ${hidden} more kind${hidden === 1 ? "" : "s"} of problem`}
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

/** The last 30 days, one column per day. Shows a failed load as a failure, never as zeros. */
const DailyChart: React.FC<{ points: BackupDailyPoint[] | null; failed: boolean }> = ({ points, failed }) => {
  const rows = useMemo(() => (points ? toRows(points) : []), [points]);
  const dailyConfig = useMemo(() => dailyChartConfiguration(rows), [rows]);
  const runs = rows.reduce((sum, row) => sum + row.total, 0);
  return (
    <Card aria-label="Last 30 days" role="region">
      <CardHeader
        title="Last 30 days"
        subtitle="Backup runs per day, by result"
        badge={points && !failed ? <Badge color="slate" size="sm">{runs} runs</Badge> : undefined}
      />
      <div className="px-4 pb-4 pt-3">
        {failed ? (
          <WarningBanner variant="error" title="Could not load the 30-day history." description="No chart is drawn rather than one built on guessed numbers." />
        ) : !points ? (
          <div className="h-64 animate-pulse rounded-lg bg-slate-50" aria-hidden="true" />
        ) : (
          <>
            <div className="h-64 w-full">
              <ChartCanvas config={dailyConfig} ariaLabel="Backup runs per day for the last 30 days, by result" />
            </div>
            <ul className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600" aria-label="Chart legend">
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

const RunningCard: React.FC<{ running: number }> = ({ running }) => (
  <Card aria-label="Running now" role="region">
    <CardHeader
      title="Running now"
      subtitle="Backups in progress on the Backup Agent"
      badge={<Badge color={running > 0 ? "blue" : "sky"} size="sm">{running > 0 ? "In progress" : "Idle"}</Badge>}
    />
    <p className="px-4 pb-4 pt-2 text-sm text-slate-700">
      {running === 0 ? "No backup is running." : `${running} backup${running === 1 ? " is" : "s are"} running.`}
    </p>
  </Card>
);

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
      showToast({ type: "success", title: "Check started", message: "The result appears here when it ends." });
      window.setTimeout(() => setReloadKey((k) => k + 1), 4000);
    } catch (e) {
      showToast({ type: "error", title: "The check was not started", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setStarting(false);
    }
  };

  const differences = run ? run.differentFiles + run.missingFiles + run.referenceDifferences : 0;
  return (
    <Card aria-label="File store check" role="region">
      <CardHeader
        title="File store check"
        subtitle="Reads the stored files and compares them with the backup. Reports only; nothing is changed."
        badge={
          run ? (
            <Badge color={run.status === "RUNNING" ? "blue" : run.status === "FAILED" || differences > 0 ? "red" : "emerald"} size="sm">
              {run.status === "RUNNING" ? "Running" : run.status === "FAILED" ? "Failed" : differences > 0 ? "Differences found" : "No differences"}
            </Badge>
          ) : undefined
        }
      />
      {failed ? (
        <p className="px-4 pb-4 pt-2 text-sm text-slate-600">The result could not be read.</p>
      ) : run === undefined ? (
        <p className="px-4 pb-4 pt-2 text-sm text-slate-500">Reading…</p>
      ) : run === null ? (
        <p className="px-4 pb-4 pt-2 text-sm text-slate-600">No check has run yet. One runs every Sunday at 03:30.</p>
      ) : (
        <dl className="divide-y divide-slate-100 px-4 pb-3 pt-2 text-sm">
          <Fact label="Last check">{formatDateTime(run.finishedAt ?? run.startedAt)}</Fact>
          <Fact label="Started by">{run.trigger === "SCHEDULED" ? "The weekly schedule" : run.requestedBy}</Fact>
          <Fact label="Files read">
            <span className="tabular-nums">{run.checkedFiles}</span>
          </Fact>
          <Fact label="Differ from the backup">
            <span className="tabular-nums">{run.differentFiles}</span>
          </Fact>
          <Fact label="Missing from the store">
            <span className="tabular-nums">{run.missingFiles}</span>
          </Fact>
          <Fact label="Checksum recorded at signing differs">
            <span className="tabular-nums">{run.referenceDifferences}</span>
          </Fact>
        </dl>
      )}
      {canStart && (
        <div className="px-4 pb-4">
          <Button size="sm" variant="outline-emerald" disabled={starting || run?.status === "RUNNING"} onClick={() => void start()}>
            Check Now
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

  if (hidden || !status) return null;
  const tone = status.state === "ON_TIME" ? "emerald" : status.state === "NOT_DECLARED" ? "slate" : status.state === "OVERDUE" ? "red" : "amber";
  const label = { ON_TIME: "On time", OVERDUE: "Overdue", NEVER_RECORDED: "None recorded", NOT_DECLARED: "Not in the policy" }[status.state];
  return (
    <Card aria-label="Manual copy" role="region">
      <CardHeader title="Manual copy" subtitle="The copy a person makes by hand. The system cannot see it, so it is recorded." badge={<Badge color={tone} size="sm">{label}</Badge>} />
      <dl className="divide-y divide-slate-100 px-4 pb-3 pt-2 text-sm">
        <Fact label="Last copy">{status.lastCopiedOn ? formatDateTime(status.lastCopiedOn) : "—"}</Fact>
        <Fact label="Next one due">{status.nextDueOn ? formatDateTime(status.nextDueOn) : "—"}</Fact>
      </dl>
    </Card>
  );
};

export const BackupOverviewView: React.FC = () => {
  const [overview, setOverview] = useState<BackupOverview>();
  const [daily, setDaily] = useState<BackupDailyPoint[] | null>(null);
  const [dailyFailed, setDailyFailed] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const mounted = useRef(false);

  // Each request fails on its own: a broken chart does not hide the status, and a failed refresh keeps the last values on screen.
  const load = useCallback(() => {
    backupRestoreApi
      .overview()
      .then((data) => {
        if (!mounted.current) return;
        setOverview(data);
        setError("");
        setUpdatedAt(new Date());
      })
      .catch((e) => {
        if (mounted.current) setError(getApiErrorMessage(e, "Unable to read the backup status."));
      });
    backupRestoreApi
      .overviewDaily(DAYS)
      .then((points) => {
        if (!mounted.current) return;
        setDaily(points);
        setDailyFailed(false);
      })
      .catch(() => {
        if (mounted.current) setDailyFailed(true);
      });
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = window.setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [load]);

  const alerts = useMemo(() => (overview ? toAlerts(overview) : []), [overview]);

  if (error && !overview) {
    return (
      <BackupRestorePage title="Backup Status Overview" preview={false}>
        <WarningBanner variant="error" title="Unable to read the backup status" description={error} />
      </BackupRestorePage>
    );
  }
  if (!overview) {
    return (
      <BackupRestorePage title="Backup Status Overview" preview={false}>
        <p className="text-sm text-slate-500">Reading the backup status…</p>
      </BackupRestorePage>
    );
  }

  const last = overview.lastCompleted;
  const cells: KpiCellData[] = [
    {
      title: "Last successful backup",
      accent: last ? OK : BAD,
      value: last ? formatDateTime(last.finishedAt) : "None yet",
      footValue: last ? formatBytes(last.sizeBytes) : "—",
      footLabel: last ? `backup ${last.backupNumber}` : "no backup has completed",
    },
    {
      title: "Completed backups",
      accent: OK,
      value: overview.completed,
      footValue: overview.running,
      footLabel: "running now",
    },
    {
      title: "Failed backups",
      accent: overview.failed > 0 ? BAD : OK,
      value: overview.failed,
      footValue: overview.openAlerts.length,
      footLabel: "open alerts",
    },
    {
      title: "Without a passing check",
      accent: overview.notVerified > 0 ? WARN : OK,
      value: overview.notVerified,
      footValue: overview.environment,
      footLabel: "environment",
    },
  ];

  return (
    <BackupRestorePage title="Backup Status Overview" preview={false}>
      <p className="text-xs text-slate-500">
        Refreshes every 30 seconds{updatedAt ? ` · updated ${displayTime(updatedAt)}` : ""}
      </p>
      {error && <WarningBanner variant="warning" title="Showing the last values read" description={error} />}

      <KpiStrip cells={cells} label="Backup protection" />

      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <DailyChart points={daily} failed={dailyFailed} />
        </div>

        <div className="min-w-0 space-y-4 md:space-y-6">
          <RunningCard running={overview.running} />

          <Card aria-label="Backup ledger" role="region">
            <CardHeader
              title="Backup ledger"
              subtitle="Tamper-evident history, kept outside the eQMS database."
              badge={
                <Badge color={overview.ledger.ok ? "emerald" : "red"} size="sm">
                  {overview.ledger.ok ? "Intact" : "Broken"}
                </Badge>
              }
            />
            <dl className="divide-y divide-slate-100 px-4 pb-3 pt-2 text-sm">
              <Fact label="Events checked">
                <span className="tabular-nums">{overview.ledger.checked}</span>
              </Fact>
              <Fact label="Compared with the copy outside the database">{overview.ledger.fileCopyCompared ? "Yes" : "No copy found"}</Fact>
            </dl>
          </Card>
        </div>

        <div className="min-w-0 xl:col-span-2">
          <AttentionCard alerts={alerts} />
        </div>

        <div className="min-w-0 space-y-4 md:space-y-6">
          <StoreScrubCard />
          <ManualCopyCard />
        </div>
      </div>
    </BackupRestorePage>
  );
};
