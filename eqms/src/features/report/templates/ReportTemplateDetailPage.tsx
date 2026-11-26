import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { Button } from "@/components/ui/button/Button";
import {
  DataTable,
  useCustomColumnLayout,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { comingFrom } from "../shared/reportRevisionParent";
import { ReportTemplateRevisions } from "./ReportTemplateRevisions";
import { ReportRevisionStepper } from "../shared/ReportRevisionStepper";
import { ReportTemplateUpgradeModal } from "./ReportTemplateUpgradeModal";
import { ReportTemplateReasonModal } from "./ReportTemplateReasonModal";
import { useReportTemplateCapabilities } from "./useReportTemplateCapabilities";
import {
  codeLabel,
  humanize,
  reportRevisionLabel,
} from "../shared/reportLabels";
import { ReadonlyField } from "../shared/ReadonlyField";
import { displayDateTime } from "@/utils/format";
import {
  reportTemplatesApi,
  reportError,
  type ReportTemplate,
} from "@/services/api/reportTemplates";
import { tr, getCatalogLanguage } from "@/i18n";

type FieldRow = ReportTemplate["fields"][number];
type ScopeRow = NonNullable<ReportTemplate["roleScopes"]>[number];

const LIFECYCLE: Record<
  string,
  { label: string; color: "emerald" | "amber" | "slate" }
> = {
  ACTIVE: { label: "Active", color: "emerald" },
  PENDING_APPROVAL: { label: tr("Pending Approval"), color: "amber" },
  DRAFT: { label: "Draft", color: "slate" },
  INACTIVE: { label: "Inactive", color: "slate" },
};
const SCOPE_LABEL: Record<string, string> = {
  PERSONAL: "Personal",
  DEPARTMENT: "Department",
  BUSINESS_UNIT: "Business Unit",
  SYSTEM: "Entire system",
};
const when = (value?: string | null) => (value ? displayDateTime(value) : "—");

/**
 * One report template on a page of its own, for the library and for Report Templates. It replaces the Template Details drawer.
 * It shows every field the server returns for the template; the role scopes and the approval state are shown where the viewer may see them.
 */
export function ReportTemplateDetailPage({
  inAdministration = false,
}: {
  inAdministration?: boolean;
}) {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [template, setTemplate] = useState<ReportTemplate>();
  const [error, setError] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [action, setAction] = useState<"disable" | "enable" | "discard">();
  const [activeTab, setActiveTab] = useState("general");
  // What may be done to this template is decided by the server from the viewer's permissions and the state of the template.
  const { can, loaded } = useReportTemplateCapabilities(
    code,
    template
      ? `${template.definitionVersion}|${template.active}|${template.effectiveRevision}|${template.openRevision}|${template.openRevisionStatus}`
      : "",
  );
  // The row menu of All Revisions opens the page with ?action=upgrade: the dialog of Upgrade opens at once, when the server lets this person upgrade, and the address is cleaned.
  const [searchParams, setSearchParams] = useSearchParams();
  const upgradeRequested = searchParams.get("action") === "upgrade";
  useEffect(() => {
    if (!upgradeRequested || !template || !inAdministration || !loaded) return;
    if (can("upgrade")) setUpgrading(true);
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradeRequested, template, inAdministration, loaded]);

  useEffect(() => {
    let alive = true;
    setTemplate(undefined);
    setError("");
    const load = inAdministration
      ? reportTemplatesApi.detail(code)
      : reportTemplatesApi
          .list(
            { search: code, page: 1, sortBy: "displayName", direction: "asc" },
            false,
          )
          .then((page) => {
            const found = page.data.find((item) => item.code === code);
            if (!found) throw new Error("REPORT_TEMPLATE_NOT_FOUND");
            return found;
          });
    load
      .then((value) => alive && setTemplate(value))
      .catch((e) => alive && setError(reportError(e)));
    return () => {
      alive = false;
    };
  }, [code, inAdministration]);

  const parent = inAdministration
    ? {
        label: tr("Report Templates"),
        onClick: () => navigate(ROUTES.REPORT.TEMPLATE_MANAGEMENT),
      }
    : { label: tr("Report Library"), onClick: () => navigate("/report/templates") };
  // The library page is for someone who runs the report; the page of the template is for someone who makes it.
  const title = inAdministration ? tr("Report Template Details") : tr("Report Details");

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
    { id: "type", header: "Type", cell: (row) => row.type },
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
      header: tr("Data scope"),
      cell: (row) => SCOPE_LABEL[row.scope] ?? row.scope,
    },
  ];
  const { layout: scopeLayout, control: scopeControl } = useCustomColumnLayout(
    "reportTemplateScopes",
    scopeColumns,
  );

  // The same tab layout as the Document details page; the Audit Trail is a tab and shows the entries of this template only.
  const tabs = useMemo<TabItem[]>(() => {
    const list: TabItem[] = [{ id: "general", label: tr("General Information") }];
    list.push({
      id: "fields",
      label: "Fields",
      count: template?.fields.length,
    });
    if (inAdministration)
      list.push({
        id: "scopes",
        label: tr("Role Scopes"),
        count: template?.roleScopes?.length ?? 0,
      });
    if (can("viewAuditTrail") && template?.auditEntityId)
      list.push({ id: "audit", label: tr("Audit Trail") });
    return list;
  }, [can, inAdministration, template, getCatalogLanguage()]);
  const shownTab = tabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "general";

  const lifecycle = template
    ? LIFECYCLE[
        template.lifecycleStatus ?? (template.active ? "ACTIVE" : "INACTIVE")
      ]
    : undefined;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, false, parent)}
        actions={
          <>
            <Button
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap touch-manipulation"
              onClick={parent.onClick}
            >
              {tr("Back")}</Button>
            {template &&
              inAdministration &&
              (can("disable") || can("enable")) && (
                <Button
                  size="sm"
                  variant="outline-emerald"
                  className="whitespace-nowrap touch-manipulation"
                  onClick={() =>
                    setAction(can("disable") ? "disable" : "enable")
                  }
                >
                  {can("disable")
                    ? tr("Disable Report Template")
                    : tr("Enable Report Template")}
                </Button>
              )}
            {template && inAdministration && can("discardRevision") && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap touch-manipulation"
                onClick={() => setAction("discard")}
              >
                {tr("Discard Revision")}</Button>
            )}
            {template && inAdministration && can("upgrade") && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap touch-manipulation"
                onClick={() => setUpgrading(true)}
              >
                {tr("Upgrade Report Template")}</Button>
            )}
            {template && inAdministration && can("edit") && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap touch-manipulation"
                onClick={() =>
                  navigate(
                    `${ROUTES.REPORT.TEMPLATE_MANAGEMENT}/${encodeURIComponent(template.code)}`,
                    comingFrom(location.pathname),
                  )
                }
              >
                {tr("Edit Report Template")}
              </Button>
            )}
            {template && !inAdministration && can("createReport") && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap touch-manipulation"
                onClick={() =>
                  navigate(
                    `/report/templates/${encodeURIComponent(template.code)}/run`,
                  )
                }
              >
                {tr("Create Report")}</Button>
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
      {!template ? (
        error ? null : (
          <SectionLoading text="Loading report template…" />
        )
      ) : (
        <>
          {/* Where the revision that matters stands, as for a document. */}
          {inAdministration && <ReportRevisionStepper workflow={template.workflow} />}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <TabNav
              tabs={tabs}
              activeTab={shownTab}
              onChange={setActiveTab}
              layoutId="report-template-detail-tab"
            />
            <div className="space-y-4 p-4 md:p-5">
              {shownTab === "general" && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <ReadonlyField
                    label={tr("Created Time")}
                    value={when(template.createdAt)}
                  />
                  <ReadonlyField
                    label={tr("Last Updated")}
                    value={when(template.updatedAt)}
                  />
                  <ReadonlyField
                    label={tr("Report Template Name")}
                    value={template.displayName}
                  />
                  <ReadonlyField
                    label={tr("Report Template Number")}
                    value={template.code}
                  />
                  <ReadonlyField
                    label={tr("Report Type")}
                    value={humanize(template.sourceCode)}
                  />
                  <ReadonlyField
                    label="Status"
                    value={
                      lifecycle?.label ??
                      (template.active ? "Active" : "Disabled")
                    }
                  />
                  <ReadonlyField
                    label={tr("Effective Revision")}
                    value={
                      template.effectiveRevision != null
                        ? reportRevisionLabel(template.effectiveRevision)
                        : "None yet"
                    }
                  />
                  {/* A revision still being written is for the people who make the template; someone who runs the report sees only what is in force. */}
                  {inAdministration ? (
                    <ReadonlyField
                      label={tr("Revision In Progress")}
                      value={
                        template.openRevision != null
                          ? `${reportRevisionLabel(template.openRevision, template.openRevisionStatus ?? "DRAFT")} · ${template.openRevisionStatus === "PENDING_APPROVAL" ? tr("Pending Approval") : "Draft"}`
                          : "—"
                      }
                    />
                  ) : (
                    <ReadonlyField
                      label={template.approvalBasis === "NOT_REQUIRED" ? tr("In Use Since") : tr("Approved On")}
                      value={when(template.approvalBasis === "NOT_REQUIRED" ? template.inUseSince : template.approvedAt)}
                    />
                  )}
                  <ReadonlyField
                    label={tr("Classification")}
                    value={humanize(template.classification)}
                  />
                  <ReadonlyField
                    label={tr("Template Category")}
                    value={humanize(template.category)}
                  />
                  <ReadonlyField
                    label={tr("Output Formats")}
                    value={template.allowedFormats.join(" · ")}
                  />
                  <ReadonlyField
                    label={tr("Page Orientation")}
                    value={
                      template.layout?.orientation === "PORTRAIT"
                        ? "Portrait"
                        : "Landscape"
                    }
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-slate-700 sm:text-sm">
                      {tr("Used For GMP Decisions?")}
                    </label>
                    <Checkbox
                      id="gmpUse"
                      checked={Boolean(template.gmpUse)}
                      disabled
                      aria-label={tr("Used for GMP decisions")}
                    />
                  </div>
                  {inAdministration && (
                    <>
                      {/* What happened to the revision in force: a person approved it, or it came into force when saved. */}
                      <ReadonlyField
                        label={tr("Approval State")}
                        value={template.approvalBasis === "NOT_REQUIRED" ? tr("Not required (in force when saved, under the earlier rule)") : codeLabel(template.approvalStatus)}
                      />
                      <ReadonlyField
                        label={tr("Approved Version")}
                        value={
                          template.approvedVersion != null
                            ? `v${template.approvedVersion}`
                            : "—"
                        }
                      />
                      <ReadonlyField
                        label={tr("Approved On")}
                        value={when(template.approvedAt)}
                      />
                      <ReadonlyField
                        label={tr("Submitted Version")}
                        value={
                          template.submittedVersion != null
                            ? `v${template.submittedVersion}`
                            : "—"
                        }
                      />
                      <ReadonlyField
                        label={tr("Submitted On")}
                        value={when(template.submittedAt)}
                      />
                      <ReadonlyField
                        label={tr("Last Review Comment")}
                        value={template.approvalComment ?? "—"}
                      />
                    </>
                  )}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs font-medium text-slate-700 sm:text-sm">
                      {tr("Description")}
                    </label>
                    <textarea
                      value={template.description || "No description."}
                      rows={4}
                      readOnly
                      className={CONTROL_STATE_CLASSES.readonlyTextarea}
                    />
                  </div>
                </div>
              )}
              {shownTab === "fields" && (
                <>
                  <div>
                    <DataTable
                      rows={template.fields}
                      getRowKey={(row) => row.code}
                      columns={fieldColumns}
                      emptyState={
                        <TableEmptyState
                          title="No fields"
                          description={tr("This template has no fields.")}
                        />
                      }
                    />
                  </div>
                </>
              )}
              {shownTab === "scopes" && inAdministration && (
                <>
                  <div>
                    <div className="mb-2 flex justify-end">{scopeControl}</div>
                    <DataTable
                      rows={template.roleScopes ?? []}
                      getRowKey={(row) => row.roleId}
                      columns={scopeColumns}
                      columnLayout={scopeLayout}
                      emptyState={
                        <TableEmptyState
                          title={tr("No role scopes")}
                          description={tr("No role may run this template yet.")}
                        />
                      }
                    />
                  </div>
                </>
              )}
              {shownTab === "audit" &&
                can("viewAuditTrail") &&
                template.auditEntityId && (
                  <AuditTrailTab
                    entityId={template.auditEntityId}
                    entityType="REPORT_DEFINITION"
                    documentNumber={template.code}
                  />
                )}
            </div>
          </div>
          {/* Footer actions, then the sub-tab card, as in the Document details */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Button
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap touch-manipulation"
              onClick={parent.onClick}
            >
              {tr("Back")}</Button>
            {!inAdministration && can("createReport") && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap touch-manipulation"
                onClick={() =>
                  navigate(
                    `/report/templates/${encodeURIComponent(template.code)}/run`,
                  )
                }
              >
                {tr("Create Report")}</Button>
            )}
          </div>
          {inAdministration && shownTab === "general" && can("viewRevisions") && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <TabNav
                tabs={[{ id: "revisions", label: "Revisions" }]}
                activeTab="revisions"
                onChange={() => undefined}
                variant="simple-underline"
              />
              <div className="p-4 md:p-5">
                <ReportTemplateRevisions
                  code={template.code}
                  inAdministration={inAdministration}
                />
              </div>
            </div>
          )}
          <ReportTemplateReasonModal
            isOpen={action === "disable" || action === "enable"}
            title={
              action === "enable"
                ? tr("Enable Report Template")
                : tr("Disable Report Template")
            }
            description={
              action === "enable"
                ? tr("The template can be used again at once, with its effective revision.")
                : tr("The template stops at once: no report can be made from it and its schedules cannot run. Reports already made are kept. The change is recorded in the audit trail.")
            }
            confirmText={action === "enable" ? "Enable" : "Disable"}
            reasonRequired={false}
            onClose={() => setAction(undefined)}
            onConfirm={async (reason) => {
              setTemplate(
                await reportTemplatesApi.setEnabled(
                  template.code,
                  action === "enable",
                  reason,
                ),
              );
              setAction(undefined);
            }}
          />
          <ReportTemplateReasonModal
            isOpen={action === "discard"}
            title={tr("Discard Revision")}
            description={`Revision ${reportRevisionLabel(template.openRevision, "DRAFT")} is discarded and stays on record as Discarded. Revision ${reportRevisionLabel(template.effectiveRevision)} remains the effective revision.`}
            confirmText="Discard"
            reasonRequired
            onClose={() => setAction(undefined)}
            onConfirm={async (reason) => {
              setTemplate(
                await reportTemplatesApi.discardRevision(
                  template.code,
                  template.definitionVersion,
                  reason,
                ),
              );
              setAction(undefined);
            }}
          />
          <ReportTemplateUpgradeModal
            template={template}
            isOpen={upgrading}
            onClose={() => setUpgrading(false)}
            onUpgraded={() =>
              navigate(
                `${ROUTES.REPORT.TEMPLATE_MANAGEMENT}/${encodeURIComponent(template.code)}`,
                comingFrom(location.pathname),
              )
            }
          />
        </>
      )}
    </div>
  );
}
