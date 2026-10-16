import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { humanize } from "../shared/reportLabels";
import {
  reportTemplatesApi,
  reportError,
  type ReportRevisionChange,
  type ReportRevisionComparison,
  type ReportRevisionDetail,
  type ReportTemplate,
} from "@/services/api/reportTemplates";
import { REVISION_STATUS, whenText } from "./ReportTemplateRevisions";
import { ReportRevisionStepper } from "../shared/ReportRevisionStepper";

type FieldRow = ReportTemplate["fields"][number];
type ScopeRow = NonNullable<ReportTemplate["roleScopes"]>[number];
const SCOPE_LABEL: Record<string, string> = { PERSONAL: "Personal", DEPARTMENT: "Department", BUSINESS_UNIT: "Business Unit", SYSTEM: "Entire system" };
const KIND_LABEL: Record<ReportRevisionChange["kind"], string> = { ADDED: "Added", REMOVED: "Removed", CHANGED: "Changed" };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-xs text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-slate-900">{children}</dd>
    </div>
  );
}

/**
 * One revision of a report template on a page of its own: who wrote and approved it, when it was effective, its whole content, and what changed from
 * the revision before it. The comparison is made by the server.
 */
export function ReportTemplateRevisionPage({ inAdministration = false }: { inAdministration?: boolean }) {
  const { code = "", revision = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ReportRevisionDetail>();
  const [comparison, setComparison] = useState<ReportRevisionComparison>();
  const [error, setError] = useState("");
  /** What this revision is compared with: "previous", "effective", or the number of another revision. */
  const [withRevision, setWithRevision] = useState("previous");
  const [others, setOthers] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    setDetail(undefined);
    setError("");
    setWithRevision("previous");
    reportTemplatesApi
      .revision(code, Number(revision))
      .then((value) => alive && setDetail(value))
      .catch((e) => alive && setError(reportError(e)));
    reportTemplatesApi
      .revisions(code, { sortBy: "revision", sortDirection: "desc", limit: 100 })
      .then((page) => alive && setOthers(page.data.map((row) => row.revision).filter((number) => number !== Number(revision))))
      .catch(() => alive && setOthers([]));
    return () => {
      alive = false;
    };
  }, [code, revision]);

  useEffect(() => {
    let alive = true;
    setComparison(undefined);
    reportTemplatesApi
      .compareRevision(code, Number(revision), withRevision)
      .then((compared) => alive && setComparison(compared))
      .catch((e) => alive && setError(reportError(e)));
    return () => {
      alive = false;
    };
  }, [code, revision, withRevision]);

  const templatePath = inAdministration ? `/settings/report-configuration/${encodeURIComponent(code)}/details` : `/report/templates/${encodeURIComponent(code)}`;
  const parent = { label: "Report Template Details", onClick: () => navigate(templatePath) };
  const title = "Report Template Revision";

  const fieldColumns: DataTableColumn<FieldRow>[] = [
    { id: "name", header: "Field", cell: (row) => <span className="font-medium text-slate-900">{row.name}</span> },
    { id: "code", header: "Code", cell: (row) => <span className="font-mono text-xs">{row.code}</span> },
    { id: "allowed", header: "Allowed", cell: (row) => (row.allowed ? "Yes" : "No") },
    { id: "default", header: "Default", cell: (row) => (row.defaultSelected ? "Yes" : "No") },
    { id: "required", header: "Required", cell: (row) => (row.required ? "Yes" : "No") },
  ];
  const { layout: fieldLayout, control: fieldControl } = useCustomColumnLayout("reportRevisionFields", fieldColumns);
  const scopeColumns: DataTableColumn<ScopeRow>[] = [
    { id: "role", header: "Role", cell: (row) => row.roleName ?? row.roleId },
    { id: "scope", header: "Data scope", cell: (row) => SCOPE_LABEL[row.scope] ?? row.scope },
  ];
  const { layout: scopeLayout, control: scopeControl } = useCustomColumnLayout("reportRevisionScopes", scopeColumns);
  const changeColumns: DataTableColumn<ReportRevisionChange>[] = [
    { id: "section", header: "Section", cell: (row) => row.section },
    { id: "item", header: "Item", cell: (row) => <span className="font-medium text-slate-900">{row.item}</span> },
    { id: "kind", header: "Change", cell: (row) => KIND_LABEL[row.kind] },
    { id: "from", header: "Before", cell: (row) => <div className="max-w-64 whitespace-normal">{row.from ?? "—"}</div> },
    { id: "to", header: "After", cell: (row) => <div className="max-w-64 whitespace-normal">{row.to ?? "—"}</div> },
  ];
  const { layout: changeLayout, control: changeControl } = useCustomColumnLayout("reportRevisionChanges", changeColumns);

  const content = detail?.content;
  const status = detail ? REVISION_STATUS[detail.status] : undefined;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, inAdministration, parent)}
        actions={
          <Button size="sm" variant="outline" className="whitespace-nowrap touch-manipulation" onClick={parent.onClick}>
            Back
          </Button>
        }
      />
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {!detail ? (
        error ? null : <SectionLoading text="Loading revision…" />
      ) : (
        <>
          <ReportRevisionStepper status={detail.status} />
          <FormSection title="Revision" description={detail.changeReason ?? "No reason recorded."}>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Template number">
                <span className="font-mono text-xs">{detail.definitionCode}</span>
              </Fact>
              <Fact label="Revision">Rev {detail.revision}</Fact>
              <Fact label="Status">
                <Badge color={status?.color ?? "slate"} size="sm">
                  {status?.label ?? detail.status}
                </Badge>
              </Fact>
              <Fact label="Created by">{detail.createdByName ?? "—"}</Fact>
              <Fact label="Created on">{whenText(detail.createdAt)}</Fact>
              <Fact label="Last changed by">{detail.lastChangedByName ?? "—"}</Fact>
              <Fact label="Submitted by">{detail.submittedByName ?? "—"}</Fact>
              <Fact label="Submitted on">{whenText(detail.submittedAt)}</Fact>
              <Fact label="Last review comment">{detail.approvalComment ?? "—"}</Fact>
              <Fact label="Approved by">{detail.approvedByName ?? "—"}</Fact>
              <Fact label="Approved on">{whenText(detail.approvedAt)}</Fact>
              <Fact label="Effective from">{whenText(detail.effectiveAt)}</Fact>
              <Fact label="Discarded">
                {detail.discardedAt ? `${whenText(detail.discardedAt)}: ${detail.discardReason ?? ""}` : "—"}
              </Fact>
              <Fact label="Obsoleted">
                {detail.obsoletedAt ? `${whenText(detail.obsoletedAt)} by Rev ${detail.obsoletedByRevision ?? ""}` : "—"}
              </Fact>
            </dl>
          </FormSection>
          <FormSection
            title="Changes"
            description={comparison?.comparedWith != null ? `What changed from Rev ${comparison.comparedWith} to Rev ${detail.revision}.` : "This is the first revision."}
          >
            <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
              <div className="w-full sm:w-72">
                <Select
                  label="Compare with"
                  value={withRevision}
                  options={[
                    { value: "previous", label: "Previous revision" },
                    { value: "effective", label: "Effective revision" },
                    ...others.map((number) => ({ value: String(number), label: `Rev ${number}` })),
                  ]}
                  onChange={(value) => setWithRevision(String(value))}
                />
              </div>
              {changeControl}
            </div>
            <DataTable
              rows={comparison?.changes ?? []}
              getRowKey={(row) => `${row.section}|${row.item}|${row.kind}`}
              columns={changeColumns}
              columnLayout={changeLayout}
              emptyState={<TableEmptyState title="No changes" description={comparison?.comparedWith != null ? "This revision has the same content as the one before it." : "There is no earlier revision to compare with."} />}
            />
          </FormSection>
          <FormSection title="Content" description="The template as this revision defines it.">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Template name">{content?.displayName ?? "—"}</Fact>
              <Fact label="Data source">{humanize(content?.sourceCode)}</Fact>
              <Fact label="Output formats">{content?.allowedFormats?.join(" · ") ?? "—"}</Fact>
              <Fact label="Orientation">{content?.layout?.orientation === "PORTRAIT" ? "Portrait" : "Landscape"}</Fact>
              <Fact label="Used for GMP decisions">{content?.gmpUse ? "Yes" : "No"}</Fact>
              <Fact label="Description">{content?.description || "—"}</Fact>
            </dl>
          </FormSection>
          <FormSection title="Fields" description="The columns this revision can put in a report.">
            <div className="mb-2 flex justify-end">{fieldControl}</div>
            <DataTable
              rows={content?.fields ?? []}
              getRowKey={(row) => row.code}
              columns={fieldColumns}
              columnLayout={fieldLayout}
              emptyState={<TableEmptyState title="No fields" description="This revision has no fields." />}
            />
          </FormSection>
          {inAdministration && (
            <FormSection title="Role scopes" description="How far each role's data reaches for this revision.">
              <div className="mb-2 flex justify-end">{scopeControl}</div>
              <DataTable
                rows={content?.roleScopes ?? []}
                getRowKey={(row) => row.roleId}
                columns={scopeColumns}
                columnLayout={scopeLayout}
                emptyState={<TableEmptyState title="No role scopes" description="No role may run this revision." />}
              />
            </FormSection>
          )}
        </>
      )}
    </div>
  );
}
