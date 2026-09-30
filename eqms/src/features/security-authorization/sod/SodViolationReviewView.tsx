import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
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
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

/**
 * SoD Violation Review -- its own screen, sibling to Access Review under Security &
 * Authorization, instead of a panel inside the Segregation of Duties constraints screen. Mirrors
 * how Access Review and Audit Trail Periodic Review each keep their own scan/review history for
 * GxP self-inspection evidence (per Veeva Vault QualityDocs' Periodic Review precedent: one
 * domain, one review screen with history, not a single catch-all module).
 */
export const SodViolationReviewView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canView = hasPermissionAlias("security.sod.view");

  const [violations, setViolations] = useState<SodViolationResponse[] | null>(null);
  const [scanning, setScanning] = useState(false);

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

  const renderViolationList = (list: SodViolationResponse[]) =>
    list.length === 0 ? (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-700">
        <ShieldOff className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium">No violations found — all Access Profiles comply with SoD constraints.</span>
      </div>
    ) : (
      <div className="space-y-3">
        {list.map((v) => (
          <div
            key={v.constraintId ?? `${v.permissionCodeA}-${v.permissionCodeB}`}
            className={cn("rounded-lg border p-4", v.severity === "BLOCK" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", v.severity === "BLOCK" ? "text-red-600" : "text-amber-600")} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-semibold", v.severity === "BLOCK" ? "text-red-800" : "text-amber-800")}>
                  {v.constraintName}
                  <Badge semantic={v.severity === "BLOCK" ? "danger" : "warning"} variant="solid" size="xs" className="ml-2 align-middle">
                    {v.severity}
                  </Badge>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{v.permissionCodeA} ⊕ {v.permissionCodeB}</p>
                {v.regulationRef && <p className="text-xs text-slate-500 mt-1">{v.regulationRef}</p>}

                {v.violatingAccessProfiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
                      Profile alone grants both sides — fix the profile:
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {v.violatingAccessProfiles.map((profile) => (
                        <Badge key={profile.accessProfileId} color="slate" variant="outline" size="xs">
                          {profile.accessProfileName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {v.violatingUserCombinations.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
                      No single profile is at fault — this person's combined profiles are:
                    </p>
                    {v.violatingUserCombinations.map((combo) => (
                      <div key={combo.userId} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-xs font-semibold text-slate-800">
                          {combo.fullName ?? combo.username}
                          <span className="ml-1.5 font-normal text-slate-400">@{combo.username}</span>
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-2xs">
                          <span className="text-slate-500">grants {v.permissionCodeA} via</span>
                          {combo.profilesGrantingA.map((p) => (
                            <Badge key={p.accessProfileId} color="slate" variant="outline" size="xs">{p.accessProfileName}</Badge>
                          ))}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-2xs">
                          <span className="text-slate-500">grants {v.permissionCodeB} via</span>
                          {combo.profilesGrantingB.map((p) => (
                            <Badge key={p.accessProfileId} color="slate" variant="outline" size="xs">{p.accessProfileName}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      <PageHeader
        title="SoD Violation Review"
        breadcrumbItems={sodViolationReviewBreadcrumb(navigate)}
        actions={
          canView ? (
            <Button variant="default" size="sm" className="whitespace-nowrap gap-2" onClick={scan} disabled={scanning}>
              <RefreshCw className={cn("h-4 w-4", scanning && "animate-spin")} />
              {scanning ? "Scanning…" : "Scan Now"}
            </Button>
          ) : undefined
        }
      />

      {!canView ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <TableEmptyState title="Permission denied" description="You do not have permission to view segregation-of-duties violations." />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden p-4 md:p-5">
            <p className="mb-4 text-xs text-slate-500">
              Checks every active Access Profile alone, and every active user's combined profiles, for SoD conflicts.
              Each scan is recorded below for GxP self-inspection evidence.
            </p>
            {violations === null ? (
              <p className="py-6 text-center text-sm text-slate-400">Click "Scan Now" to check for violations across all Access Profiles.</p>
            ) : (
              renderViolationList(violations)
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="px-4 md:px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Scan History</h3>
            </div>
            {historyLoading ? (
              <SectionLoading minHeight="150px" />
            ) : history.length === 0 ? (
              <TableEmptyState title="No scans yet" description="Run a scan to start building review history." />
            ) : (
              <div className="flex flex-col flex-1">
                <TableMarkup.Root className="w-full">
                  <TableMarkup.Head>
                    <TableMarkup.Row>
                      <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell1}>Scanned At</TableMarkup.HeaderCell>
                      <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell1}>Scanned By</TableMarkup.HeaderCell>
                      <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell1}>Result</TableMarkup.HeaderCell>
                      <TableMarkup.HeaderCell className="bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">Action</TableMarkup.HeaderCell>
                    </TableMarkup.Row>
                  </TableMarkup.Head>
                  <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                    {history.map((run) => (
                      <React.Fragment key={run.id}>
                        <TableMarkup.Row className="hover:bg-slate-50/80 transition-colors">
                          <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{formatDateTime(run.scannedAt)}</TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">{run.scannedByName ?? "-"}</TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            {run.violationCount === 0 ? (
                              <Badge semantic="success" size="sm">No violations</Badge>
                            ) : (
                              <Badge semantic="danger" size="sm">{run.violationCount} violation{run.violationCount === 1 ? "" : "s"}</Badge>
                            )}
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="py-3 px-4 text-center whitespace-nowrap">
                            <Button variant="outline" size="sm" onClick={() => viewRun(run.id)}>
                              {selectedRunId === run.id ? "Hide" : "View"}
                            </Button>
                          </TableMarkup.Cell>
                        </TableMarkup.Row>
                        {selectedRunId === run.id && (
                          <TableMarkup.Row>
                            <TableMarkup.Cell colSpan={4} className="bg-slate-50 p-4">
                              {loadingRun ? <SectionLoading minHeight="80px" /> : renderViolationList(selectedRunViolations ?? [])}
                            </TableMarkup.Cell>
                          </TableMarkup.Row>
                        )}
                      </React.Fragment>
                    ))}
                  </TableMarkup.Body>
                </TableMarkup.Root>
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
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
