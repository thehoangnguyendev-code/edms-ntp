import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select } from "@/components/ui/select/Select";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { cn } from "@/components/ui/utils";
import { DataTable } from "@/components/ui/table/DataTable";
import { useTableDragScroll } from "@/hooks/useTableDragScroll";
import { usePermissions } from "@/hooks/usePermissions";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { reportsApi, type ReportFormat } from "@/services/api/reports";
import { ReportChartsEditor } from "./ReportChartsEditor";
import { ReportTemplateUpgradeModal } from "./ReportTemplateUpgradeModal";
import { useReportTemplateCapabilities } from "./useReportTemplateCapabilities";
import { ReportRevisionStepper, latestRevisionStatus } from "../shared/ReportRevisionStepper";
import { ReportTemplateAccessScope } from "./ReportTemplateAccessScope";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { defaultReportLayout } from "@/services/api/reportTemplates";
import { displayDateTime } from "@/utils/format";
import {
  reportTemplatesApi,
  reportError,
  type ReportTemplate,
  type ReportSource,
  type TemplateWrite,
  type MetadataScope,
  type ReportLifecycleStatus,
} from "@/services/api/reportTemplates";
import {
  reportNameFormatsApi,
  type ReportNameFormat,
  type ReportNameFormatListItem,
} from "@/services/api/reportNameFormats";

type RoleGrant = NonNullable<ReportTemplate["roleScopes"]>[number];
const tabs = [
  { id: "general", label: "General" },
  { id: "fields", label: "Fields & Defaults" },
  { id: "charts", label: "Charts" },
  { id: "scope", label: "Access & Scope" },
  { id: "history", label: "History" },
];
const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50";
/** The name as the server will build it (it builds it again on save). Empty until every input part has a value. */
function composeName(format: ReportNameFormat, values: Record<string, string>): string {
  const pieces: string[] = [];
  for (const part of format.parts) {
    if (part.type === "FIXED") {
      pieces.push(part.fixedText ?? "");
      continue;
    }
    const text = (values[String(part.order)] ?? "").trim();
    if (!text) return "";
    pieces.push(text);
  }
  return pieces.join(format.separator);
}

const LIFECYCLE_LABEL: Record<ReportLifecycleStatus, string> = {
  DRAFT: "Draft. Not approved, cannot run.",
  ACTIVE: "Active. Can run.",
  INACTIVE: "Inactive. Cannot run.",
  PENDING_APPROVAL: "Pending Approval. Cannot run yet.",
};

