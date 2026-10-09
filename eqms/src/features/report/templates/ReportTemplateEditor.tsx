import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { DataTable } from "@/components/ui/table/DataTable";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import { reportsApi, type ReportFormat } from "@/services/api/reports";
import { ReportLayoutDesigner } from "./ReportLayoutDesigner";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { defaultReportLayout } from "@/services/api/reportTemplates";
import {
  reportTemplatesApi,
  reportError,
  type ReportTemplate,
  type ReportSource,
  type ReportRole,
  type TemplateWrite,
  type MetadataScope,
} from "@/services/api/reportTemplates";

const tabs = [
  { id: "general", label: "General" },
  { id: "fields", label: "Fields & Defaults" },
  { id: "layout", label: "Layout Designer" },
  { id: "scope", label: "Access & Scope" },
  { id: "history", label: "History" },
];
const scopes = [
  { value: "", label: "No access" },
  { value: "PERSONAL", label: "Personal" },
  { value: "DEPARTMENT", label: "Department" },
  { value: "BUSINESS_UNIT", label: "Business Unit" },
  { value: "SYSTEM", label: "Entire system" },
];
const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50";
export function ReportTemplateEditor() {
  const { code = "new" } = useParams();
  const create = code === "new";
  const navigate = useNavigate();
  const { hasAnyPermission } = usePermissions();
  const editable = hasAnyPermission([
    "reports.definition.manage",
    "settings.configuration.manage",
  ]);
  const [tab, setTab] = useState("general");
  const [sources, setSources] = useState<ReportSource[]>([]);
  const [roles, setRoles] = useState<ReportRole[]>([]);
  const [value, setValue] = useState<TemplateWrite>();
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<
    Array<{
      version: number;
      reason: string;
      changedByUserId: string;
      createdAt: string;
    }>
  >([]);
  const [retention, setRetention] = useState<string | null>(null);
  const drag = useTableDragScroll();
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      create ? Promise.resolve(null) : reportTemplatesApi.detail(code),
      editable ? reportTemplatesApi.sources() : Promise.resolve([]),
      editable ? reportTemplatesApi.roles() : Promise.resolve([]),
    ])
      .then(([definition, sources, roles]) => {
        if (!alive) return;
        setSources(sources);
        setRoles([
          ...roles,
          ...(definition?.roleScopes ?? [])
            .filter((grant) => !roles.some((role) => role.id === grant.roleId))
            .map((grant) => ({
              id: grant.roleId,
              name: `${grant.roleName ?? grant.roleId} (inactive — remove assignment)`,
              code: "",
            })),
        ]);
        setRetention(definition?.retentionPolicyId ?? null);
        const source =
          sources.find((item) => item.code === definition?.sourceCode) ??
          sources[0];
        const fields = source
          ? Object.entries(source.fields).map(([field]) => {
              const existing = definition?.fields.find(
                (item) => item.code === field,
              );
              const required = source.requiredFields.includes(field);
              return {
                code: field,
                allowed: existing?.allowed ?? create,
                defaultSelected: existing?.defaultSelected ?? create,
                required: existing?.required || required,
              };
            })
          : (definition?.fields ?? []);
        setValue({
          version: definition?.definitionVersion,
          sourceCode: definition?.sourceCode ?? source?.code ?? "",
          displayName: definition?.displayName ?? "",
          description: definition?.description ?? "",
          active: definition?.active ?? true,
          formats: definition?.allowedFormats ?? ["PDF", "XLSX", "CSV"],
          fields,
          roleScopes: definition?.roleScopes ?? [],
          layout: definition?.layout ?? defaultReportLayout(),
          reason: "",
        });
      })
      .catch((error) => {
        if (alive) setError(reportError(error));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [code, create, editable]);
  useEffect(() => {
    if (tab !== "history" || create) return;
    let alive = true;
    reportsApi
      .definitionHistory(code)
      .then((data) => {
        if (alive) setHistory(data);
      })
      .catch((error) => {
        if (alive) setError(reportError(error));
      });
    return () => {
      alive = false;
    };
  }, [tab, code, create, notice]);
  const change = (update: Partial<TemplateWrite>) =>
    setValue((current) => (current ? { ...current, ...update } : current));
  const source = sources.find((item) => item.code === value?.sourceCode);
  const save = async () => {
    if (!value) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await reportTemplatesApi.save(
        create ? newCode : code,
        value,
        create,
      );
      if (create) {
        navigate(`/settings/report-configuration/${saved.code}`, {
          replace: true,
        });
        return;
      }
      setValue({ ...value, version: saved.definitionVersion, reason: "" });
      setNotice(
        `Changes saved. Template version ${saved.definitionVersion} is now active for subsequent report requests.`,
      );
    } catch (error) {
      setError(reportError(error));
    } finally {
      setSaving(false);
    }
  };
  const fieldChange = (
    field: string,
    update: Partial<TemplateWrite["fields"][number]>,
  ) =>
    value &&
    change({
      fields: value.fields.map((item) =>
        item.code === field ? { ...item, ...update } : item,
      ),
    });
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        title={create ? "New Report Template" : "Report Template Configuration"}
        breadcrumbItems={reportBreadcrumbs(
          navigate,
          create ? "New Report Template" : "Report Template Configuration",
          true,
          {
            label: "Report Definitions",
            onClick: () => navigate("/settings/report-configuration"),
          },
        )}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => navigate("/settings/report-configuration")}
            >
              Back
            </Button>
            {editable && (
              <Button
                size="sm"
                loading={saving}
                disabled={
                  !value?.reason.trim() ||
                  !value.displayName.trim() ||
                  !value.sourceCode ||
                  (create && !newCode.trim())
                }
                onClick={() => void save()}
              >
                Save Changes
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
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-slate-500">
          Loading template configuration…
        </p>
      ) : (
        value && (
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <TabNav
              tabs={tabs.filter((item) => !create || item.id !== "history")}
              activeTab={tab}
              onChange={setTab}
              variant="underline"
              ariaLabel="Report template configuration"
            />
            <fieldset
              disabled={!editable || saving}
              className="min-w-0 p-4 md:p-5"
            >
              {tab === "layout" && (
                <ReportLayoutDesigner
                  value={value.layout ?? defaultReportLayout()}
                  title={value.displayName}
                  disabled={!editable || saving}
                  fields={value.fields
                    .filter((f) => f.allowed)
                    .map((f) => ({
                      code: f.code,
                      name: source?.fields[f.code] ?? f.code,
                      type: source?.dateFields?.includes(f.code)
                        ? "DATE"
                        : "TEXT",
                    }))}
                  onChange={(layout) => change({ layout })}
                />
              )}
              {tab === "general" && (
                <FormSection
                  title="Template Information"
                  description="Choose the data source and name used to identify this report template."
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Template code
                      <Input
                        className={inputClass}
                        disabled={!create}
                        value={create ? newCode : code}
                        maxLength={80}
                        onChange={(event) =>
                          setNewCode(event.target.value.toUpperCase())
                        }
                        placeholder="DOCUMENT_REGISTER_QA"
                      />
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        Stable identifier: uppercase letters, numbers and
                        underscores.
                      </span>
                    </label>
                    <Select
                      label="Metadata source"
                      value={value.sourceCode}
                      disabled={!create}
                      options={
                        sources.length
                          ? sources.map((item) => ({
                              value: item.code,
                              label: item.name,
                            }))
                          : [
                              {
                                value: value.sourceCode,
                                label: value.sourceCode,
                              },
                            ]
                      }
                      onChange={(id) => {
                        const source = sources.find(
                          (item) => item.code === String(id),
                        );
                        if (source)
                          change({
                            sourceCode: source.code,
                            fields: Object.keys(source.fields).map((field) => ({
                              code: field,
                              allowed: true,
                              defaultSelected: true,
                              required: source.requiredFields.includes(field),
                            })),
                          });
                      }}
                    />
                    <label className="text-sm font-medium text-slate-700">
                      Display name
                      <Input
                        className={inputClass}
                        value={value.displayName}
                        maxLength={255}
                        onChange={(event) =>
                          change({ displayName: event.target.value })
                        }
                      />
                    </label>
                    <Checkbox
                      label="Template active"
                      checked={value.active}
                      onChange={(active) => change({ active })}
                    />
                    <label className="text-sm font-medium text-slate-700 md:col-span-2">
                      Description
                      <Textarea
                        rows={3}
                        className={inputClass}
                        maxLength={2000}
                        value={value.description}
                        onChange={(event) =>
                          change({ description: event.target.value })
                        }
                      />
                    </label>
                    <div className="md:col-span-2">
                      <p className="mb-3 text-sm font-medium text-slate-700">
                        Allowed output formats
                      </p>
                      <div className="flex flex-wrap gap-5">
                        {(["PDF", "XLSX", "CSV"] as ReportFormat[]).map(
                          (format) => (
                            <Checkbox
                              key={format}
                              label={format}
                              checked={value.formats.includes(format)}
                              onChange={(checked) =>
                                change({
                                  formats: checked
                                    ? [...value.formats, format]
                                    : value.formats.filter(
                                        (item) => item !== format,
                                      ),
                                })
                              }
                            />
                          ),
                        )}
                      </div>
                    </div>
                    {!create && (
                      <p className="text-xs text-slate-500 md:col-span-2">
                        Existing retention policy is preserved:{" "}
                        {retention ?? "permanent retention"}. Template changes
                        never delete historical report files or audit records.
                      </p>
                    )}
                  </div>
                </FormSection>
              )}
              {tab === "fields" && (
                <DataTable
                  rows={value.fields}
                  getRowKey={(row) => row.code}
                  scrollerRef={drag.scrollerRef}
                  scrollProps={drag.dragEvents}
                  isDragging={drag.isDragging}
                  columns={[
                    {
                      id: "no",
                      header: "No.",
                      cell: (_row, index) => index + 1,
                    },
                    {
                      id: "name",
                      header: "Column",
                      cell: (row) => source?.fields[row.code] ?? row.code,
                    },
                    {
                      id: "allowed",
                      header: "Allowed",
                      cell: (row) => (
                        <Checkbox
                          label={`Allow ${source?.fields[row.code] ?? row.code}`}
                          labelClassName="sr-only"
                          checked={row.allowed}
                          disabled={
                            source?.requiredFields.includes(row.code) ||
                            row.required
                          }
                          onChange={(allowed) =>
                            fieldChange(row.code, {
                              allowed,
                              defaultSelected: allowed && row.defaultSelected,
                            })
                          }
                        />
                      ),
                    },
                    {
                      id: "default",
                      header: "Default",
                      cell: (row) => (
                        <Checkbox
                          label={`Default ${row.code}`}
                          labelClassName="sr-only"
                          checked={row.defaultSelected || row.required}
                          disabled={row.required || !row.allowed}
                          onChange={(defaultSelected) =>
                            fieldChange(row.code, { defaultSelected })
                          }
                        />
                      ),
                    },
                    {
                      id: "required",
                      header: "Required",
                      cell: (row) => (
                        <Checkbox
                          label={`Require ${row.code}`}
                          labelClassName="sr-only"
                          checked={row.required}
                          disabled={
                            source?.requiredFields.includes(row.code) ||
                            !row.allowed
                          }
                          onChange={(required) =>
                            fieldChange(row.code, {
                              required,
                              defaultSelected: required || row.defaultSelected,
                            })
                          }
                        />
                      ),
                    },
                  ]}
                />
              )}
              {tab === "scope" && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-800">
                    Report metadata scope is independent of source-document
                    access. A role without an assignment has no access to this
                    template. Active role grants are combined; the broadest
                    applicable scope wins. Entire system includes metadata
                    outside the user's department, but never file content.
                  </div>
                  <DataTable
                    rows={
                      editable
                        ? roles
                        : value.roleScopes.map((grant) => ({
                            id: grant.roleId,
                            name: grant.roleName ?? grant.roleId,
                            code: "",
                          }))
                    }
                    getRowKey={(row) => row.id}
                    columns={[
                      {
                        id: "role",
                        header: "Active role / Access Profile",
                        cell: (row) => row.name,
                      },
                      {
                        id: "scope",
                        header: "Metadata scope",
                        cell: (row) => (
                          <div className="min-w-48">
                            <Select
                              value={
                                value.roleScopes.find(
                                  (grant) => grant.roleId === row.id,
                                )?.scope ?? ""
                              }
                              enableSearch={false}
                              options={scopes}
                              onChange={(scope) =>
                                change({
                                  roleScopes: [
                                    ...value.roleScopes.filter(
                                      (grant) => grant.roleId !== row.id,
                                    ),
                                    ...(scope
                                      ? [
                                          {
                                            roleId: row.id,
                                            scope: scope as MetadataScope,
                                          },
                                        ]
                                      : []),
                                  ],
                                })
                              }
                            />
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              )}
            </fieldset>
            {tab === "history" && (
              <div className="p-4 md:p-5">
                <DataTable
                  rows={history}
                  getRowKey={(row) => row.version}
                  columns={[
                    {
                      id: "version",
                      header: "Version",
                      cell: (row) => `v${row.version}`,
                    },
                    {
                      id: "reason",
                      header: "Change reason",
                      cell: (row) => row.reason,
                      cellClassName: "whitespace-normal min-w-56",
                    },
                    {
                      id: "actor",
                      header: "Changed by",
                      cell: (row) => row.changedByUserId,
                    },
                    {
                      id: "date",
                      header: "Changed at",
                      cell: (row) => new Date(row.createdAt).toLocaleString(),
                    },
                  ]}
                />
              </div>
            )}
            {editable && tab === "general" && (
              <label className="block border-t border-slate-100 p-4 text-sm font-medium text-slate-700 md:p-5">
                Change reason <span className="text-red-600">*</span>
                <Textarea
                  className={inputClass}
                  rows={2}
                  maxLength={1000}
                  disabled={saving}
                  value={value.reason}
                  onChange={(event) => change({ reason: event.target.value })}
                  placeholder="Explain why this configuration is changing"
                />
              </label>
            )}
          </div>
        )
      )}
    </div>
  );
}
