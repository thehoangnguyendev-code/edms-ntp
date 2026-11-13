import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
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
  type ReportArtifactSummary,
  type ReportRunDetail,
} from "@/services/api/reports";
import { reportError } from "@/services/api/reportTemplates";
import { displayDateTime } from "@/utils/format";

const APPROVAL_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  PENDING_APPROVAL: "Pending Approval",
  DRAFT: "Draft",
};

const when = (value?: string | null) => (value ? displayDateTime(value) : "—");
/**
 * JSON for a person to read: a date or a moment inside it is written in the display format of the system (dd/MM/yyyy, dd/MM/yyyy HH:mm:ss, UTC+7), never as ISO.
 * (REPORT-TIME-FORMAT-2026-11-12)
 */
const readableJson = (value: unknown, indent?: number) =>
  JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item !== "string") return item;
      const day = item.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (day) return `${day[3]}/${day[2]}/${day[1]}`;
      return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(item) ? displayDateTime(item) : item;
    },
    indent,
  );

/** The full view of one report run (REPORT-RUN-DETAIL-2026-10-14): replaces the side drawer. Every field the server returns is shown. */
export function ReportRunDetailPage() {
  const { runId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canHold = hasPermission("reports.retention.manage");
  const [run, setRun] = useState<ReportRunDetail>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [hold, setHold] = useState<{
    artifactId: string;
    legalHold: boolean;
    reason: string;
    step: "form" | "sign";
  }>();
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

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

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

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

  const preview = async (artifact: ReportArtifactSummary) => {
    setPreviewBusy(true);
    setError("");
    try {
      const blob = await reportsApi.downloadArtifact(runId, artifact.id);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(reportError(e));
    } finally {
      setPreviewBusy(false);
    }
  };

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
        title: hold.legalHold ? "Legal hold placed" : "Legal hold released",
        message:
          run?.artifacts.find((file) => file.id === hold.artifactId)
            ?.generatedFilename ?? "",
      });
      setHold(undefined);
      setRefresh((n) => n + 1);
    } catch (e) {
      showToast({
        type: "error",
        title: "The legal hold was not changed",
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
    { id: "format", header: "Format", cell: (row) => row.format },
    {
      id: "name",
      header: "File name",
      cell: (row) => (
        <span className="break-all text-xs">{row.generatedFilename}</span>
      ),
    },
    {
      id: "size",
      header: "Size",
      cell: (row) => `${row.byteSize.toLocaleString()} bytes`,
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
          ? "Removed after expiry"
          : row.legalHold
            ? "Legal hold: kept until released"
            : "Kept permanently",
    },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          {run?.status === "COMPLETED" && !row.purgedAt && (
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => void download(row)}
            >
              Download
            </Button>
          )}
          {run?.status === "COMPLETED" &&
            !row.purgedAt &&
            row.format === "PDF" && (
              <Button
                size="sm"
                variant="outline-emerald"
                loading={previewBusy}
                onClick={() => void preview(row)}
              >
                Preview
              </Button>
            )}
          {canHold && !row.purgedAt && (
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() =>
                setHold({
                  artifactId: row.id,
                  legalHold: !row.legalHold,
                  reason: "",
                  step: "form",
                })
              }
            >
              {row.legalHold ? "Release legal hold" : "Place legal hold"}
            </Button>
          )}
        </div>
      ),
    },
  ];
  const eventColumns: DataTableColumn<ReportRunDetail["events"][number]>[] = [
    { id: "at", header: "When", cell: (row) => when(row.createdAt) },
    { id: "event", header: "Event", cell: (row) => codeLabel(row.eventType) },
    {
      id: "reason",
      header: "Reason",
      cell: (row) => codeLabel(row.reasonCode),
    },
    {
      id: "detail",
      header: "Details",
      cell: (row) => (
        <pre className="whitespace-pre-wrap break-all text-xs">
          {Object.keys(row.detail ?? {}).length
            ? readableJson(row.detail)
            : "—"}
        </pre>
      ),
    },
  ];
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
      { id: "general", label: "General Information" },
      { id: "files", label: "Report Files", count: run?.artifacts.length },
      { id: "timeline", label: "Timeline", count: run?.events.length },
      { id: "notices", label: "Notices Sent", count: run?.deliveries?.length },
    ],
    [run],
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
          label: "Report Run History",
          onClick: () => navigate("/report/history"),
        })}
        actions={
          <>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => navigate("/report/history")}
            >
              Back
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Refresh
            </Button>
            {run && ["FAILED", "RETRY_SCHEDULED"].includes(run.status) && (
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={() => void retry()}
              >
                Retry generation
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
                  <ReadonlyField label="Queued" value={when(run.queuedAt)} />
                  <ReadonlyField label="Started" value={when(run.startedAt)} />
                  <ReadonlyField
                    label="Completed"
                    value={when(run.completedAt)}
                  />
                  <ReadonlyField label="Data As Of" value={when(run.asOfAt)} />
                  <ReadonlyField
                    label="Report Name"
                    value={run.reportTitle ?? run.definitionCode}
                  />
                  <ReadonlyField
                    label="Status"
                    value={runStatusLabel(run.status)}
                  />
                  <ReadonlyField label="Progress" value={`${run.progress}%`} />
                  <ReadonlyField
                    label="Attempts"
                    value={String(run.attemptCount)}
                  />
                  <ReadonlyField
                    label="Request"
                    value={
                      run.requestType === "SCHEDULED"
                        ? "Scheduled"
                        : "On Demand"
                    }
                  />
                  <ReadonlyField
                    label="Schedule"
                    value={run.scheduleId ? (run.scheduleName ?? "—") : "—"}
                  />
                  <ReadonlyField
                    label="Requested By"
                    value={run.requesterName ?? "—"}
                  />
                  <ReadonlyField
                    label="Format Requested"
                    value={run.requestedFormat}
                  />
                  <ReadonlyField
                    label="Run Type"
                    value={run.fullRun ? "Full (no filter)" : "Filtered"}
                  />
                  <ReadonlyField
                    label="Failure Reason"
                    value={codeLabel(run.reasonCode)}
                  />
                  {run.signature && (
                    <>
                      <ReadonlyField label="Signed By" value={run.signature.signedBy} />
                      <ReadonlyField label="Signed On" value={when(run.signature.signedAt)} />
                      <div className="md:col-span-2">
                        <ReadonlyField label="Reason For Signing" value={run.signature.reason ?? "—"} />
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <ReadonlyField
                      label="Message"
                      value={run.errorMessage ?? "—"}
                    />
                  </div>
                  <ReadonlyField
                    label="Template"
                    value={template?.displayName ?? run.definitionCode}
                  />
                  <ReadonlyField
                    label="Template Number"
                    value={run.definitionCode}
                  />
                  <ReadonlyField
                    label="Template Revision"
                    value={reportRevisionLabel(run.revision)}
                  />
                  <ReadonlyField
                    label="Approval At Run Time"
                    value={
                      template?.approvalStatus
                        ? (APPROVAL_LABEL[template.approvalStatus] ??
                          template.approvalStatus)
                        : "Not recorded"
                    }
                  />
                  <ReadonlyField
                    label="Approved Version"
                    value={
                      template?.approvedVersion != null
                        ? `v${template.approvedVersion}`
                        : "—"
                    }
                  />
                  <ReadonlyField
                    label="Approved On"
                    value={when(template?.approvedAt)}
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-slate-700 sm:text-sm">
                      Used For GMP Decisions?
                    </label>
                    <Checkbox
                      id="gmpUse"
                      checked={Boolean(template?.gmpUse)}
                      disabled
                      aria-label="Used for GMP decisions"
                    />
                  </div>
                  <ReadonlyField
                    label="Name Rule"
                    value={
                      template?.nameFormatId
                        ? "Applied"
                        : "No rule (typed name)"
                    }
                  />
                  <ReadonlyField
                    label="Sort"
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
                      Fields
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
                      Filters And Parameters
                    </label>
                    <textarea
                      id="report-run-filters"
                      value={readableJson(run.parameters ?? {}, 2)}
                      rows={5}
                      readOnly
                      className={`${CONTROL_STATE_CLASSES.readonlyTextarea} font-mono text-xs`}
                    />
                  </div>
                </div>
              )}
              {shownTab === "files" && (
                <>
                  <DataTable
                    rows={run.artifacts}
                    getRowKey={(row) => row.id}
                    columns={artifactColumns}
                  />
                  {previewUrl && (
                    <div className="mt-4">
                      <DocumentPdfViewer
                        fileUrl={previewUrl}
                        height="550px"
                        minHeight="360px"
                        forceHideDownloadAndPrint
                      />
                    </div>
                  )}
                </>
              )}
              {shownTab === "timeline" && (
                <DataTable
                  rows={run.events}
                  getRowKey={(row, index) => `${row.createdAt}-${index}`}
                  columns={eventColumns}
                />
              )}
              {shownTab === "notices" &&
                (run.deliveries == null ? (
                  <p className="text-sm text-slate-500">
                    Shown to people who manage scheduled reports.
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
              onClick={() => navigate("/report/history")}
            >
              Back
            </Button>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Refresh
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
                  View Template Revision
                </Button>
              )}
            {["FAILED", "RETRY_SCHEDULED"].includes(run.status) && (
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={() => void retry()}
              >
                Retry Generation
              </Button>
            )}
          </div>
        </>
      )}

      <FormModal
        isOpen={hold?.step === "form"}
        onClose={() => setHold(undefined)}
        title={hold?.legalHold ? "Place legal hold" : "Release legal hold"}
        description={
          hold?.legalHold
            ? "The file is kept and cannot be removed while the hold is set. Say why."
            : "Releasing a hold lets the file be removed. A person other than the one who placed the hold must release it, and the release is signed."
        }
        confirmText={hold?.legalHold ? "Place hold" : "Continue to sign"}
        confirmDisabled={!hold || !hold.reason.trim() || busy}
        onConfirm={() => {
          if (!hold) return;
          if (hold.legalHold) void saveHold();
          else setHold({ ...hold, step: "sign" });
        }}
      >
        <FormField label="Reason" required>
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
