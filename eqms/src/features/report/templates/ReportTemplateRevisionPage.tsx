import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { humanize, reportRevisionLabel } from "../shared/reportLabels";
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
import { ReadonlyField } from "../shared/ReadonlyField";

type FieldRow = ReportTemplate["fields"][number];
type ScopeRow = NonNullable<ReportTemplate["roleScopes"]>[number];
const SCOPE_LABEL: Record<string, string> = {
  PERSONAL: "Personal",
  DEPARTMENT: "Department",
  BUSINESS_UNIT: "Business Unit",
  SYSTEM: "Entire system",
};
const KIND_LABEL: Record<ReportRevisionChange["kind"], string> = {
  ADDED: "Added",
  REMOVED: "Removed",
  CHANGED: "Changed",
};

/**
 * One revision of a report template on a page of its own: who wrote and approved it, when it was effective, its whole content, and what changed from
 * the revision before it. The comparison is made by the server.
 */
export function ReportTemplateRevisionPage({
  inAdministration = false,
}: {
  inAdministration?: boolean;
}) {
  const { code = "", revision = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ReportRevisionDetail>();
  const [comparison, setComparison] = useState<ReportRevisionComparison>();
  const [error, setError] = useState("");
  /** What this revision is compared with: "previous", "effective", or the number of another revision. */
  const [withRevision, setWithRevision] = useState("previous");
  const [others, setOthers] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("general");

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
      .revisions(code, {
        sortBy: "revision",
        sortDirection: "desc",
        limit: 100,
      })
      .then(
        (page) =>
          alive &&
          setOthers(
            page.data
              .map((row) => row.revision)
              .filter((number) => number !== Number(revision)),
          ),
      )
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

  const templatePath = inAdministration
    ? `/settings/report-configuration/${encodeURIComponent(code)}/details`
    : `/report/templates/${encodeURIComponent(code)}`;
  const parent = {
    label: "Report Template Details",
    onClick: () => navigate(templatePath),
  };
  const title = "Report Template Revision";

  const fieldColumns: DataTableColumn<FieldRow>[] = [
    {
      id: "name",
      header: "Field",
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.name}</span>
      ),
    },
    {
      id: "code",
      header: "Code",
      cell: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    {
      id: "allowed",
      header: "Allowed",
      cell: (row) => (row.allowed ? "Yes" : "No"),
    },
    {
      id: "default",
      header: "Default",
      cell: (row) => (row.defaultSelected ? "Yes" : "No"),
    },
    {
      id: "required",
      header: "Required",
      cell: (row) => (row.required ? "Yes" : "No"),
    },
  ];
  const scopeColumns: DataTableColumn<ScopeRow>[] = [
    { id: "role", header: "Role", cell: (row) => row.roleName ?? "—" },
    {
      id: "scope",
      header: "Data scope",
      cell: (row) => SCOPE_LABEL[row.scope] ?? row.scope,
    },
  ];
  const changeColumns: DataTableColumn<ReportRevisionChange>[] = [
    { id: "section", header: "Section", cell: (row) => row.section },
    {
      id: "item",
      header: "Item",
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.item}</span>
      ),
    },
    { id: "kind", header: "Change", cell: (row) => KIND_LABEL[row.kind] },
    {
      id: "from",
      header: "Before",
      cell: (row) => (
        <div className="max-w-64 whitespace-normal">{row.from ?? "—"}</div>
      ),
    },
    {
      id: "to",
      header: "After",
      cell: (row) => (
        <div className="max-w-64 whitespace-normal">{row.to ?? "—"}</div>
      ),
    },
  ];

  const content = detail?.content;
  // The same tab layout as the Report Template Details and the Document details.
  const tabs = useMemo<TabItem[]>(() => {
    const list: TabItem[] = [
      { id: "general", label: "General Information" },
      { id: "changes", label: "Changes", count: comparison?.changes.length },
      { id: "fields", label: "Fields", count: content?.fields?.length },
    ];
    if (inAdministration)
      list.push({
        id: "scopes",
        label: "Role Scopes",
        count: content?.roleScopes?.length ?? 0,
      });
    return list;
  }, [comparison, content, inAdministration]);
  const shownTab = tabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "general";
  const status = detail ? REVISION_STATUS[detail.status] : undefined;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(
          navigate,
          title,
          inAdministration,
          parent,
        )}
        actions={
          <Button
            size="sm"
            variant="outline"
            className="whitespace-nowrap touch-manipulation"
            onClick={parent.onClick}
          >
            Back
          </Button>
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
      {!detail ? (
        error ? null : (
          <SectionLoading text="Loading revision…" />
        )
      ) : (
        <>
          <ReportRevisionStepper workflow={detail.workflow} />
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <TabNav
              tabs={tabs}
              activeTab={shownTab}
              onChange={setActiveTab}
              layoutId="report-template-revision-tab"
            />
            <div className="space-y-4 p-4 md:p-5">
              {shownTab === "general" && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <ReadonlyField
                    label="Created Time"
                    value={whenText(detail.createdAt)}
                  />
                  <ReadonlyField
                    label="Last Changed By"
                    value={detail.lastChangedByName ?? "—"}
                  />
                  <ReadonlyField
                    label="Template Name"
                    value={content?.displayName ?? "—"}
                  />
                  <ReadonlyField
                    label="Template Number"
                    value={detail.definitionCode}
                  />
                  <ReadonlyField
                    label="Revision"
                    value={reportRevisionLabel(detail.revision, detail.status)}
                  />
                  <ReadonlyField
                    label="Status"
                    value={status?.label ?? detail.status}
                  />
                  <ReadonlyField
                    label="Data Source"
                    value={humanize(content?.sourceCode)}
                  />
                  <ReadonlyField
                    label="Output Formats"
                    value={content?.allowedFormats?.join(" · ") ?? "—"}
                  />
                  <ReadonlyField
                    label="Orientation"
                    value={
                      content?.layout?.orientation === "PORTRAIT"
                        ? "Portrait"
                        : "Landscape"
                    }
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-slate-700 sm:text-sm">
                      Used For GMP Decisions?
                    </label>
                    <Checkbox
                      id="gmpUse"
                      checked={Boolean(content?.gmpUse)}
                      disabled
                      aria-label="Used for GMP decisions"
                    />
                  </div>
                  <ReadonlyField
                    label="Created By"
                    value={detail.createdByName ?? "—"}
                  />
                  <ReadonlyField
                    label="Submitted By"
                    value={detail.submittedByName ?? "—"}
                  />
                  <ReadonlyField
                    label="Submitted On"
                    value={whenText(detail.submittedAt)}
                  />
                  <ReadonlyField
                    label="Last Review Comment"
                    value={detail.approvalComment ?? "—"}
                  />
                  <ReadonlyField
                    label="Approved By"
                    value={detail.approvedByName ?? "—"}
                  />
                  <ReadonlyField
                    label="Approved On"
                    value={whenText(detail.approvedAt)}
                  />
                  <ReadonlyField
                    label="Effective From"
                    value={whenText(detail.effectiveAt)}
                  />
                  <ReadonlyField
                    label="Discarded"
                    value={
                      detail.discardedAt
                        ? `${whenText(detail.discardedAt)}: ${detail.discardReason ?? ""}`
                        : "—"
                    }
                  />
                  <ReadonlyField
                    label="Obsoleted"
                    value={
                      detail.obsoletedAt
                        ? `${whenText(detail.obsoletedAt)} by ${reportRevisionLabel(detail.obsoletedByRevision)}`
                        : "—"
                    }
                  />
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label
                      htmlFor="report-revision-reason"
                      className="text-xs font-medium text-slate-700 sm:text-sm"
                    >
                      Reason For The Change
                    </label>
                    <textarea
                      id="report-revision-reason"
                      value={detail.changeReason ?? "No reason recorded."}
                      rows={3}
                      readOnly
                      className={CONTROL_STATE_CLASSES.readonlyTextarea}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label
                      htmlFor="report-revision-description"
                      className="text-xs font-medium text-slate-700 sm:text-sm"
                    >
                      Description
                    </label>
                    <textarea
                      id="report-revision-description"
                      value={content?.description || "—"}
                      rows={4}
                      readOnly
                      className={CONTROL_STATE_CLASSES.readonlyTextarea}
                    />
                  </div>
                </div>
              )}
              {shownTab === "changes" && (
                <div>
                  <div className="mb-3 w-full sm:w-72">
                    <Select
                      label="Compare with"
                      value={withRevision}
                      options={[
                        { value: "previous", label: "Previous revision" },
                        { value: "effective", label: "Effective revision" },
                        ...others.map((number) => ({
                          value: String(number),
                          label: reportRevisionLabel(number),
                        })),
                      ]}
                      onChange={(value) => setWithRevision(String(value))}
                    />
                  </div>
                  <p className="mb-3 text-sm text-slate-600">
                    {comparison?.comparedWith != null
                      ? `What changed from ${reportRevisionLabel(comparison.comparedWith)} to ${reportRevisionLabel(detail.revision, detail.status)}.`
                      : "This is the first revision."}
                  </p>
                  <DataTable
                    rows={comparison?.changes ?? []}
                    getRowKey={(row) =>
                      `${row.section}|${row.item}|${row.kind}`
                    }
                    columns={changeColumns}
                    emptyState={
                      <TableEmptyState
                        title="No changes"
                        description={
                          comparison?.comparedWith != null
                            ? "This revision has the same content as the one before it."
                            : "There is no earlier revision to compare with."
                        }
                      />
                    }
                  />
                </div>
              )}
              {shownTab === "fields" && (
                <DataTable
                  rows={content?.fields ?? []}
                  getRowKey={(row) => row.code}
                  columns={fieldColumns}
                  emptyState={
                    <TableEmptyState
                      title="No fields"
                      description="This revision has no fields."
                    />
                  }
                />
              )}
              {shownTab === "scopes" && inAdministration && (
                <DataTable
                  rows={content?.roleScopes ?? []}
                  getRowKey={(row) => row.roleId}
                  columns={scopeColumns}
                  emptyState={
                    <TableEmptyState
                      title="No role scopes"
                      description="No role may run this revision."
                    />
                  }
                />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Button
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap touch-manipulation"
              onClick={parent.onClick}
            >
              Back
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
