import { navigateBack } from "@/app/navigation/backNavigation";
import { useViewState } from "@/hooks/useViewState";
import { useEffect, useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import { IconDownload, IconEye, IconLock, IconShieldCheck, IconStackCheck } from "@tabler/icons-react";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { ReportArtifactPreview } from "./ReportArtifactPreview";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { TrainingFileDropzone } from "@/features/training-activities/shared/TrainingFileDropzone";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { ReadonlyField } from "../shared/ReadonlyField";
import {
  codeLabel,
  reportRevisionLabel,
  runStatusLabel,
} from "../shared/reportLabels";
import {
  reportsApi,
  type ReportFileVerification,
  type ReportArtifactSummary,
  type ReportRunDetail,
} from "@/services/api/reports";
import { reportError } from "@/services/api/reportTemplates";
import { displayDateTime, formatFileSize } from "@/utils/format";
import { tr, trFormat, getCatalogLanguage } from "@/i18n";

const APPROVAL_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  PENDING_APPROVAL: "Pending Approval",
  DRAFT: "Draft",
};

const when = (value?: string | null) => (value ? displayDateTime(value) : "—");
/** The full view of one report run (REPORT-RUN-DETAIL-2026-10-14): replaces the side drawer. Every field the server returns is shown. */
export function ReportRunDetailPage() {
  const { runId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canHold = hasPermission("reports.retention.manage");
  const [run, setRun] = useState<ReportRunDetail>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [previewing, setPreviewing] = useState<ReportArtifactSummary | null>(null);
  const [hold, setHold] = useState<{
    artifactId: string;
    legalHold: boolean;
    reason: string;
    step: "form" | "sign";
  }>();
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useViewState("ReportRunDetailPage.activeTab", "general");
  /** The check of a file a person holds against the stored one (REPORT-FILE-VERIFY-2026-11-16). */
  const [verifying, setVerifying] = useState<ReportArtifactSummary | null>(null);
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyResult, setVerifyResult] = useState<ReportFileVerification | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyPercent, setVerifyPercent] = useState(0);
  const closeVerify = () => {
    setVerifying(null);
    setVerifyFile(null);
    setVerifyResult(null);
    setVerifyError("");
    setVerifyPercent(0);
  };
  const checkFile = async () => {
    if (!verifying || !verifyFile) return;
    setVerifyBusy(true);
    setVerifyError("");
    setVerifyResult(null);
    setVerifyPercent(0);
    try {
      setVerifyResult(await reportsApi.verifyArtifactFile(runId, verifying.id, verifyFile, setVerifyPercent));
    } catch (e) {
      // A file that expired or was removed answers 409 in the server; the general text of reportError for 409 is about templates.
      const status = (e as { response?: { status?: number } })?.response?.status;
      setVerifyError(status === 409 ? tr("The stored file was removed after it expired, so it can no longer be checked.") : reportError(e));
    } finally {
      setVerifyBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setError("");
    reportsApi
      .getRun(runId)
      .then((value) => alive && setRun(value))
      .catch((e) => alive && setError(reportError(e)));
    return () => {
      alive = false;
    };
  }, [runId, refresh]);

  const download = async (artifact: ReportArtifactSummary) => {
    try {
      const blob = await reportsApi.downloadArtifact(runId, artifact.id);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = artifact.generatedFilename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      setError(reportError(e));
    }
  };

  // The link of the "report ready" notice (?download=1) downloads the file at once, after sign-in; the person is not asked to find the button (REPORT-READY-FILE-2026-11-16).
  // It runs once, and only when the report is complete; the address is cleaned so that a reload does not download it again.
  useEffect(() => {
    if (searchParams.get("download") !== "1" || !run) return;
    const next = new URLSearchParams(searchParams);
    next.delete("download");
    setSearchParams(next, { replace: true });
    const file = run.status === "COMPLETED" ? run.artifacts.find((artifact) => !artifact.purgedAt) : undefined;
    if (file) void download(file);
    else showToast({ type: "error", title: tr("The file cannot be downloaded"), message: run.status === "COMPLETED" ? tr("The file was removed after it expired.") : "The report is not complete yet: " + runStatusLabel(run.status) + ". Download it from this page when it is ready." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, searchParams]);

  /** Places or releases the hold chosen in the dialog. A release carries the e-signature token from the signing step. */
  const saveHold = async (signatureToken?: string) => {
    if (!hold) return;
    setBusy(true);
    try {
      await reportsApi.setLegalHold(
        runId,
        hold.artifactId,
        hold.legalHold,
        hold.reason.trim(),
        signatureToken,
      );
      showToast({
        type: "success",
        title: hold.legalHold ? tr("Legal hold placed") : tr("Legal hold released"),
        message:
          run?.artifacts.find((file) => file.id === hold.artifactId)
            ?.generatedFilename ?? "",
      });
      setHold(undefined);
      setRefresh((n) => n + 1);
    } catch (e) {
      showToast({
        type: "error",
        title: tr("The legal hold was not changed"),
        message: reportError(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const title = "Report Run Details";
  const selectedFields = Array.isArray(run?.selectedFields)
    ? run.selectedFields
    : [];
  const sortSpec = Array.isArray(run?.sortSpec) ? run.sortSpec : [];
  const template = run?.templateAtRun;
  const artifactColumns: DataTableColumn<ReportArtifactSummary>[] = [
    { id: "format", header: tr("Output Format"), cell: (row) => row.format },
    {
      id: "name",
      header: "File name",
      cell: (row) => (
        <span className="break-all text-xs">{row.generatedFilename}</span>
      ),
    },
    {
      id: "size",
      header: "File Size",
      cell: (row) => formatFileSize(row.byteSize),
    },
    {
      id: "sha",
      header: "SHA-256",
      cell: (row) => (
        <span className="break-all font-mono text-xs">{row.sha256}</span>
      ),
    },
    { id: "created", header: "Created", cell: (row) => when(row.createdAt) },
    {
      id: "retention",
      header: "Retention",
      cell: (row) =>
        row.purgedAt
          ? tr("Removed after expiry")
          : row.legalHold
            ? tr("Legal hold: kept until released")
            : tr("Kept permanently"),
    },
  ];
  // The last column is the fixed Action column of the table (it stays in view while the others scroll); its items are in the menu of the three dots, as in every table.
  const fileMenu = usePortalDropdown();
  const menuFile = run?.artifacts.find((artifact) => artifact.id === fileMenu.openId);
  const artifactAction: DataTableAction<ReportArtifactSummary> = {
    header: "Action",
    cell: (row) => {
      const ready = run?.status === "COMPLETED" && !row.purgedAt;
      if (!ready && !(canHold && !row.purgedAt)) return null;
      return (
        <button
          type="button"
          ref={fileMenu.getRef(row.id)}
          aria-label={tr("More actions")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
          onClick={(event) => fileMenu.toggle(row.id, event)}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      );
    },
  };
  const deliveryColumns: DataTableColumn<
    NonNullable<ReportRunDetail["deliveries"]>[number]
  >[] = [
    { id: "at", header: "When", cell: (row) => when(row.createdAt) },
    {
      id: "recipient",
      header: "Recipient",
      cell: (row) => row.recipientName ?? "—",
    },
    {
      id: "channel",
      header: "Channel",
      cell: (row) => (row.channel === "EMAIL" ? "E-mail" : "In app"),
    },
    { id: "event", header: "Notice", cell: (row) => codeLabel(row.eventCode) },
    { id: "status", header: "Result", cell: (row) => codeLabel(row.status) },
    {
      id: "reason",
      header: "Reason",
      cell: (row) => codeLabel(row.reasonCode),
    },
  ];
  // The same tab layout as the Report Template Details and the Document details.
  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "general", label: tr("General Information") },
      { id: "files", label: tr("Report Files"), count: run?.artifacts.length },
      { id: "audit", label: tr("Audit Trail") },
      { id: "notices", label: tr("Notices Sent"), count: run?.deliveries?.length },
    ],
    [run, getCatalogLanguage()],
  );
  const shownTab = tabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "general";
  const retry = async () => {
    if (!run) return;
    try {
      await reportsApi.retryRun(run.id);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(reportError(e));
    }
  };
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, false, {
          label: tr("Report Run History"),
          onClick: () => navigate("/report/history"),
        })}
        actions={
          <>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => navigateBack(navigate, null, "/report/history")}
            >
              {tr("Back")}
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => setRefresh((n) => n + 1)}
            >
              {tr("Refresh")}
            </Button>
            {run && ["FAILED", "RETRY_SCHEDULED"].includes(run.status) && (
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={() => void retry()}
              >
                {tr("Retry generation")}
              </Button>
            )}
          </>
        }
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {!run ? (
        error ? null : (
          <SectionLoading text="Loading report run…" />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <TabNav
              tabs={tabs}
              activeTab={shownTab}
              onChange={setActiveTab}
              layoutId="report-run-detail-tab"
            />
            <div className="space-y-4 p-4 md:p-5">
              {shownTab === "general" && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <ReadonlyField label={tr("Run Number")} value={run.runLabel || "—"} />
                  <ReadonlyField label={tr("Queued At")} value={when(run.queuedAt)} />
                  <ReadonlyField label={tr("Started At")} value={when(run.startedAt)} />
                  <ReadonlyField
                    label={tr("Completed At")}
                    value={when(run.completedAt)}
                  />
                  <ReadonlyField label={tr("Data As Of")} value={when(run.asOfAt)} />
                  <ReadonlyField
                    label={tr("Generated Report Name")}
                    value={run.reportTitle ?? run.definitionCode}
                  />
                  <ReadonlyField
                    label={tr("Run Status")}
                    value={runStatusLabel(run.status)}
                  />
                  <ReadonlyField label={tr("Run Progress")} value={`${run.progress}%`} />
                  <ReadonlyField
                    label={tr("Attempts")}
                    value={String(run.attemptCount)}
                  />
                  <ReadonlyField
                    label={tr("Request")}
                    value={
                      run.requestType === "SCHEDULED"
                        ? "Scheduled"
                        : "On Demand"
                    }
                  />
                  <ReadonlyField
                    label={tr("Schedule")}
                    value={run.scheduleId ? (run.scheduleName ?? "—") : "—"}
                  />
                  <ReadonlyField
                    label={tr("Requested By")}
                    value={run.requesterName ?? "—"}
                  />
                  <ReadonlyField
                    label={tr("Requested Output Format")}
                    value={run.requestedFormat}
                  />
                  <ReadonlyField
                    label={tr("Run Type")}
                    value={run.fullRun ? tr("Full (no filter)") : "Filtered"}
                  />
                  <ReadonlyField
                    label={tr("Failure Reason")}
                    value={codeLabel(run.reasonCode)}
                  />
                  {run.signature && (
                    <>
                      <ReadonlyField label={tr("Signed By")} value={run.signature.signedBy} />
                      <ReadonlyField label={tr("Signed On")} value={when(run.signature.signedAt)} />
                      <div className="md:col-span-2">
                        <ReadonlyField label={tr("Reason For Signing")} value={run.signature.reason ?? "—"} />
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <ReadonlyField
                      label={tr("Message")}
                      value={run.errorMessage ?? "—"}
                    />
                  </div>
                  <ReadonlyField
                    label={tr("Report Template Name")}
                    value={template?.displayName ?? run.definitionCode}
                  />
                  <ReadonlyField
                    label={tr("Report Template Number")}
                    value={run.definitionCode}
                  />
                  <ReadonlyField
                    label={tr("Report Template Revision")}
                    value={reportRevisionLabel(run.revision)}
                  />
                  <ReadonlyField
                    label={tr("Approval At Run Time")}
                    value={
                      template?.approvalStatus
                        ? (APPROVAL_LABEL[template.approvalStatus] ??
                          template.approvalStatus)
                        : tr("Not recorded")
                    }
                  />
                  <ReadonlyField
                    label={tr("Approved Version")}
                    value={
                      template?.approvedVersion != null
                        ? `v${template.approvedVersion}`
                        : "—"
                    }
                  />
                  <ReadonlyField
                    label={tr("Approved On")}
                    value={when(template?.approvedAt)}
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-slate-700 sm:text-sm">
                      {tr("Used For GMP Decisions?")}
                    </label>
                    <Checkbox
                      id="gmpUse"
                      checked={Boolean(template?.gmpUse)}
                      disabled
                      aria-label={tr("Used for GMP decisions")}
                    />
                  </div>
                  <ReadonlyField
                    label={tr("Name Rule")}
                    value={
                      template?.nameFormatId
                        ? "Applied"
                        : tr("No rule (typed name)")
                    }
                  />
                  <ReadonlyField
                    label={tr("Sort")}
                    value={
                      sortSpec.length
                        ? sortSpec
                            .map((s) => `${s.field} ${s.direction}`)
                            .join(", ")
                        : "Default"
                    }
                  />
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label
                      htmlFor="report-run-fields"
                      className="text-xs font-medium text-slate-700 sm:text-sm"
                    >
                      {tr("Fields")}
                    </label>
                    <textarea
                      id="report-run-fields"
                      value={selectedFields.join(", ") || "—"}
                      rows={2}
                      readOnly
                      className={CONTROL_STATE_CLASSES.readonlyTextarea}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label
                      htmlFor="report-run-filters"
                      className="text-xs font-medium text-slate-700 sm:text-sm"
                    >
                      {tr("Filters And Parameters")}
                    </label>
                    <textarea
                      id="report-run-filters"
                      value={run.filterSummary || "—"}
                      rows={3}
                      readOnly
                      className={CONTROL_STATE_CLASSES.readonlyTextarea}
                    />
                  </div>
                </div>
              )}
              {shownTab === "files" && (
                <>
                  {run.artifacts.some((file) => file.format !== "PDF") && (
                    <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 md:text-sm">
                      {tr("A CSV or XLSX file is a data copy for analysis. It can be edited after it is downloaded, so it is not the controlled report: the controlled report is the file stored here. To check that a file you hold is the one EQMS produced, use Verify File in the Action menu.")}
                    </p>
                  )}
                  <DataTable
                    rows={run.artifacts}
                    getRowKey={(row) => row.id}
                    columns={artifactColumns}
                    action={artifactAction}
                  />
                  <PortalDropdownMenu isOpen={!!menuFile} onClose={fileMenu.close} position={fileMenu.position} minWidth={220}>
                    {menuFile && (
                      <div className="py-1">
                        {run?.status === "COMPLETED" && !menuFile.purgedAt && (
                          <DropdownMenuItem icon={<IconDownload className="h-4 w-4" />} onClick={() => { void download(menuFile); fileMenu.close(); }}>
                            {tr("Download")}
                          </DropdownMenuItem>
                        )}
                        {run?.status === "COMPLETED" && !menuFile.purgedAt && (
                          <DropdownMenuItem icon={<IconEye className="h-4 w-4" />} onClick={() => { setPreviewing(menuFile); fileMenu.close(); }}>
                            {tr("Preview")}
                          </DropdownMenuItem>
                        )}
                        {run?.status === "COMPLETED" && !menuFile.purgedAt && (
                          <DropdownMenuItem icon={<IconStackCheck  className="h-4 w-4" />} onClick={() => { setVerifying(menuFile); fileMenu.close(); }}>
                            {tr("Verify File")}
                          </DropdownMenuItem>
                        )}
                        {canHold && !menuFile.purgedAt && (
                          <DropdownMenuItem
                            icon={<IconLock className="h-4 w-4" />}
                            onClick={() => {
                              setHold({ artifactId: menuFile.id, legalHold: !menuFile.legalHold, reason: "", step: "form" });
                              fileMenu.close();
                            }}
                          >
                            {menuFile.legalHold ? tr("Release Legal Hold") : tr("Place Legal Hold")}
                          </DropdownMenuItem>
                        )}
                      </div>
                    )}
                  </PortalDropdownMenu>
                  {previewing && (
                    <ReportArtifactPreview runId={runId} artifactId={previewing.id} format={previewing.format} title={previewing.generatedFilename} onClose={() => setPreviewing(null)} />
                  )}
                </>
              )}
              {shownTab === "audit" && (
                // The same Audit Trail tab as every other detail screen: the entries of this run and of its files (download, preview, verification, legal hold), and what the system did to the run.
                <AuditTrailTab entityId={runId} entityType="REPORT_RUN" includeChildren documentNumber={run.runLabel} />
              )}
              {shownTab === "notices" &&
                (run.deliveries == null ? (
                  <p className="text-sm text-slate-500">
                    {tr("Shown to people who manage scheduled reports.")}
                  </p>
                ) : (
                  <DataTable
                    rows={run.deliveries}
                    getRowKey={(row, index) => `${row.createdAt}-${index}`}
                    columns={deliveryColumns}
                  />
                ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => navigateBack(navigate, null, "/report/history")}
            >
              {tr("Back")}
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => setRefresh((n) => n + 1)}
            >
              {tr("Refresh")}
            </Button>
            {run.revision != null &&
              hasPermission("reports.definition.view") && (
                <Button
                  size="sm"
                  variant="outline-emerald"
                  onClick={() =>
                    navigate(
                      `/report/templates/${encodeURIComponent(run.definitionCode)}/revisions/${run.revision}`,
                    )
                  }
                >
                  {tr("View Template Revision")}
                </Button>
              )}
            {["FAILED", "RETRY_SCHEDULED"].includes(run.status) && (
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={() => void retry()}
              >
                {tr("Retry Generation")}
              </Button>
            )}
          </div>
        </>
      )}

      <FormModal
        isOpen={!!verifying}
        onClose={closeVerify}
        title={tr("Verify File")}
        description={`Choose the copy of ${verifying?.generatedFilename ?? "the file"} that you hold. It is read here to calculate its SHA-256 and is not kept. The result is recorded in the Audit Trail.`}
        confirmText={tr("Check File")}
        confirmDisabled={!verifyFile}
        isLoading={verifyBusy}
        onConfirm={() => void checkFile()}
      >
        <TrainingFileDropzone
          label={tr("File to check")}
          accept=".csv,.xlsx,.pdf"
          hint={tr("CSV, XLSX or PDF file (max 50 MB)")}
          maxMb={50}
          required
          file={verifyFile}
          uploading={verifyBusy ? { percent: verifyPercent } : undefined}
          onChange={(file) => {
            setVerifyFile(file);
            setVerifyResult(null);
            setVerifyError("");
          }}
        />
        {verifyError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{verifyError}</p>}
        {verifyResult && (
          <div role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${verifyResult.match ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            <p className="font-medium">
              {verifyResult.match
                ? tr("This file is exactly the file EQMS stored for this run.")
                : tr("This file is NOT the file EQMS stored for this run. It has been changed, or it is a different file.")}
            </p>
            <dl className="mt-2 space-y-1 break-all text-xs">
              <div><dt className="inline font-medium">{tr("Stored SHA-256:")} </dt><dd className="inline">{verifyResult.storedSha256}</dd></div>
              <div><dt className="inline font-medium">{tr("Your file SHA-256:")} </dt><dd className="inline">{verifyResult.uploadedSha256}</dd></div>
              <div><dt className="inline font-medium">{tr("Size:")} </dt><dd className="inline">{trFormat("stored {stored}, your file {yours}", { stored: formatFileSize(verifyResult.storedSize), yours: formatFileSize(verifyResult.uploadedSize) })}</dd></div>
            </dl>
          </div>
        )}
      </FormModal>
      <FormModal
        isOpen={hold?.step === "form"}
        onClose={() => setHold(undefined)}
        title={hold?.legalHold ? tr("Place legal hold") : tr("Release legal hold")}
        description={
          hold?.legalHold
            ? tr("The file is kept and cannot be removed while the hold is set. Say why.")
            : tr("Releasing a hold lets the file be removed. A person other than the one who placed the hold must release it, and the release is signed.")
        }
        confirmText={hold?.legalHold ? tr("Place hold") : tr("Continue to Sign")}
        confirmDisabled={!hold || !hold.reason.trim() || busy}
        onConfirm={() => {
          if (!hold) return;
          if (hold.legalHold) void saveHold();
          else setHold({ ...hold, step: "sign" });
        }}
      >
        <FormField label={tr("Reason")} required>
          <Textarea
            rows={3}
            maxLength={500}
            value={hold?.reason ?? ""}
            onChange={(event) =>
              setHold(
                (current) =>
                  current && { ...current, reason: event.target.value },
              )
            }
          />
        </FormField>
      </FormModal>
      <ESignatureModal
        isOpen={hold?.step === "sign"}
        onClose={() => setHold(undefined)}
        deferConfirm
        onConfirm={(data) => void saveHold(data.signatureToken)}
        actionTitle="Release Legal Hold"
        meaningDisplayName="Report Legal Hold Released"
        meaningCode="REPORT_LEGAL_HOLD_RELEASE"
      />
    </div>
  );
}
