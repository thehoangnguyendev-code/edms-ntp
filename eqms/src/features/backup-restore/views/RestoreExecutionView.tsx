import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarClock, Play, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { ROUTES } from "@/app/routes.constants";
import { usePermissions } from "@/hooks/usePermissions";
import { backupRestoreApi, type RestoreExecutionChecks } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { formatDateTime } from "../format";

const LABEL_CLASS = "block text-xs sm:text-sm font-medium text-slate-700 mb-1.5";
const INPUT_CLASS = "w-full h-9 px-3.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50";

/** A bordered block with an uppercase title, as on Document Properties. */
const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3.5">
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
    {children}
  </div>
);

/** The local time in the form a datetime-local input takes, for the minimum allowed window. */
const localInputValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * The console of one approved restore: the checks that must hold before a run, and the scheduling of a maintenance window. Scheduling
 * changes no data. Running the restore is not built yet, so the Execute control stays off.
 */
export const RestoreExecutionView: React.FC = () => {
  const { requestId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canExecute = hasPermission("backup.restore.execute");
  const detail = ROUTES.BACKUP_RESTORE.RESTORE_DETAIL(requestId);

  const [checks, setChecks] = useState<RestoreExecutionChecks>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [windowInput, setWindowInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [noUsers, setNoUsers] = useState(false);
  const [busyEnter, setBusyEnter] = useState(false);
  const [busyTest, setBusyTest] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    backupRestoreApi
      .restoreExecution(requestId)
      .then((next) => {
        if (live) setChecks(next);
      })
      .catch((e) => {
        if (live) setError(getApiErrorMessage(e, "Unable to open the execution console."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [requestId]);

  // While a test restore is waiting or running, read the console again so the outcome appears without a reload.
  const testStatus = checks?.testRestore?.status;
  useEffect(() => {
    if (testStatus !== "QUEUED" && testStatus !== "RUNNING") return;
    const timer = window.setInterval(() => {
      backupRestoreApi.restoreExecution(requestId).then(setChecks).catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [testStatus, requestId]);

  const startTest = async () => {
    setBusyTest(true);
    try {
      const out = await backupRestoreApi.startTestRestore(requestId);
      setChecks(await backupRestoreApi.restoreExecution(requestId));
      showToast({ type: "success", title: "Test restore queued", message: `${out.rehearsalId} is waiting for the restore worker.` });
    } catch (e) {
      showToast({ type: "error", title: "The test restore did not start", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusyTest(false);
    }
  };

  const enterWindow = async () => {
    setBusyEnter(true);
    try {
      const out = await backupRestoreApi.enterRestoreWindow(requestId, noUsers);
      setChecks(await backupRestoreApi.restoreExecution(requestId));
      showToast({ type: "success", title: "Restore window started", message: `${requestId}: the system is locked (${out.systemState}).` });
    } catch (e) {
      showToast({ type: "error", title: "The window was not started", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusyEnter(false);
    }
  };

  const schedule = async () => {
    const when = new Date(windowInput);
    if (Number.isNaN(when.getTime())) {
      showToast({ type: "error", title: "The window is not a valid time", message: "Choose a date and time." });
      return;
    }
    setBusy(true);
    try {
      const next = await backupRestoreApi.scheduleRestore(requestId, when.toISOString());
      setChecks(next);
      setWindowInput("");
      showToast({ type: "success", title: "Restore scheduled", message: `${requestId} for ${formatDateTime(when.toISOString())}.` });
    } catch (e) {
      showToast({ type: "error", title: "The restore was not scheduled", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const parent = { label: "Restore Request", path: detail };

  if (error) {
    return (
      <BackupRestorePage title="Restore Execution Console" group="Restore" parent={parent} preview={false}>
        <WarningBanner variant="error" title="Unable to open the console" description={error} />
      </BackupRestorePage>
    );
  }
  if (loading || !checks) {
    return (
      <BackupRestorePage title="Restore Execution Console" group="Restore" parent={parent} preview={false}>
        <SectionLoading minHeight="40vh" />
      </BackupRestorePage>
    );
  }

  const scheduled = checks.schedule;
  const canSchedule = canExecute && checks.readyToSchedule && !scheduled && checks.status === "APPROVED";
  const windowReached = !!scheduled && new Date(scheduled.windowStart).getTime() <= Date.now();
  const canEnter = canExecute && !!scheduled && windowReached;
  // Read from the server, so the console is right after a reload too.
  const lockedHere = checks.systemState === "LOCKED_RESTORING" && checks.systemRequestId === requestId;
  const test = checks.testRestore;
  const canTest = canExecute && lockedHere && !test;

  return (
    <BackupRestorePage
      title="Restore Execution Console"
      group="Restore"
      parent={parent}
      preview={false}
      actions={
        <Button variant="outline-emerald" size="sm" onClick={() => navigate(detail)}>
          Back
        </Button>
      }
    >
      <WarningBanner
        variant="info"
        description="Scheduling a window changes no data. Running the restore is not built yet, so the Execute control below stays off."
      />

      <FormSection title="Pre-checks" icon={<ShieldCheck className="h-4 w-4" />} description="Every check must pass before a window can be scheduled.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Group title="Checks">
            <ul className="divide-y divide-slate-200">
              {checks.checks.map((check) => (
                <li key={check.code} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-900">{check.code}</p>
                    <p className="text-xs text-slate-500">{check.detail}</p>
                  </div>
                  <Badge color={check.ok ? "emerald" : "red"}>{check.ok ? "Pass" : "Blocks"}</Badge>
                </li>
              ))}
            </ul>
          </Group>
          <Group title="Not checked yet">
            <ul className="list-disc space-y-2 pl-5 text-xs sm:text-sm text-slate-700">
              {checks.notCheckedYet.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Group>
        </div>
      </FormSection>

      <FormSection title="Maintenance Window" icon={<CalendarClock className="h-4 w-4" />} description="The window a restore is planned for. Its start must be later than now.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Group title="Scheduled">
            {scheduled ? (
              <dl className="divide-y divide-slate-200">
                {[
                  ["Window starts", formatDateTime(scheduled.windowStart)],
                  ["Scheduled by", scheduled.scheduledBy],
                  ["Scheduled at", formatDateTime(scheduled.scheduledAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
                    <dt className="w-40 shrink-0 text-xs sm:text-sm font-medium text-slate-700">{label}</dt>
                    <dd className="min-w-0 break-words text-xs sm:text-sm text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-slate-500">No window is scheduled for this request.</p>
            )}
          </Group>
          <Group title="Schedule a window">
            {scheduled ? (
              <p className="text-xs text-slate-500">A window is already scheduled. Another one cannot be added to this request.</p>
            ) : (
              <>
                <div>
                  <label htmlFor="restore-window" className={LABEL_CLASS}>
                    Window starts
                  </label>
                  <input
                    id="restore-window"
                    type="datetime-local"
                    min={localInputValue(new Date())}
                    value={windowInput}
                    disabled={!canExecute}
                    onChange={(event) => setWindowInput(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                {!canExecute && <p className="text-xs text-slate-500">Scheduling needs the execute permission.</p>}
                {canExecute && !checks.readyToSchedule && <p className="text-xs text-slate-500">A check above blocks scheduling.</p>}
                <Button size="sm" disabled={!canSchedule || !windowInput || busy} onClick={() => void schedule()}>
                  Schedule Window
                </Button>
              </>
            )}
          </Group>
        </div>
      </FormSection>

      <FormSection title="Restore Window" icon={<CalendarClock className="h-4 w-4" />} description="Starting the window locks the system for this restore. Everyone is signed out except the administrator.">
        <Group title="Enter the window">
          {!scheduled && <p className="text-xs text-slate-500">Schedule a window first.</p>}
          {scheduled && !windowReached && <p className="text-xs text-slate-500">The window has not started yet.</p>}
          {lockedHere && <p className="text-xs text-slate-700">The system is locked for this restore ({checks.systemState}).</p>}
          <Checkbox
            label="No user is still working. Everyone else has been signed out."
            checked={noUsers}
            onChange={setNoUsers}
            disabled={!canEnter || lockedHere}
          />
          <Button size="sm" disabled={!canEnter || !noUsers || lockedHere || busyEnter} onClick={() => void enterWindow()}>
            Enter Restore Window
          </Button>
        </Group>
      </FormSection>

      <FormSection title="Execution" icon={<Play className="h-4 w-4" />} description="Running the restore is the next step, not built yet.">
        <Group title="Test restore">
          {test ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={test.status === "PASSED" ? "emerald" : test.status === "FAILED" ? "red" : "amber"}>{test.status}</Badge>
                <span className="text-xs text-slate-700 break-all">
                  {test.rehearsalId}, requested by {test.requestedBy}
                </span>
              </div>
              {test.errorDetail && (
                <p className="text-xs text-red-700 break-words">
                  {test.errorCode}: {test.errorDetail}
                </p>
              )}
              {test.checks.length > 0 && (
                <ul className="divide-y divide-slate-200">
                  {test.checks.map((check) => (
                    <li key={check.code} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-slate-900">{check.code}</p>
                        <p className="text-xs text-slate-500 break-words">{check.title}</p>
                      </div>
                      <Badge color={check.ok ? "emerald" : "red"}>{check.ok ? "Pass" : "Fail"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">No test restore has been started in this window.</p>
          )}
          <p className="text-xs text-slate-500">
            The backup is restored into a scratch database and checked. Production data is not changed.
          </p>
          <Button size="sm" disabled={!canTest || busyTest} onClick={() => void startTest()}>
            Start Test Restore
          </Button>
        </Group>
        <Group title="Run">
          <p className="text-xs text-slate-500">
            The run enters the maintenance window, decrypts the backup with the key on the restore worker, restores it into a separate test
            database and runs the checks. Steps R5 to R12 are not built; this control stays off until they are.
          </p>
          <Button size="sm" disabled>
            Execute Restore
          </Button>
        </Group>
      </FormSection>
    </BackupRestorePage>
  );
};
