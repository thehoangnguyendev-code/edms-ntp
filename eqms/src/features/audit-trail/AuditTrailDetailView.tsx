import { formatAuditActionLabel, formatAuditModuleLabel } from "./utils/actionBadge";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, AlertTriangle, ChevronDown, Download, PenLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { auditTrailDetail } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { FormSection } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge/Badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/utils/format";
import { AuditExportModal } from "./components/AuditExportModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { auditTrailApi } from "@/services/api/auditTrail";
import { USER_MANAGEMENT_ROUTES } from "@/features/security-authorization/user-management/constants";
import { ROUTES } from "@/app/routes.constants";
import { formatWorkflowStatusLabel } from "./utils/statusLabel";
import type { AuditTrailDetailRecord, AuditTrailRecord } from "./types";
import { objectHistoryPath } from "./utils/objectHistory";
import { CHANGE_KIND_LABEL, expandChange, formatAuditField, isBlank, isTechnicalField, type ChangeRow } from "./utils/changeRows";
import { TableMarkup } from "@/components/ui/table/TablePrimitives";
import { Collapsible } from "@/components/ui/collapsible";
import { tr, trFormat } from "@/i18n";

/** One label and value of a card, in a <dl>: the label is muted, the value stands out. */
const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid gap-1 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-baseline sm:gap-4">
    <dt className="text-xs text-slate-500 sm:text-sm">{label}</dt>
    <dd className="min-w-0 text-xs font-medium text-slate-900 [overflow-wrap:anywhere] sm:text-sm">{value}</dd>
  </div>
);

const buildEntityLabel = (r: AuditTrailRecord): string => {
  if (r.entityName && r.entityName.trim()) return r.entityName.trim();
  if (r.entityLabel && r.entityLabel.trim()) return r.entityLabel.trim();
  if (r.objectCode && r.objectCode.trim()) return r.objectCode.trim();
  if (r.description && r.description.trim()) return r.description.trim();
  return "System Audit Record";
};

/** The reason the person gave, if any. A description the system wrote is not a reason and is shown on its own. */
const buildReason = (r: AuditTrailRecord): string => (r.reason && r.reason.trim() ? r.reason.trim() : "");

const formatSignatureId = (id?: string | null): string => {
  if (!id || !id.trim()) return "";
  const trimmed = id.trim();
  if (trimmed.startsWith("SIG-") || trimmed.startsWith("ESIG-")) return trimmed;
  const cleaned = trimmed.replace(/-/g, "").toUpperCase();
  return `SIG-${cleaned.substring(0, 8)}`;
};

const isControlledCopyDestroyAction = (r: AuditTrailRecord): boolean => {
  const action = (r.actionType || r.action || "").toString().toUpperCase();
  const module = (r.module || r.entityType || "").toString().toUpperCase();
  return action === "DESTROY" || module === "CONTROLLED_COPY";
};

const getMetadataValue = (metadata: Record<string, any> | undefined, ...keys: string[]): string => {
  if (!metadata) return "";
  for (const key of keys) {
    const val = metadata[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val).trim();
    }
  }
  return "";
};

const toReadableText = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  const str = String(value).trim();
  return str || "-";
};

const BOOLEAN_AUDIT_FIELDS = new Set([
  "active", "enabled", "mandatory", "required", "locked", "read", "deleted",
  "published", "archived", "visible", "internal", "external", "emailenabled",
  "inappenabled", "mfaenabled", "twofactorenabled", "forcepasswordchange",
]);

const isBooleanAuditField = (field?: string | null): boolean => {
  const normalized = String(field || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return BOOLEAN_AUDIT_FIELDS.has(normalized)
    || /^(is|has|can|allow|enable|disable|require|show|hide)/.test(normalized)
    || /(enabled|disabled|mandatory|required|locked|visible|archived|deleted|read)$/.test(normalized);
};

const formatStructuredAuditValue = (value: unknown, field?: string | null): string => {
  if (value === null || value === undefined) return "Not specified";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map((item) => formatStructuredAuditValue(item)).join(", ") : "None";
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length
      ? entries.map(([key, item]) => `${formatAuditField(key)}: ${formatStructuredAuditValue(item, key)}`).join("; ")
      : "None";
  }
  const raw = String(value).trim();
  if (!raw || /^(null|undefined|n\/a)$/i.test(raw) || raw === "-") return "Not specified";
  if (/^(true|false)$/i.test(raw)) return /^true$/i.test(raw) ? "Yes" : "No";
  if (isBooleanAuditField(field) && /^(0|1)$/.test(raw)) return raw === "1" ? "Yes" : "No";
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try { return formatStructuredAuditValue(JSON.parse(raw), field); } catch { /* preserve non-JSON text */ }
  }
  if (/file\s*size|size\s*bytes/i.test(field || "") && /^\d+$/.test(raw)) {
    const bytes = Number(raw);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  if (/(date|time|\bat$)/i.test(field || "")) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime()) && /\d{4}-\d{2}-\d{2}/.test(raw)) return formatDateTime(raw) || raw;
  }
  return raw;
};