/** Where the current version stands in the approval flow, and the steps the user may take (REPORT-TEMPLATE-APPROVAL-2026-10-14). */
function ApprovalPanel({
  stored,
  gmpUse,
  dirty,
  busy,
  canSubmit,
  canDecide,
  onSubmit,
  onApprove,
  onReject,
}: {
  stored: ReportTemplate;
  gmpUse: boolean;
  dirty: boolean;
  busy: boolean;
  canSubmit: boolean;
  canDecide: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const status = stored.lifecycleStatus ?? "DRAFT";
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            Revision {stored.revision ?? stored.definitionVersion}: {LIFECYCLE_LABEL[status]}
            {gmpUse ? " Used for GMP decisions." : ""}
          </p>
          {(status === "ACTIVE" || status === "INACTIVE") && stored.approvedAt && (
            <p className="mt-1 text-xs">
              Approved version {stored.approvedVersion} on {displayDateTime(stored.approvedAt)}.
            </p>
          )}
          {status === "DRAFT" && stored.approvalComment && (
            <p className="mt-1 text-xs">Returned for changes: {stored.approvalComment}</p>
          )}
          {dirty && (
            <p className="mt-1 text-xs">Save your changes first. A saved change returns the template to draft.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" && canSubmit && (
            <Button size="sm" variant="outline-emerald" disabled={busy || dirty} onClick={onSubmit}>
              Submit for Approval
            </Button>
          )}
          {status === "PENDING_APPROVAL" && canDecide && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onReject}>
              Return to Draft
            </Button>
          )}
          {status === "PENDING_APPROVAL" && canDecide && (
            <Button size="sm" variant="outline-emerald" disabled={busy} onClick={onApprove}>
              Complete Approval
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReportTemplateEditor() {
  const { code = "new" } = useParams();
  const create = code === "new";
  const navigate = useNavigate();
  const { hasAnyPermission } = usePermissions();
  // A permission of the person: used to load the lists a template is written from, and to author a new template (there is no template yet to ask about).
  const canAuthor = hasAnyPermission([
    "reports.definition.manage",
    "settings.configuration.manage",
  ]);
  const [tab, setTab] = useState("general");
  const [sources, setSources] = useState<ReportSource[]>([]);
  const [value, setValue] = useState<TemplateWrite>();
  /** The template as stored, to tell a change of meaning from a change of name (REPORT-DEFINITION-SIGNATURE-2026-10-14). */
  const [baseline, setBaseline] = useState<TemplateWrite>();
  const [signing, setSigning] = useState(false);
  /** The template as the server last returned it: approval state and version (REPORT-TEMPLATE-APPROVAL-2026-10-14). */
  const [stored, setStored] = useState<ReportTemplate | null>(null);
  // For an existing template, what may be done comes from the server: the permission of the person, the state of the template and the actor of the revision.
  const capabilityKey = stored ? `${stored.definitionVersion}|${stored.approvalStatus}|${stored.effectiveRevision}|${stored.openRevision}|${stored.active}` : "";
  const { can, reason: reasonOf, loaded: capabilitiesLoaded } = useReportTemplateCapabilities(create ? "" : code, capabilityKey);
  const editable = create ? canAuthor : can("edit");
  /** A revision that is effective is not edited; Upgrade starts the next revision (REPORT-TEMPLATE-REVISION-2026-10-14). */
  const locked = !create && capabilitiesLoaded && !editable && reasonOf("edit") === "REPORT_UPGRADE_REQUIRED";
  const [upgrading, setUpgrading] = useState(false);
  const [nameFormat, setNameFormat] = useState<ReportNameFormat>();
  const [approving, setApproving] = useState<{ reason: string; step: "form" | "sign" }>();
  const [rejecting, setRejecting] = useState<{ reason: string; step: "form" | "sign" }>();
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
  const drag = useTableDragScroll();
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      create ? Promise.resolve(null) : reportTemplatesApi.detail(code),
      canAuthor ? reportTemplatesApi.sources() : Promise.resolve([]),
    ])
      .then(([definition, sources]) => {
        if (!alive) return;
        setSources(sources);
        const source =
          sources.find((item) => item.code === definition?.sourceCode) ??
          sources[0];
        const fields = source
          ? Object.entries(source.fields).map(([field]) => {
              const existing = definition?.fields.find(
                (item: ReportTemplate["fields"][number]) => item.code === field,
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
        const loaded: TemplateWrite = {
          version: definition?.definitionVersion,
          sourceCode: definition?.sourceCode ?? source?.code ?? "",
          displayName: definition?.displayName ?? "",
          description: definition?.description ?? "",
          active: definition?.active ?? true,
          formats: definition?.allowedFormats ?? ["PDF", "XLSX", "CSV"],
          fields,
          roleScopes: definition?.roleScopes ?? [],
          layout: definition?.layout ?? defaultReportLayout(),
          gmpUse: definition?.gmpUse ?? false,
          nameFormatId: definition?.nameFormatId ?? null,
          nameValues: definition?.nameValues ?? {},
          reason: "",
        };
        setValue(loaded);
        setBaseline(loaded);
        setStored(definition);
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
  }, [code, create, canAuthor]);
  // A new template is named by the one active Report Name Format; the author does not choose a rule. The server applies it again when the template is saved.
  const activeFormatLoaded = useRef(false);
  useEffect(() => {
    if (!create || !value || activeFormatLoaded.current || value.nameFormatId) return;
    activeFormatLoaded.current = true;
    reportNameFormatsApi
      .list({ status: "ENABLED", limit: 1 })
      .then((page) => {
        const active = page.data[0];
        if (active) setValue((current) => (current && !current.nameFormatId ? { ...current, nameFormatId: active.id, nameValues: {}, displayName: "" } : current));
      })
      .catch(() => undefined);
  }, [create, value]);
  const selectedFormatId = value?.nameFormatId ?? null;
  useEffect(() => {
    if (!selectedFormatId) {
      setNameFormat(undefined);
      return;
    }
    let alive = true;
    reportNameFormatsApi
      .detail(selectedFormatId)
      .then((format) => alive && setNameFormat(format))
      .catch((error) => alive && setError(reportError(error)));
    return () => {
      alive = false;
    };
  }, [selectedFormatId]);
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
  /** Formats, fields and role scopes decide what a report contains and who may see it; name, description and layout do not. */
  const meaningOf = (template: TemplateWrite) =>
    JSON.stringify({
      active: template.active,
      formats: [...template.formats].sort(),
      fields: template.fields
        .map((f) => `${f.code}:${f.allowed}:${f.allowed && (f.defaultSelected || f.required)}:${f.required}`)
        .sort(),
      scopes: template.roleScopes.map((s) => `${s.roleId}:${s.scope}`).sort(),
      gmp: template.gmpUse ?? false,
    });
  const changesMeaning = create || !baseline || !value || meaningOf(baseline) !== meaningOf(value);
  const requestSave = () => {
    if (changesMeaning) setSigning(true);
    else void save();
  };
  const save = async (signatureToken?: string) => {
    if (!value) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await reportTemplatesApi.save(
        code,
        // No separate change reason: the server keeps the description as the reason of the change.
        { ...value, reason: "", signatureToken },
        create,
      );
      if (create) {
        navigate(`/settings/report-configuration/${saved.code}`, {
          replace: true,
        });
        return;
      }
      const next = { ...value, version: saved.definitionVersion, reason: "" };
      setValue(next);
      setBaseline(next);
      setStored(saved);
      setNotice(
        saved.effectiveRevision != null && saved.openRevision != null
          ? `Changes saved to Revision ${saved.openRevision}. Revision ${saved.effectiveRevision} stays in use until Revision ${saved.openRevision} is approved.`
          : "Changes saved.",
      );
    } catch (error) {
      setError(reportError(error));
    } finally {
      setSaving(false);
    }
  };
  /** Runs one approval-flow step on the stored version and shows the server's answer (REPORT-TEMPLATE-APPROVAL-2026-10-14). */
  const flowStep = async (
    step: () => Promise<ReportTemplate>,
    done: string,
  ) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await step();
      setStored(updated);
      setNotice(done);
    } catch (error) {
      setError(reportError(error));
    } finally {
      setSaving(false);
    }
  };
  const submitVersion = () => {
    if (!stored) return;
    void flowStep(
      () => reportTemplatesApi.submitForApproval(code, stored.definitionVersion, ""),
      `Revision ${stored.revision ?? stored.definitionVersion} is pending approval.`,
    );
  };
  /** Only reached after the reason and the e-signature. */
  const approveVersion = (signatureToken?: string) => {
    if (!stored || !approving || !signatureToken) return;
    const reason = approving.reason.trim();
    setApproving(undefined);
    void flowStep(
      () => reportTemplatesApi.approveTemplate(code, stored.definitionVersion, reason, signatureToken),
      `Revision ${stored.revision ?? stored.definitionVersion} is approved and can run.`,
    );
  };
  /** Only reached after the reason and the e-signature (REPORT-TEMPLATE-APPROVAL-2026-10-14). */
  const rejectVersion = (signatureToken?: string) => {
    if (!stored || !rejecting || !signatureToken) return;
    const reason = rejecting.reason.trim();
    setRejecting(undefined);
    void flowStep(
      () => reportTemplatesApi.rejectTemplate(code, stored.definitionVersion, reason, signatureToken),
      `Revision ${stored.revision ?? stored.definitionVersion} was returned to draft.`,
    );
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
                  !value?.description.trim() ||
                  !value.displayName.trim() ||
                  !value.sourceCode
                }
                onClick={requestSave}
              >
                Save Changes
              </Button>
            )}
          </>
        }
      />
      <FormModal
        isOpen={rejecting?.step === "form"}
        onClose={() => setRejecting(undefined)}
        title="Return to Draft"
        description="The author sees this reason and must change the template and submit it again."
        confirmText="Return to draft"
        confirmDisabled={!rejecting?.reason.trim() || saving}
        onConfirm={() => rejecting && setRejecting({ ...rejecting, step: "sign" })}
      >
        <FormField label="Reason" required>
          <Textarea
            rows={3}
            maxLength={1000}
            value={rejecting?.reason ?? ""}
            onChange={(event) =>
              setRejecting((current) => current && { ...current, reason: event.target.value })
            }
          />
        </FormField>
      </FormModal>
      {stored && (
        <ReportTemplateUpgradeModal
          template={stored}
          isOpen={upgrading}
          onClose={() => setUpgrading(false)}
          onUpgraded={(upgraded) => {
            setUpgrading(false);
            setStored(upgraded);
            setNotice(`Rev ${upgraded.openRevision} started from Rev ${upgraded.effectiveRevision}. Edit it, then submit it for approval.`);
            navigate(0);
          }}
        />
      )}
      <ESignatureModal
        isOpen={rejecting?.step === "sign"}
        onClose={() => setRejecting(undefined)}
        deferConfirm
        onConfirm={(data) => rejectVersion(data.signatureToken)}
        actionTitle={`Return Report Template ${code}, Version ${stored?.definitionVersion ?? ""}, to Draft`}
        meaningDisplayName="Report Template Returned to Draft"
        meaningCode="REPORT_TEMPLATE_REJECTION"
      />
      <FormModal
        isOpen={approving?.step === "form"}
        onClose={() => setApproving(undefined)}
        title="Approve Report Template"
        description="You approve this exact saved version. You must not be its author or the person who submitted it. Say what you checked."
        confirmText="Continue to sign"
        confirmDisabled={!approving?.reason.trim()}
        onConfirm={() => approving && setApproving({ ...approving, step: "sign" })}
      >
        <FormField label="Reason" required>
          <Textarea
            rows={3}
            maxLength={1000}
            value={approving?.reason ?? ""}
            onChange={(event) =>
              setApproving((current) => current && { ...current, reason: event.target.value })
            }
          />
        </FormField>
      </FormModal>
      <ESignatureModal
        isOpen={approving?.step === "sign"}
        onClose={() => setApproving(undefined)}
        deferConfirm
        onConfirm={(data) => approveVersion(data.signatureToken)}
        actionTitle={`Approve Report Template ${code}, Version ${stored?.definitionVersion ?? ""}`}
        meaningDisplayName="Report Template Approved"
        meaningCode="REPORT_TEMPLATE_APPROVAL"
      />
      <ESignatureModal
        isOpen={signing}
        onClose={() => setSigning(false)}
        deferConfirm
        onConfirm={(data) => {
          setSigning(false);
          void save(data.signatureToken);
        }}
        actionTitle={`Save Report Definition ${create ? "(new)" : code}`}
        meaningDisplayName="Report Definition Change"
        meaningCode="REPORT_DEFINITION_CHANGE"
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
          <>
          {/* The same stepper as a document revision: where this revision of the template stands. */}
          <ReportRevisionStepper status={create || !stored ? "DRAFT" : latestRevisionStatus(stored)} />
          {locked && stored && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>
                  Rev {stored.effectiveRevision} is effective and cannot be edited. To change this template, upgrade it: the new revision is written and approved
                  while Rev {stored.effectiveRevision} stays in use, then Rev {stored.effectiveRevision} becomes Obsoleted.
                </p>
                {can("upgrade") && (
                  <Button size="sm" onClick={() => setUpgrading(true)}>
                    Upgrade Report Template
                  </Button>
                )}
              </div>
            </div>
          )}
          {!create && stored && (
            <ApprovalPanel
              stored={stored}
              gmpUse={value.gmpUse ?? false}
              dirty={!!baseline && JSON.stringify(baseline) !== JSON.stringify(value)}
              busy={saving}
              canSubmit={can("submitForApproval")}
              canDecide={can("approve")}
              onSubmit={submitVersion}
              onApprove={() => setApproving({ reason: "", step: "form" })}
              onReject={() => setRejecting({ reason: "", step: "form" })}
            />
          )}
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
              {tab === "charts" && (
                <ReportChartsEditor
                  charts={value.layout?.charts ?? []}
                  disabled={!editable || saving}
                  fields={value.fields
                    .filter((f) => f.allowed)
                    .map((f) => ({
                      code: f.code,
                      name: source?.fields[f.code] ?? f.code,
                      type: source?.dateFields?.includes(f.code) ? "DATE" : "TEXT",
                    }))}
                  onChange={(charts) => change({ layout: { ...(value.layout ?? defaultReportLayout()), charts } })}
                />
              )}
              {tab === "general" && (
                /* Laid out like the General tab of a new document: a plain two-column grid of labelled fields, no section cards. */
                <div className="space-y-4 md:space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                    {/* Template Number (read-only, issued by the system) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-700 sm:text-sm">Template Number</label>
                      <input type="text" readOnly value={create ? "" : code} className={CONTROL_STATE_CLASSES.readonlyField} placeholder="Assigned automatically when saved" />
                    </div>

                    {/* Revision (read-only) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-700 sm:text-sm">Revision</label>
                      <input
                        type="text"
                        readOnly
                        value={create || !stored ? "" : `Rev ${stored.revision ?? stored.openRevision ?? stored.effectiveRevision ?? ""}`}
                        className={CONTROL_STATE_CLASSES.readonlyField}
                        placeholder="Rev 1 when saved"
                      />
                    </div>

                    {/* Created Time (read-only) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-700 sm:text-sm">Created Time</label>
                      <input
                        type="text"
                        readOnly
                        value={stored?.createdAt ? displayDateTime(stored.createdAt) : ""}
                        className={CONTROL_STATE_CLASSES.readonlyField}
                        placeholder="Set when saved"
                      />
                    </div>

                    {/* Last Updated (read-only) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-700 sm:text-sm">Last Updated</label>
                      <input
                        type="text"
                        readOnly
                        value={stored?.updatedAt ? displayDateTime(stored.updatedAt) : ""}
                        className={CONTROL_STATE_CLASSES.readonlyField}
                        placeholder="Set when saved"
                      />
                    </div>

                    {/* Metadata source (Select) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-700 sm:text-sm">
                        Report Type<span className="ml-1 text-red-500">*</span>
                      </label>
                      <Select
                        value={value.sourceCode}
                        disabled={!create}
                        options={
                          sources.length
                            ? sources.map((item) => ({ value: item.code, label: item.name }))
                            : [{ value: value.sourceCode, label: value.sourceCode }]
                        }
                        placeholder="Select a report type..."
                        onChange={(id) => {
                          const source = sources.find((item) => item.code === String(id));
                          if (source)
                            change({
                              sourceCode: source.code,
                              // A scope the new type cannot be given is dropped; the author sets the rest again.
                              roleScopes: value.roleScopes.filter((grant) => !source.allowedScopes?.length || source.allowedScopes.includes(grant.scope)),
                              fields: Object.keys(source.fields).map((field) => ({
                                code: field,
                                allowed: true,
                                defaultSelected: true,
                                required: source.requiredFields.includes(field),
                              })),
                            });
                        }}
                      />
                    </div>

                    {/* What the chosen Report Type reports on */}
                    {sources.find((item) => item.code === value.sourceCode)?.description && (
                      <p className="text-xs text-slate-500 md:col-span-2 -mt-2">
                        {sources.find((item) => item.code === value.sourceCode)?.description}
                      </p>
                    )}

                    {/* Name format (read-only): the active Report Name Format names a new template; a template keeps the format that named it */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-slate-700 sm:text-sm">Name Format</label>
                      <input
                        type="text"
                        readOnly
                        value={nameFormat ? `${nameFormat.name}${create ? " (active)" : ""}` : ""}
                        className={CONTROL_STATE_CLASSES.readonlyField}
                        placeholder={create ? "No active format: type the name" : "No format: the name was typed"}
                      />
                    </div>

                    {/* The parts of the name that are typed, when a name rule is chosen */}
                    {nameFormat &&
                      nameFormat.parts
                        .filter((part) => part.type === "INPUT")
                        .map((part) => (
                          <div key={part.order} className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-slate-700 sm:text-sm">
                              {part.inputLabel}
                              <span className="ml-1 text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              maxLength={part.maxLength ?? 100}
                              value={value.nameValues?.[String(part.order)] ?? ""}
                              onChange={(event) => {
                                const nameValues = { ...(value.nameValues ?? {}), [String(part.order)]: event.target.value };
                                change({ nameValues, displayName: composeName(nameFormat, nameValues) });
                              }}
                              className="h-9 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        ))}

                    {/* Template Name - full width */}
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-xs font-medium text-slate-700 sm:text-sm">
                        Template Name<span className="ml-1 text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={value.displayName}
                        maxLength={255}
                        readOnly={!!nameFormat}
                        onChange={(event) => change({ displayName: event.target.value })}
                        placeholder="Enter template name"
                        className={cn(
                          "h-9 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
                          !!nameFormat && CONTROL_STATE_CLASSES.readonlyField,
                        )}
                      />
                    </div>

                    {/* Use for GMP decisions */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <label htmlFor="gmpUse" className="cursor-pointer text-xs font-medium text-slate-700 sm:text-sm">
                          Use for GMP Decisions?
                        </label>
                        <Checkbox id="gmpUse" checked={value.gmpUse ?? false} onChange={(gmpUse) => change({ gmpUse })} />
                      </div>
                      <p className="text-xs text-slate-500">A template for GMP decisions cannot be deleted; disable it instead.</p>
                    </div>

                    {/* Allowed output formats */}
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-xs font-medium text-slate-700 sm:text-sm">
                        Allowed Output Formats<span className="ml-1 text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-5">
                        {(["PDF", "XLSX", "CSV"] as ReportFormat[]).map((format) => (
                          <Checkbox
                            key={format}
                            label={format}
                            checked={value.formats.includes(format)}
                            onChange={(checked) =>
                              change({ formats: checked ? [...value.formats, format] : value.formats.filter((item) => item !== format) })
                            }
                          />
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-xs font-medium text-slate-700 sm:text-sm">
                        Description<span className="ml-1 text-red-500">*</span>
                      </label>
                      <textarea
                        value={value.description}
                        maxLength={2000}
                        rows={4}
                        onChange={(event) => change({ description: event.target.value })}
                        placeholder="Enter template description"
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  {!create && (
                    <p className="text-xs text-slate-500">
                      Report files are kept permanently and never expire by age. Template changes never delete historical report files or audit records.
                    </p>
                  )}
                </div>
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
                <ReportTemplateAccessScope assignments={value.roleScopes} editable={editable && !saving} onChange={(roleScopes) => change({ roleScopes })} allowedScopes={source?.allowedScopes} />
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
                      cell: (row) => displayDateTime(row.createdAt),
                    },
                  ]}
                />
              </div>
            )}
          </div>
          </>
        )
      )}
    </div>
  );
}
