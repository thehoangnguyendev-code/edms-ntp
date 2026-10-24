import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { ReportTemplateRevisions } from "./ReportTemplateRevisions";
import { ReportTemplateUpgradeModal } from "./ReportTemplateUpgradeModal";
import { ReportRevisionStepper, latestRevisionStatus } from "../shared/ReportRevisionStepper";
import { ReportTemplateReasonModal } from "./ReportTemplateReasonModal";
import { useReportTemplateCapabilities } from "./useReportTemplateCapabilities";
import { codeLabel, humanize } from "../shared/reportLabels";
import { displayDateTime } from "@/utils/format";
import {
  reportTemplatesApi,
  reportError,
  type ReportTemplate,
} from "@/services/api/reportTemplates";

type FieldRow = ReportTemplate["fields"][number];
type ScopeRow = NonNullable<ReportTemplate["roleScopes"]>[number];

const LIFECYCLE: Record<string, { label: string; color: "emerald" | "amber" | "slate" }> = {
  ACTIVE: { label: "Active", color: "emerald" },
  PENDING_APPROVAL: { label: "Pending Approval", color: "amber" },
  DRAFT: { label: "Draft", color: "slate" },
  INACTIVE: { label: "Inactive", color: "slate" },
};
const SCOPE_LABEL: Record<string, string> = { PERSONAL: "Personal", DEPARTMENT: "Department", BUSINESS_UNIT: "Business Unit", SYSTEM: "Entire system" };
const when = (value?: string | null) => (value ? displayDateTime(value) : "—");

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-xs text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-slate-900">{children}</dd>
    </div>
  );
}

/**
 * One report template on a page of its own, for the library and for Report Definitions. It replaces the Template Details drawer.
 * It shows every field the server returns for the template; the role scopes and the approval state are shown where the viewer may see them.
 */
