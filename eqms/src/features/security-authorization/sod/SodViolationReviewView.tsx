import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, ChevronRight, History, RefreshCw, ScanSearch, ShieldAlert } from "lucide-react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { settingsApi } from "@/services/api";
import type { SodViolationResponse, SodViolationScanSummary } from "@/services/api/settings";
import { sodViolationReview as sodViolationReviewBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateTime } from "@/utils/format";
import { tr, trFormat } from "@/i18n";

type SeverityFilter = "ALL" | "BLOCK" | "WARN";

const personInitials = (name: string) =>
  name.split(/\s+/).filter((word) => /^\p{L}/u.test(word)).slice(-2).map((word) => word[0]).join("").toUpperCase();

/**
 * SoD Violation Review -- its own screen, sibling to Access Review under Security & Authorization.
 * A scan answers two questions: which rules are violated (a list, worst first as the server returns
 * them) and who is at fault (the detail of the rule on screen). The history of scans stays below as
 * the GxP self-inspection evidence, and opening a past scan swaps the list.
 */
export const SodViolationReviewView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canView = hasPermissionAlias("security.sod.view");

  const [violations, setViolations] = useState<SodViolationResponse[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const [history, setHistory] = useState<SodViolationScanSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunViolations, setSelectedRunViolations] = useState<SodViolationResponse[] | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);

  const loadHistory = useCallback(() => {
    if (!canView) {
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    settingsApi
      .listSodScanHistory({ page: historyPage, limit: historyLimit })
      .then((res) => {
        setHistory(res.data ?? []);
        setHistoryTotal(res.pagination?.total ?? 0);
        setHistoryTotalPages(Math.max(res.pagination?.totalPages ?? 1, 1));
      })
      .catch(() => showToast({ type: "error", message: "Failed to load scan history" }))
      .finally(() => setHistoryLoading(false));
  }, [canView, historyPage, historyLimit, showToast]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const scan = async () => {
    setScanning(true);
    try {
      const result = await settingsApi.recordSodScan();
      setViolations(result);
      setSelectedRunId(null);
      setSelectedRunViolations(null);
      setHistoryPage(1);
      loadHistory();
    } catch {
      showToast({ type: "error", message: "Scan failed" });
    } finally {
      setScanning(false);
    }
  };

  const viewRun = async (id: string) => {
    if (selectedRunId === id) {
      setSelectedRunId(null);
      setSelectedRunViolations(null);
      return;
    }
    setSelectedRunId(id);
    setLoadingRun(true);
    try {
      const detail = await settingsApi.getSodScanDetail(id);
      setSelectedRunViolations(detail.results);
    } catch {
      showToast({ type: "error", message: "Failed to load scan detail" });
      setSelectedRunId(null);
    } finally {
      setLoadingRun(false);
    }
  };

  const shown = selectedRunId ? selectedRunViolations : violations;
  const selectedRun = history.find((run) => run.id === selectedRunId);

  const summary = useMemo(() => {
    const list = shown ?? [];
    return {
      rules: list.length,
      block: list.filter((v) => v.severity === "BLOCK").length,
      warn: list.filter((v) => v.severity === "WARN").length,
    };
  }, [shown]);

  const filtered = useMemo(
    () => (shown ?? []).filter((v) => severityFilter === "ALL" || v.severity === severityFilter),
    [shown, severityFilter],
  );

  const ruleKey = (v: SodViolationResponse) => v.constraintId ?? `${v.permissionCodeA}-${v.permissionCodeB}`;
  const foundCount = (v: SodViolationResponse) => v.violatingAccessProfiles.length + v.violatingUserCombinations.length;
  const sevBadge = (v: SodViolationResponse) => (
    <Badge semantic={v.severity === "BLOCK" ? "danger" : "warning"} variant="solid" size="sm">{v.severity}</Badge>
  );

  const detailBody = (v: SodViolationResponse) => (
    <div className="space-y-4">
      <div className="space-y-1.5 text-xs">
        {([["A", v.permissionCodeA], ["B", v.permissionCodeB]] as const).map(([label, code]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-2xs font-semibold text-slate-500">{label}</span>
            <code className="min-w-0 flex-1 break-all rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">{code}</code>
          </div>
        ))}
        <p className="flex items-center gap-1.5 pl-7 text-2xs text-slate-400"><ArrowLeftRight className="h-3 w-3" />{tr("no one may hold both")}</p>
      </div>

      {v.violatingAccessProfiles.length > 0 && (
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
            {tr("Profile alone grants both sides — fix the profile")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {v.violatingAccessProfiles.map((profile) => (
              <Badge key={profile.accessProfileId} color="slate" variant="outline" size="sm">{profile.accessProfileName}</Badge>
            ))}
          </div>
        </div>
      )}

      {v.violatingUserCombinations.length > 0 && (
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
            {tr("No single profile is at fault — these people's combined profiles are")}
          </p>
          <ul className="mt-1">
            {v.violatingUserCombinations.map((combo) => (
              <li key={combo.userId} className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-slate-100 py-3 last:border-b-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {personInitials(combo.fullName ?? combo.username)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-slate-900">{combo.fullName ?? combo.username}</p>
                  <p className="text-xs text-slate-500">@{combo.username}</p>
                </div>
                <div className="flex w-full flex-col gap-1 text-xs text-slate-500 sm:w-auto sm:items-end">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {tr("A via")} {combo.profilesGrantingA.map((p) => (
                      <Badge key={p.accessProfileId} color="slate" variant="outline" size="xs">{p.accessProfileName}</Badge>
                    ))}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {tr("B via")} {combo.profilesGrantingB.map((p) => (
                      <Badge key={p.accessProfileId} color="slate" variant="outline" size="xs">{p.accessProfileName}</Badge>
                    ))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderViolation = (v: SodViolationResponse) => (
    <FormSection
      key={ruleKey(v)}
      title={v.constraintName}
      icon={<ShieldAlert className="h-4 w-4" />}
      description={v.regulationRef ?? undefined}
      headerRight={
        <>
          {sevBadge(v)}
          <Badge color="slate" size="sm">{foundCount(v)} {tr("found")}</Badge>
        </>
      }
      contentClassName="p-4 md:p-5"
    >
      {detailBody(v)}
    </FormSection>
  );

  const sevDot = (severity: string) => (
    <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", severity === "BLOCK" ? "bg-red-500" : "bg-amber-500")} />
  );

  const chip = (value: SeverityFilter, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setSeverityFilter(value)}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        severityFilter === value
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300",
      )}
    >
      {label}
    </button>
  );

  const stateBlock = (): React.ReactNode | null => {
    if (loadingRun || (scanning && shown === null)) {
      return <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5"><SectionLoading minHeight="180px" /></div>;
    }
    if (shown === null) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <TableEmptyState title={tr("No scan on screen")} description={tr("Click \"Scan Now\" to check every Access Profile and every active user, or open a past scan from the history.")} />
        </div>
      );
    }
    if (shown.length === 0) {
      return (
        <WarningBanner variant="success" title={tr("No violations found.")}>
          {tr("All Access Profiles comply with SoD constraints.")}
        </WarningBanner>
      );
    }
    return null;
  };

  const chips = (
    <div className="flex flex-wrap items-center gap-2">
      {chip("ALL", `All · ${summary.rules}`)}
      {chip("BLOCK", `BLOCK · ${summary.block}`)}
      {chip("WARN", `WARN · ${summary.warn}`)}
    </div>
  );
  const noneOfSeverity = <p className="py-6 text-center text-sm text-slate-400">{tr("No violation of this severity.")}</p>;

  const selectRule = (key: string) => {
    setActiveKey(key);
    // below the xl breakpoint the detail sits under the list: bring it into view
    if (window.innerWidth < 1280) window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const activeRule = filtered.find((v) => ruleKey(v) === activeKey) ?? filtered[0];
  const masterDetailView = (
    <div className="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <FormSection title={`Violated rules · ${filtered.length}`} icon={<ShieldAlert className="h-4 w-4" />} contentClassName="p-0">
        <div className="border-b border-slate-100 p-3">{chips}</div>
        {filtered.length === 0 ? <div className="p-4">{noneOfSeverity}</div> : (
          <ul>
            {filtered.map((v) => {
              const selected = activeRule && ruleKey(activeRule) === ruleKey(v);
              return (
                <li key={ruleKey(v)} className="border-b border-slate-100 last:border-b-0">
                  <button type="button" onClick={() => selectRule(ruleKey(v))} aria-current={selected ? "true" : undefined}
                    className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors", selected ? "border-l-2 border-l-emerald-600 bg-emerald-50" : "hover:bg-slate-50")}>
                    {sevDot(v.severity)}
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium text-slate-900">{v.constraintName}</span>
                      <span className="block text-xs text-slate-500">{trFormat("{profiles} profiles · {people} people", { profiles: v.violatingAccessProfiles.length, people: v.violatingUserCombinations.length })}</span>
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </FormSection>
      <div ref={detailRef} className="scroll-mt-4 xl:sticky xl:top-4">{activeRule ? renderViolation(activeRule) : null}</div>
    </div>
  );

  const resultsArea = () => stateBlock() ?? masterDetailView;

  const historyCard = (
    <FormSection
      title={tr("Scan History")}
      icon={<History className="h-4 w-4" />}
      description={tr("Each scan is kept as GxP self-inspection evidence.")}
      contentClassName="p-0"
    >
      {historyLoading ? (
        <SectionLoading minHeight="150px" />
      ) : history.length === 0 ? (
        <TableEmptyState title={tr("No scans yet")} description={tr("Run a scan to start building review history.")} />
      ) : (
        <>
          <ul>
            {history.map((run) => (
              <li key={run.id} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => viewRun(run.id)}
                  aria-current={selectedRunId === run.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors md:px-5",
                    selectedRunId === run.id ? "bg-emerald-50" : "hover:bg-slate-50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-900">{formatDateTime(run.scannedAt)}</span>
                    <span className="block truncate text-xs text-slate-500">{run.scannedByName ?? "-"}</span>
                  </span>
                  {run.violationCount === 0 ? (
                    <Badge semantic="success" size="sm">{tr("None")}</Badge>
                  ) : (
                    <Badge semantic="danger" size="sm">{run.violationCount} {tr("violation")}{run.violationCount === 1 ? "" : "s"}</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {historyTotal > 0 && (
            <div className="border-t border-slate-200">
              <TablePagination
                currentPage={historyPage}
                totalPages={historyTotalPages}
                totalItems={historyTotal}
                itemsPerPage={historyLimit}
                isLoading={historyLoading}
                onPageChange={setHistoryPage}
                onItemsPerPageChange={(v) => { setHistoryLimit(v); setHistoryPage(1); }}
                itemsPerPageOptions={[10, 20, 50]}
              />
            </div>
          )}
        </>
      )}
    </FormSection>
  );

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      <PageHeader
        title={tr("SoD Violation Review")}
        breadcrumbItems={sodViolationReviewBreadcrumb(navigate)}
        actions={
          canView ? (
            <>
              <Button variant="default" size="sm" className="whitespace-nowrap gap-2" onClick={scan} disabled={scanning}>
                {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {scanning ? "Scanning…" : "Scan Now"}
              </Button>
            </>
          ) : undefined
        }
      />

      {!canView ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <TableEmptyState title={tr("Permission denied")} description={tr("You do not have permission to view segregation-of-duties violations.")} />
        </div>
      ) : (
        <>
          {resultsArea()}
          {historyCard}
        </>
      )}
    </div>
  );
};