const formatAuditChangeValue = (field: string | null | undefined, value: unknown): string => {
  const formatted = formatStructuredAuditValue(value, field);
  return /status|state/i.test(field || "") && formatted !== "Not specified"
    ? formatWorkflowStatusLabel(formatted)
    : formatted;
};

const formatProcessingDuration = (seconds: number): string => {
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  return `${seconds.toFixed(seconds < 10 ? 3 : 2)} sec`;
};

/** A before or after value as a chip; a missing value is a dash. */
const ValueChip: React.FC<{ field: string | null | undefined; value?: string | null; side: "before" | "after" }> = ({ field, value, side }) =>
  isBlank(value) ? (
    <span className="italic text-slate-300">—</span>
  ) : side === "before" ? (
    <span className="break-all rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 line-through sm:text-sm">
      {formatAuditChangeValue(field, value)}
    </span>
  ) : (
    <span className="inline-block break-all rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 sm:text-sm">
      {formatAuditChangeValue(field, value)}
    </span>
  );

const eventLabel = (record: AuditTrailRecord): string =>
  formatAuditActionLabel((record.actionType || record.action || "").toString());

export const AuditTrailDetailView: React.FC<{
  /** Present when embedded by the All Records view; omitted for the standalone route. */
  record?: AuditTrailRecord;
  onBack?: () => void;
}> = ({ record, onBack }) => {
  const navigate = useNavigate();
  const { recordId } = useParams<{ recordId: string }>();
  const resolvedRecordId = record?.id ?? recordId;
  const [detailRecord, setDetailRecord] = useState<AuditTrailDetailRecord | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    let alive = true;
    setIsLoadingDetail(true);
    setDetailError(null);

    if (!resolvedRecordId) {
      setDetailError("An audit trail record was not specified.");
      setIsLoadingDetail(false);
      return () => { alive = false; };
    }

    auditTrailApi
      .getAuditRecordById(resolvedRecordId)
      .then((response) => { if (alive) setDetailRecord(response); })
      .catch((error) => {
        if (!alive) return;
        setDetailError(error instanceof Error ? error.message : "Unable to load audit trail detail.");
        setDetailRecord(null);
      })
      .finally(() => { if (alive) setIsLoadingDetail(false); });

    return () => { alive = false; };
  }, [resolvedRecordId]);

  const handleBack = () => {
    setIsNavigating(true);
    setTimeout(() => {
      if (onBack) {
        onBack();
      } else {
        navigate(ROUTES.AUDIT_TRAIL);
      }
    }, 400);
  };

  const r = (detailRecord ?? record) as AuditTrailDetailRecord | null;
  const isSigned = Boolean(r && (r.electronicSignatureApplied || r.signatureId));
  const changes = r?.changes || [];
  const entityLabel = r ? buildEntityLabel(r) : "Audit Record";
  const description = r?.description?.trim() ?? "";
  // The reason is what a person typed. The server keeps it apart as `userReason`; a signature always carries the reason its signer typed.
  // The stored reason/comment of anything else is the system's own text ("Document draft updated | Co-authors=0, ...") and is never shown.
  const typedReason = r ? getMetadataValue(r.metadata, "userReason") : "";
  const reason = typedReason || (isSigned && r ? buildReason(r) : "");
  // The specific action (SUBMIT_FOR_REVIEW -> "Submit For Review"), not the family it is filed under ("Submit").
  const actionLabel = (r?.actionType || r?.action || "").toString().toUpperCase() === "DESTROY"
    ? "Destroy"
    : r ? eventLabel(r) : "-";
  // The module is the name of the sidebar menu the object belongs to (sent by the server).
  const moduleLabel = r ? getMetadataValue(r.metadata, "menuModule") || formatAuditModuleLabel(r.module) : "";
  const recordObjectType = r ? getMetadataValue(r.metadata, "objectTypeLabel") || formatAuditModuleLabel(r.entityType || r.module) : "-";
  const recordObjectCode = r ? getMetadataValue(r.metadata, "objectCodeLabel") || r.objectCode || "-" : "-";
  const recordAction = r ? getMetadataValue(r.metadata, "actionLabel") || eventLabel(r) : "-";
  const profileId = r?.user?.id || "";
  const userName = r?.user?.fullName || r?.fullName || "System User";
  const isDestroyAction = r ? isControlledCopyDestroyAction(r) : false;

  const destructionDetails = isDestroyAction && r ? [
    { label: tr("Document Number"), value: getMetadataValue(r.metadata, "controlledCopyNumber", "copyNumber", "objectCode", "entityLabel", "entityName") },
    { label: "Document", value: getMetadataValue(r.metadata, "documentNumber", "document_number", "documentDisplayLabel", "documentName") },
    { label: "Revision", value: getMetadataValue(r.metadata, "revisionNumber", "revision_number", "revisionName") },
    { label: tr("Destruction Type"), value: getMetadataValue(r.metadata, "destructionType", "destruction_type") },
    { label: tr("Destruction Method"), value: getMetadataValue(r.metadata, "destructionMethod", "destruction_method") },
    { label: tr("Destroy Reason"), value: getMetadataValue(r.metadata, "destroyReason", "destroy_reason", "reason") || reason },
    { label: "Witness", value: getMetadataValue(r.metadata, "witnessName", "witnessedBy", "witnessed_by") },
    { label: tr("Destroyed By"), value: getMetadataValue(r.metadata, "destroyedBy", "destroyed_by") || r.user?.fullName || r.fullName },
    { label: tr("Destroyed At"), value: getMetadataValue(r.metadata, "destroyedAt", "destroyed_at") || r.timestamp },
  ].filter((item) => item.value && item.value !== "-" && item.value !== reason) : [];

  const evidenceFiles = isDestroyAction && Array.isArray(r?.metadata?.evidenceFiles) ? r.metadata.evidenceFiles : [];
  const evidenceCount = isDestroyAction
    ? (evidenceFiles.length || Number(getMetadataValue(r?.metadata, "evidenceCount", "evidence_count")) || 0)
    : 0;

  // Drop a genuinely no-op "status"/"state" entry (old === new, or no destination value at all). Older audit rows
  // persisted a synthetic "Obsoleted -> Obsoleted" for non-mutating actions (View, Login), which would otherwise
  // surface here as a meaningless row. A blank OLD value with a real NEW one is a creation and stays.
  const isNoOpStatusChange = (c: { field?: string | null; oldValue?: string | null; newValue?: string | null }) => {
    if (!/status|state/i.test(c.field || "")) return false;
    const o = (c.oldValue ?? "").trim();
    const n = (c.newValue ?? "").trim();
    return n === "" || (o !== "" && o.toLowerCase() === n.toLowerCase());
  };
  const fieldChanges = changes.filter(
    (c) => c.field !== "Permission Granted" && c.field !== "Permission Revoked" && !isNoOpStatusChange(c) && !(isBlank(c.oldValue) && isBlank(c.newValue)),
  );
  const permissionChanges = changes.filter((c) => c.field === "Permission Granted" || c.field === "Permission Revoked");

  // The status transition of the record is the first row of "What changed" unless the change list already has it.
  // Blank before = created; blank after = removed; both blank (Login, View) or equal = nothing changed.
  const fromStatus = (r?.fromStatus ?? "").trim();
  const toStatus = (r?.toStatus ?? "").trim();
  const hasStatusRow = fieldChanges.some((c) => /^(status|state)$/i.test((c.field || "").trim()));
  const readOnlyEvent = /^(view|login|logout|failed[ _]login|preview|open|download|export|send[ _]email)/i.test((r?.actionType || r?.action || "").toString().trim());
  const statusMoved = !readOnlyEvent && !(fromStatus === "" && toStatus === "") && fromStatus.toLowerCase() !== toStatus.toLowerCase();
  // File internals (checksum, storage keys, paths) are for an investigator: they are listed under "Technical details", not here.
  const userFieldChanges = fieldChanges.filter((c) => !isTechnicalField(c.field));
  const technicalChanges = fieldChanges.filter((c) => isTechnicalField(c.field));
  const changeRows: ChangeRow[] = [
    ...(statusMoved && !hasStatusRow ? expandChange({ field: "Status", oldValue: fromStatus, newValue: toStatus }) : []),
    ...userFieldChanges.flatMap(expandChange),
  ];
  // A record that was just created has nothing "before": that column is left out.
  const hasBefore = changeRows.some((c) => !isBlank(c.oldValue));

  type TechnicalItem = { label: string; value: React.ReactNode };
  const technicalItems: TechnicalItem[] = [];
  if (r) {
    technicalItems.push({ label: tr("Record ID"), value: r.id });
    if (r.entityId) technicalItems.push({ label: tr("Entity ID"), value: r.entityId });
    if (r.severity) technicalItems.push({ label: tr("Severity"), value: r.severity });
    technicalItems.push({ label: tr("IP Address"), value: r.ipAddress || "-" });
    if (r.userAgent || r.device) technicalItems.push({ label: tr("Client Device / Agent"), value: r.device || r.userAgent });
    if (r.progressDurationSeconds !== undefined && r.progressDurationSeconds !== null) {
      technicalItems.push({ label: tr("Processing Duration"), value: formatProcessingDuration(r.progressDurationSeconds) });
    }
    for (const row of technicalChanges.flatMap(expandChange)) {
      const after = isBlank(row.newValue) ? "(cleared)" : formatAuditChangeValue(row.valueField, row.newValue);
      technicalItems.push({
        label: row.field,
        value: <span className="font-mono text-xs">{isBlank(row.oldValue) ? after : `${formatAuditChangeValue(row.valueField, row.oldValue)} → ${after}`}</span>,
      });
    }
  }

  const userEmail = r ? getMetadataValue(r.metadata, "userEmail") : "";
  const userCode = r?.user?.employeeCode;
  const userCodeNode = userCode
    ? profileId
      ? (
        <button type="button" onClick={() => navigate(USER_MANAGEMENT_ROUTES.PROFILE(profileId))} className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
          {userCode}
        </button>
      )
      : <span className="font-medium text-slate-500">{userCode}</span>
    : null;

  return (
    <div className="w-full min-w-0 space-y-5 md:space-y-6">
      <PageHeader
        title={tr("Audit Trail Detail")}
        breadcrumbItems={auditTrailDetail(navigate)}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleBack} size="sm" variant="outline-emerald" className="whitespace-nowrap">
              {tr("Back")}
            </Button>
            <Button onClick={() => setIsExportModalOpen(true)} size="sm" variant="outline" className="gap-2 whitespace-nowrap">
              <Download className="h-4 w-4" />
              {tr("Export")}
            </Button>
          </div>
        }
      />

      {isLoadingDetail && (
        <SectionLoading text="Loading audit record details..." minHeight="200px" />
      )}

      {detailError && !isLoadingDetail && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{detailError}</span>
        </div>
      )}

      {!isLoadingDetail && r && (
        <div className="min-w-0 space-y-5 md:space-y-6">
            {/* The event: what was done, to what, by whom and when. */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  {isSigned ? <PenLine className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-balance text-lg font-semibold leading-snug text-slate-900">{actionLabel}</h2>
                  <p className="mt-0.5 break-words text-sm text-slate-600">
                    {entityLabel}
                  </p>
                </div>
                <div className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
                  <Badge color="slate" size="sm">{moduleLabel || "General"}</Badge>
                  {isSigned && <Badge color="emerald" size="sm">{tr("Signed")}</Badge>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 sm:hidden">
                <Badge color="slate" size="sm">{moduleLabel || "General"}</Badge>
                {isSigned && <Badge color="emerald" size="sm">{tr("Signed")}</Badge>}
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 sm:text-sm">
                <span className="tabular-nums">{formatDateTime(r.timestamp) || "-"}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={userName} src={r.user?.avatar || r.metadata?.userAvatar} tone="solid" className="h-5 w-5 text-[9px] font-bold" />
                  <span className="font-medium text-slate-700">{userName}</span>
                </span>
                {userCodeNode}
              </p>
              {/* The four words the Audit Trail list shows, so this screen can be matched with the line that was opened. */}
              <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <DetailItem label={tr("Module")} value={moduleLabel || "General"} />
                <DetailItem label={tr("Object Type")} value={recordObjectType} />
                <DetailItem
                  label={tr("Object Code")}
                  value={
                    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono">{recordObjectCode}</span>
                      {r.entityId && recordObjectCode !== "-" && (
                        <button type="button" onClick={() => navigate(objectHistoryPath(r.entityId as string, recordObjectCode))} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">
                          {tr("View all records of this object")}
                        </button>
                      )}
                    </span>
                  }
                />
                <DetailItem label={tr("Action")} value={recordAction} />
              </dl>
              {description && description !== entityLabel && changeRows.length === 0 && permissionChanges.length === 0 && (
                <p className="mt-3 break-words border-t border-slate-100 pt-3 text-xs text-slate-600 sm:text-sm">{description}</p>
              )}
            </div>

            {changeRows.length > 0 && (
              <FormSection
                title={tr("What changed")}
                contentClassName="p-0"
                headerRight={changeRows.length > 0 ? <span className="text-xs text-slate-400">{changeRows.length} {changeRows.length === 1 ? "field" : "fields"}</span> : undefined}
              >
                {changeRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <TableMarkup.Root className="w-full">
                      <TableMarkup.Head className="border-b border-slate-200 bg-slate-50/90">
                        <TableMarkup.Row>
                          <TableMarkup.HeaderCell className={cn(hasBefore ? "w-[28%]" : "w-[40%]", "px-3 py-2.5 sm:px-4 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500 md:px-5 md:text-xs")}>{tr("Field")}</TableMarkup.HeaderCell>
                          {hasBefore && (
                            <TableMarkup.HeaderCell className="px-3 py-2.5 text-left sm:px-4 text-2xs font-semibold uppercase tracking-wider text-slate-500 md:text-xs">{tr("Before")}</TableMarkup.HeaderCell>
                          )}
                          <TableMarkup.HeaderCell className="px-3 py-2.5 text-left sm:px-4 text-2xs font-semibold uppercase tracking-wider text-slate-500 md:pr-5 md:text-xs">{tr("After")}</TableMarkup.HeaderCell>
                        </TableMarkup.Row>
                      </TableMarkup.Head>
                      <TableMarkup.Body className="divide-y divide-slate-100 bg-white">
                        {changeRows.map((change, i) => (
                          <TableMarkup.Row key={`${change.field}-${i}`}>
                            <TableMarkup.Cell className="px-3 py-3 text-xs font-semibold sm:px-4 text-slate-900 md:px-5 md:text-sm">
                              <span className="[overflow-wrap:anywhere]">{change.field}</span>
                              <span className={cn("ml-2 inline-block rounded px-1.5 py-0.5 align-middle text-2xs font-medium",
                                change.kind === "set" && "bg-emerald-50 text-emerald-700",
                                change.kind === "changed" && "bg-amber-50 text-amber-700",
                                change.kind === "cleared" && "bg-rose-50 text-rose-700")}>
                                {CHANGE_KIND_LABEL[change.kind]}
                              </span>
                            </TableMarkup.Cell>
                            {hasBefore && (
                              <TableMarkup.Cell className="px-3 py-3 sm:px-4"><ValueChip field={change.valueField} value={change.oldValue} side="before" /></TableMarkup.Cell>
                            )}
                            <TableMarkup.Cell className="px-3 py-3 sm:px-4 md:pr-5"><ValueChip field={change.valueField} value={change.newValue} side="after" /></TableMarkup.Cell>
                          </TableMarkup.Row>
                        ))}
                      </TableMarkup.Body>
                    </TableMarkup.Root>
                  </div>
                ) : null}
              </FormSection>
            )}

            {/* Signed: the reason is in the signature card below. Unsigned: only when the person typed one. */}
            {!isSigned && reason && (
              <FormSection title={tr("Why")} contentClassName="px-4 py-4 md:px-5">
                <div className="space-y-1 border-l-[3px] border-emerald-300 pl-3">
                  {reason.split("; ").map((segment, index) => (
                    <p key={index} className="whitespace-pre-wrap break-words text-sm text-slate-800">{segment}</p>
                  ))}
                </div>
              </FormSection>
            )}

            {permissionChanges.length > 0 && (
              <FormSection title={tr("Permission changes")} contentClassName="p-0" headerRight={<span className="text-xs text-slate-400">{permissionChanges.length}</span>}>
                <div className="overflow-x-auto">
                  <TableMarkup.Root className="w-full min-w-[360px]">
                    <TableMarkup.Head className="border-b border-slate-200 bg-slate-50/90">
                      <TableMarkup.Row>
                        <TableMarkup.HeaderCell className="w-32 px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500 md:px-5 md:text-xs">{tr("Change")}</TableMarkup.HeaderCell>
                        <TableMarkup.HeaderCell className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-slate-500 md:pr-5 md:text-xs">{tr("Permission")}</TableMarkup.HeaderCell>
                      </TableMarkup.Row>
                    </TableMarkup.Head>
                    <TableMarkup.Body className="divide-y divide-slate-100 bg-white">
                      {permissionChanges.map((change, i) => {
                        const isGranted = change.field === "Permission Granted";
                        return (
                          <TableMarkup.Row key={i}>
                            <TableMarkup.Cell className="whitespace-nowrap px-4 py-3 md:px-5">
                              <Badge color={isGranted ? "emerald" : "red"} size="sm">{isGranted ? "Granted" : "Revoked"}</Badge>
                            </TableMarkup.Cell>
                            <TableMarkup.Cell className="px-4 py-3 text-xs font-medium text-slate-900 sm:text-sm md:pr-5">
                              {formatAuditChangeValue(change.field, change.newValue ?? change.oldValue)}
                            </TableMarkup.Cell>
                          </TableMarkup.Row>
                        );
                      })}
                    </TableMarkup.Body>
                  </TableMarkup.Root>
                </div>
              </FormSection>
            )}

            {isDestroyAction && destructionDetails.length > 0 && (
              <FormSection title={tr("Controlled Copy Destruction Record")} icon={<AlertTriangle className="h-4 w-4 text-red-500" />}>
                <div className="space-y-3">
                  <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {destructionDetails.map((item) => (
                      <div key={item.label} className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">{item.label}</dt>
                        <dd className="break-words text-xs font-medium text-slate-900 sm:text-sm">{toReadableText(item.value)}</dd>
                      </div>
                    ))}
                  </dl>
                  {evidenceCount > 0 && (
                    <div className="border-t border-slate-100 pt-2">
                      <span className="mb-2 block text-xs font-semibold text-slate-700">{trFormat("Evidence Files ({count})", { count: evidenceCount })}</span>
                      <div className="flex flex-wrap gap-2">
                        {evidenceFiles.map((file: any, index: number) => (
                          <Badge key={file.id || file.fileName || index} color="rose" size="sm">
                            {file.fileName || file.name || file.originalFileName || `Evidence File ${index + 1}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </FormSection>
            )}

            <FormSection title={isSigned ? "Signature and user" : "User"} contentClassName="p-0">
              <dl className="space-y-3 px-4 py-4 md:px-5">
                {isSigned && reason && (
                  <DetailItem label={tr("Reason")} value={<span className="whitespace-pre-wrap">{reason}</span>} />
                )}
                {isSigned && r.signatureId && (
                  <DetailItem label={tr("Signature ID")} value={<span className="font-mono text-xs" title={`Full UUID: ${r.signatureId}`}>{formatSignatureId(r.signatureId)}</span>} />
                )}
                <DetailItem
                  label={tr("User")}
                  value={<span className="inline-flex flex-wrap items-baseline gap-x-2"><span>{userName}</span>{userCodeNode}</span>}
                />
                {userEmail && (
                  <DetailItem label={tr("Email")} value={<a href={`mailto:${userEmail}`} className="text-emerald-600 hover:text-emerald-700 hover:underline">{userEmail}</a>} />
                )}
                <DetailItem label={tr("Position")} value={r.user?.position || "-"} />
                <DetailItem label={tr("Department")} value={r.user?.department || "-"} />
              </dl>
              {/* IP address, device, identifiers: needed by an investigator, not by every reader. */}
              <div className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTechnical((open) => !open)}
                  aria-expanded={showTechnical}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs text-slate-500 transition-colors hover:bg-slate-50 sm:text-sm md:px-5"
                >
                  <span>{tr("Technical details")} <span className="text-slate-400">· {tr("IP address, device, record ID, file internals")}</span></span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-emerald-600">
                    {showTechnical ? tr("Hide") : tr("Show")}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showTechnical && "rotate-180")} />
                  </span>
                </button>
                <Collapsible open={showTechnical}>
                  <dl className="space-y-3 border-t border-slate-100 px-4 py-4 md:px-5">
                    {technicalItems.map((item) => (
                      <DetailItem key={item.label} label={item.label} value={item.value} />
                    ))}
                  </dl>
                </Collapsible>
              </div>
            </FormSection>
        </div>
      )}

      {isExportModalOpen && r && (
        <AuditExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} record={r} />
      )}

      {isNavigating && <div className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm" />}
    </div>
  );
};