export function ReportTemplateDetailPage({ inAdministration = false }: { inAdministration?: boolean }) {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<ReportTemplate>();
  const [error, setError] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [action, setAction] = useState<"disable" | "enable" | "discard">();
  // What may be done to this template is decided by the server from the viewer's permissions and the state of the template.
  const { can } = useReportTemplateCapabilities(
    code,
    template ? `${template.definitionVersion}|${template.active}|${template.effectiveRevision}|${template.openRevision}|${template.openRevisionStatus}` : "",
  );

  useEffect(() => {
    let alive = true;
    setTemplate(undefined);
    setError("");
    const load = inAdministration
      ? reportTemplatesApi.detail(code)
      : reportTemplatesApi.list({ search: code, page: 1, sortBy: "displayName", direction: "asc" }, false).then((page) => {
          const found = page.data.find((item) => item.code === code);
          if (!found) throw new Error("REPORT_TEMPLATE_NOT_FOUND");
          return found;
        });
    load.then((value) => alive && setTemplate(value)).catch((e) => alive && setError(reportError(e)));
    return () => {
      alive = false;
    };
  }, [code, inAdministration]);

  const parent = inAdministration
    ? { label: "Report Definitions", onClick: () => navigate("/settings/report-configuration") }
    : { label: "Report Library", onClick: () => navigate("/report/templates") };
  const title = "Report Template Details";

  const fieldColumns: DataTableColumn<FieldRow>[] = [
    { id: "name", header: "Field", cell: (row) => <span className="font-medium text-slate-900">{row.name}</span> },
    { id: "code", header: "Code", cell: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { id: "type", header: "Type", cell: (row) => row.type },
    { id: "allowed", header: "Allowed", cell: (row) => (row.allowed ? "Yes" : "No") },
    { id: "default", header: "Default", cell: (row) => (row.defaultSelected ? "Yes" : "No") },
    { id: "required", header: "Required", cell: (row) => (row.required ? "Yes" : "No") },
  ];
  const { layout: fieldLayout, control: fieldControl } = useCustomColumnLayout("reportTemplateFields", fieldColumns);
  const scopeColumns: DataTableColumn<ScopeRow>[] = [
    { id: "role", header: "Role", cell: (row) => row.roleName ?? row.roleId },
    { id: "scope", header: "Data scope", cell: (row) => SCOPE_LABEL[row.scope] ?? row.scope },
  ];
  const { layout: scopeLayout, control: scopeControl } = useCustomColumnLayout("reportTemplateScopes", scopeColumns);

  const lifecycle = template ? LIFECYCLE[template.lifecycleStatus ?? (template.active ? "ACTIVE" : "INACTIVE")] : undefined;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, inAdministration, parent)}
        actions={
          <>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap touch-manipulation" onClick={parent.onClick}>
              Back
            </Button>
            {template && inAdministration && (can("disable") || can("enable")) && (
                <Button size="sm" variant="outline-emerald" className="whitespace-nowrap touch-manipulation" onClick={() => setAction(can("disable") ? "disable" : "enable")}>
                  {can("disable") ? "Disable Report Template" : "Enable Report Template"}
                </Button>
              )}
            {template && inAdministration && can("discardRevision") && (
                <Button size="sm" variant="outline-emerald" className="whitespace-nowrap touch-manipulation" onClick={() => setAction("discard")}>
                  Discard Revision
                </Button>
              )}
            {template && can("viewAuditTrail") && (
                <Button size="sm" variant="outline" className="whitespace-nowrap touch-manipulation" onClick={() => navigate(`/audit-trail?search=${encodeURIComponent(template.code)}`)}>
                  Audit Trail
                </Button>
              )}
            {template && inAdministration && can("upgrade") && (
                <Button size="sm" variant="outline-emerald" className="whitespace-nowrap touch-manipulation" onClick={() => setUpgrading(true)}>
                  Upgrade Report Template
                </Button>
              )}
            {template && can("edit") && (
                <Button size="sm" variant="outline-emerald" className="whitespace-nowrap touch-manipulation" onClick={() => navigate(`/settings/report-configuration/${encodeURIComponent(template.code)}`)}>
                  Edit Report Template
                </Button>
              )}
            {template && !inAdministration && can("createReport") && (
                <Button size="sm" variant="outline-emerald" className="whitespace-nowrap touch-manipulation" onClick={() => navigate(`/report/templates/${encodeURIComponent(template.code)}/run`)}>
                  Create Report
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
      {!template ? (
        error ? null : <SectionLoading text="Loading report template…" />
      ) : (
        <>
          <ReportRevisionStepper status={latestRevisionStatus(template)} />
          <FormSection title="Template" description={template.description || "No description."}>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Template name">{template.displayName}</Fact>
              <Fact label="Template number">
                <span className="font-mono text-xs">{template.code}</span>
              </Fact>
              <Fact label="Data source">{humanize(template.sourceCode)}</Fact>
              <Fact label="Effective revision">{template.effectiveRevision != null ? `Rev ${template.effectiveRevision}` : "None yet"}</Fact>
              <Fact label="Revision in progress">
                {template.openRevision != null ? `Rev ${template.openRevision} · ${template.openRevisionStatus === "PENDING_APPROVAL" ? "Pending Approval" : "Draft"}` : "—"}
              </Fact>
              <Fact label="Status">
                <Badge color={lifecycle?.color ?? "slate"} size="sm">
                  {lifecycle?.label ?? (template.active ? "Active" : "Disabled")}
                </Badge>
              </Fact>
              <Fact label="Classification">{humanize(template.classification)}</Fact>
              <Fact label="Category">{humanize(template.category)}</Fact>
              <Fact label="Output formats">{template.allowedFormats.join(" · ")}</Fact>
              <Fact label="Orientation">{template.layout?.orientation === "PORTRAIT" ? "Portrait" : "Landscape"}</Fact>
              <Fact label="Used for GMP decisions">{template.gmpUse ? "Yes" : "No"}</Fact>
              <Fact label="Created">{when(template.createdAt)}</Fact>
              <Fact label="Last updated">{when(template.updatedAt)}</Fact>
            </dl>
          </FormSection>
          {inAdministration && (
            <FormSection title="Approval" description="Only an approved current version can run.">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Fact label="Approval state">{codeLabel(template.approvalStatus)}</Fact>
                <Fact label="Approved version">{template.approvedVersion != null ? `v${template.approvedVersion}` : "—"}</Fact>
                <Fact label="Approved on">{when(template.approvedAt)}</Fact>
                <Fact label="Submitted version">{template.submittedVersion != null ? `v${template.submittedVersion}` : "—"}</Fact>
                <Fact label="Submitted on">{when(template.submittedAt)}</Fact>
                <Fact label="Last review comment">{template.approvalComment ?? "—"}</Fact>
              </dl>
            </FormSection>
          )}
          {can("viewRevisions") && <ReportTemplateRevisions code={template.code} inAdministration={inAdministration} />}
          <FormSection title="Fields" description="The columns this template can put in a report.">
            <div className="mb-2 flex justify-end">{fieldControl}</div>
            <DataTable
              rows={template.fields}
              getRowKey={(row) => row.code}
              columns={fieldColumns}
              columnLayout={fieldLayout}
              emptyState={<TableEmptyState title="No fields" description="This template has no fields." />}
            />
          </FormSection>
          {inAdministration && (
            <FormSection title="Role scopes" description="How far each role's data reaches for this template.">
              <div className="mb-2 flex justify-end">{scopeControl}</div>
              <DataTable
                rows={template.roleScopes ?? []}
                getRowKey={(row) => row.roleId}
                columns={scopeColumns}
                columnLayout={scopeLayout}
                emptyState={<TableEmptyState title="No role scopes" description="No role may run this template yet." />}
              />
            </FormSection>
          )}
          <ReportTemplateReasonModal
            isOpen={action === "disable" || action === "enable"}
            title={action === "enable" ? "Enable Report Template" : "Disable Report Template"}
            description={
              action === "enable"
                ? "The template can be used again at once, with its effective revision."
                : "The template stops at once: no report can be made from it and its schedules cannot run. Reports already made are kept. The change is recorded in the audit trail."
            }
            confirmText={action === "enable" ? "Enable" : "Disable"}
            reasonRequired={false}
            onClose={() => setAction(undefined)}
            onConfirm={async (reason) => {
              setTemplate(await reportTemplatesApi.setEnabled(template.code, action === "enable", reason));
              setAction(undefined);
            }}
          />
          <ReportTemplateReasonModal
            isOpen={action === "discard"}
            title="Discard Revision"
            description={`Rev ${template.openRevision} is discarded and stays on record as Discarded. Rev ${template.effectiveRevision} remains the effective revision.`}
            confirmText="Discard"
            reasonRequired
            onClose={() => setAction(undefined)}
            onConfirm={async (reason) => {
              setTemplate(await reportTemplatesApi.discardRevision(template.code, template.definitionVersion, reason));
              setAction(undefined);
            }}
          />
          <ReportTemplateUpgradeModal
            template={template}
            isOpen={upgrading}
            onClose={() => setUpgrading(false)}
            onUpgraded={() => navigate(`/settings/report-configuration/${encodeURIComponent(template.code)}`)}
          />
          <p className="text-xs leading-relaxed text-slate-500">
            Report metadata access does not grant access to source-document content. Current role scopes are checked on preview, generation and download.
          </p>
        </>
      )}
    </div>
  );
}
