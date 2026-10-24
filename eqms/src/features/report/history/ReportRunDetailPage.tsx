import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { codeLabel, runStatusLabel } from "../shared/reportLabels";
import { reportsApi, type ReportArtifactSummary, type ReportRunDetail } from "@/services/api/reports";
import { reportError } from "@/services/api/reportTemplates";
import { displayDateTime } from "@/utils/format";

const STATUS_COLOR: Record<string, "emerald" | "amber" | "red" | "slate" | "blue"> = {
  COMPLETED: "emerald",
  FAILED: "red",
  DEAD_LETTERED: "red",
  RETRY_SCHEDULED: "amber",
  QUEUED: "blue",
  PROCESSING: "blue",
};
const APPROVAL_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  PENDING_APPROVAL: "Pending Approval",
  DRAFT: "Draft",
};

/** One labelled fact: a label above its value. Used for every field of the run, so nothing is hidden in a tooltip. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-xs text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-slate-900">{children}</dd>
    </div>
  );
}

const when = (value?: string | null) => (value ? displayDateTime(value) : "—");

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
  const [hold, setHold] = useState<{ artifactId: string; legalHold: boolean; reason: string; step: "form" | "sign" }>();
  const [busy, setBusy] = useState(false);

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

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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
      await reportsApi.setLegalHold(runId, hold.artifactId, hold.legalHold, hold.reason.trim(), signatureToken);
      showToast({ type: "success", title: hold.legalHold ? "Legal hold placed" : "Legal hold released", message: hold.artifactId });
      setHold(undefined);
      setRefresh((n) => n + 1);
    } catch (e) {
      showToast({ type: "error", title: "The legal hold was not changed", message: reportError(e) });
    } finally {
      setBusy(false);
    }
  };

  const title = "Report Run Details";
  const selectedFields = Array.isArray(run?.selectedFields) ? run.selectedFields : [];
  const sortSpec = Array.isArray(run?.sortSpec) ? run.sortSpec : [];
  const template = run?.templateAtRun;
  const artifactColumns: DataTableColumn<ReportArtifactSummary>[] = [
                { id: "format", header: "Format", cell: (row) => row.format },
                { id: "name", header: "File name", cell: (row) => <span className="break-all text-xs">{row.generatedFilename}</span> },
                { id: "size", header: "Size", cell: (row) => `${row.byteSize.toLocaleString()} bytes` },
                { id: "sha", header: "SHA-256", cell: (row) => <span className="break-all font-mono text-xs">{row.sha256}</span> },
                { id: "created", header: "Created", cell: (row) => when(row.createdAt) },
                {
                  id: "retention",
                  header: "Retention",
                  cell: (row) =>
                    row.purgedAt ? "Removed after expiry" : row.legalHold ? "Legal hold: kept until released" : "Kept permanently",
                },
                {
                  id: "actions",
                  header: "",
                  cell: (row) => (
                    <div className="flex flex-wrap gap-2">
                      {run.status === "COMPLETED" && !row.purgedAt && (
                        <Button size="sm" variant="outline" onClick={() => void download(row)}>
                          Download
                        </Button>
                      )}
                      {run.status === "COMPLETED" && !row.purgedAt && row.format === "PDF" && (
                        <Button size="sm" variant="outline-emerald" loading={previewBusy} onClick={() => void preview(row)}>
                          Preview
                        </Button>
                      )}
                      {canHold && !row.purgedAt && (
                        <Button size="sm" variant="outline" onClick={() => setHold({ artifactId: row.id, legalHold: !row.legalHold, reason: "", step: "form" })}>
                          {row.legalHold ? "Release legal hold" : "Place legal hold"}
                        </Button>
                      )}
                    </div>
                  ),
                },
              ];
  const { layout: artifactLayout, control: artifactLayoutControl } = useCustomColumnLayout("reportRunArtifacts", artifactColumns);
  const eventColumns: DataTableColumn<ReportRunDetail["events"][number]>[] = [
                { id: "at", header: "When", cell: (row) => when(row.createdAt) },
                { id: "event", header: "Event", cell: (row) => codeLabel(row.eventType) },
                { id: "reason", header: "Reason", cell: (row) => codeLabel(row.reasonCode) },
                {
                  id: "detail",
                  header: "Details",
                  cell: (row) => (
                    <pre className="whitespace-pre-wrap break-all text-xs">
                      {Object.keys(row.detail ?? {}).length ? JSON.stringify(row.detail) : "—"}
                    </pre>
                  ),
                },
              ];
  const { layout: eventLayout, control: eventLayoutControl } = useCustomColumnLayout("reportRunTimeline", eventColumns);
  const deliveryColumns: DataTableColumn<NonNullable<ReportRunDetail["deliveries"]>[number]>[] = [
                  { id: "at", header: "When", cell: (row) => when(row.createdAt) },
                  { id: "recipient", header: "Recipient", cell: (row) => row.recipientName ?? "—" },
                  { id: "channel", header: "Channel", cell: (row) => (row.channel === "EMAIL" ? "E-mail" : "In app") },
                  { id: "event", header: "Notice", cell: (row) => codeLabel(row.eventCode) },
                  { id: "status", header: "Result", cell: (row) => codeLabel(row.status) },
                  { id: "reason", header: "Reason", cell: (row) => codeLabel(row.reasonCode) },
                ];
  const { layout: deliveryLayout, control: deliveryLayoutControl } = useCustomColumnLayout("reportRunNotices", deliveryColumns);
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
            <Button size="sm" variant="outline" onClick={() => navigate("/report/history")}>
              Back
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRefresh((n) => n + 1)}>
              Refresh
            </Button>
            {run && ["FAILED", "RETRY_SCHEDULED"].includes(run.status) && (
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={async () => {
                  try {
                    await reportsApi.retryRun(run.id);
                    setRefresh((n) => n + 1);
                  } catch (e) {
                    setError(reportError(e));
                  }
                }}
              >
                Retry generation
              </Button>
            )}
          </>
        }
      />
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {!run ? (
        error ? null : <SectionLoading text="Loading report run…" />
      ) : (
        <>
          <FormSection title="Run">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Report name">{run.reportTitle ?? run.definitionCode}</Fact>
              <Fact label="Status">
                <Badge color={STATUS_COLOR[run.status] ?? "slate"} size="sm">{runStatusLabel(run.status)}</Badge>
              </Fact>
              <Fact label="Progress">{run.progress}%</Fact>
              <Fact label="Attempts">{run.attemptCount}</Fact>
              <Fact label="Request">{run.requestType === "SCHEDULED" ? "Scheduled" : "On demand"}</Fact>
              <Fact label="Schedule">
                {run.scheduleId ? (
                  <button type="button" className="text-emerald-600 hover:underline" onClick={() => navigate("/report/scheduled")}>
                    {run.scheduleName ?? run.scheduleId}
                  </button>
                ) : (
                  "—"
                )}
              </Fact>
              <Fact label="Requested by">{run.requesterName ?? run.requesterUserId}</Fact>
              <Fact label="Format requested">{run.requestedFormat}</Fact>
              <Fact label="Queued">{when(run.queuedAt)}</Fact>
              <Fact label="Started">{when(run.startedAt)}</Fact>
              <Fact label="Completed">{when(run.completedAt)}</Fact>
              <Fact label="Data as of">{when(run.asOfAt)}</Fact>
              <Fact label="Run ID">
                <span className="break-all font-mono text-xs">{run.id}</span>
              </Fact>
              <Fact label="Reason">{codeLabel(run.reasonCode)}</Fact>
              <Fact label="Message">{run.errorMessage ?? "—"}</Fact>
            </dl>
          </FormSection>

          <FormSection title="Template used for this run" description="The template as it was when the run was made. Its later changes are shown on the template.">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Template">{template?.displayName ?? run.definitionCode}</Fact>
              <Fact label="Template number">
                <span className="font-mono text-xs">{run.definitionCode}</span>
              </Fact>
              <Fact label="Template revision">
                {run.revision == null ? (
                  "Not recorded"
                ) : hasPermission("reports.definition.view") ? (
                  <button type="button" className="text-emerald-600 hover:underline" onClick={() => navigate(`/report/templates/${encodeURIComponent(run.definitionCode)}/revisions/${run.revision}`)}>
                    Rev {run.revision}
                  </button>
                ) : (
                  `Rev ${run.revision}`
                )}
              </Fact>
              <Fact label="Approval at run time">
                {template?.approvalStatus ? APPROVAL_LABEL[template.approvalStatus] ?? template.approvalStatus : "Not recorded"}
              </Fact>
              <Fact label="Approved version">{template?.approvedVersion != null ? `v${template.approvedVersion}` : "—"}</Fact>
              <Fact label="Approved on">{when(template?.approvedAt)}</Fact>
              <Fact label="Used for GMP decisions">{template?.gmpUse ? "Yes" : "No"}</Fact>
              <Fact label="Name rule">{template?.nameFormatId ? <span className="font-mono text-xs break-all">{template.nameFormatId}</span> : "No rule (typed name)"}</Fact>
            </dl>
          </FormSection>

          <FormSection title="Criteria" description="What was asked for: filters, fields and sort order.">
            <dl className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Fact label="Filters and parameters">
                <pre className="whitespace-pre-wrap text-xs font-normal">{JSON.stringify(run.parameters ?? {}, null, 2)}</pre>
              </Fact>
              <Fact label="Fields">
                <ul className="list-disc pl-4 text-xs font-normal">
                  {selectedFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </Fact>
              <Fact label="Sort">
                {sortSpec.length
                  ? sortSpec.map((s) => `${s.field} ${s.direction}`).join(", ")
                  : "Default"}
              </Fact>
            </dl>
          </FormSection>

          <FormSection title="Report files" description="Each file's checksum, retention and legal hold. Preview and download need the same permissions as before.">
            <div className="mb-2 flex justify-end">{artifactLayoutControl}</div>
            <DataTable
              rows={run.artifacts}
              getRowKey={(row) => row.id}
              columns={artifactColumns}
            columnLayout={artifactLayout}
            />
            {previewUrl && (
              <div className="mt-4">
                <DocumentPdfViewer fileUrl={previewUrl} height="550px" minHeight="360px" forceHideDownloadAndPrint />
              </div>
            )}
          </FormSection>

          <FormSection title="Timeline" description="Every event of this run, oldest first, with its details.">
            <div className="mb-2 flex justify-end">{eventLayoutControl}</div>
            <DataTable
              rows={run.events}
              getRowKey={(row, index) => `${row.createdAt}-${index}`}
              columns={eventColumns}
            columnLayout={eventLayout}
            />
          </FormSection>

          <FormSection title="Notices sent" description="Who was told about this run, by which channel, and the result of each attempt.">
            {run.deliveries == null ? (
              <p className="text-sm text-slate-500">Shown to people who manage scheduled reports.</p>
            ) : (
              <>
              <div className="mb-2 flex justify-end">{deliveryLayoutControl}</div>
              <DataTable
                rows={run.deliveries}
                getRowKey={(row, index) => `${row.createdAt}-${index}`}
                columns={deliveryColumns}
            columnLayout={deliveryLayout}
              />
              </>
            )}
          </FormSection>
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
            onChange={(event) => setHold((current) => current && { ...current, reason: event.target.value })}
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
