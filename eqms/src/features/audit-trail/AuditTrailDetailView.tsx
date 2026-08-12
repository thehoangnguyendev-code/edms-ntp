import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Download,
  Hash,
  Info,
  AlertTriangle,
  Shield,
  Clock,
  User as UserIcon,
  Globe,
  Laptop,
  CheckCircle2,
  FileText,
  Activity,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { IconExchange, IconMessage2, IconScanTraces } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { auditTrailDetail } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { FormSection } from "@/components/ui/form";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { formatDateTime } from "@/utils/format";
import { AuditExportModal } from "./components/AuditExportModal";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { auditTrailApi } from "@/services/api/auditTrail";
import { USER_MANAGEMENT_ROUTES } from "@/features/security-authorization/user-management/constants";
import { ROUTES } from "@/app/routes.constants";
import { formatWorkflowStatusLabel } from "./utils/statusLabel";
import type { AuditTrailDetailRecord, AuditTrailRecord } from "./types";

const DetailItem: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  subValue?: React.ReactNode;
  last?: boolean;
}> = ({ label, value, icon, subValue, last }) => (
  <div
    className={cn(
      "flex flex-col gap-1 sm:flex-row sm:items-center justify-between py-3 px-3 sm:px-4 rounded-lg transition-colors hover:bg-slate-50/80",
      !last && "border-b border-slate-100"
    )}
  >
    <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-500 min-w-[150px] flex-shrink-0">
      {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </div>
    <div className="flex flex-col items-start sm:items-end text-xs sm:text-sm font-semibold text-slate-800 break-words text-left sm:text-right min-w-0 flex-1 mt-0.5 sm:mt-0">
      {value}
      {subValue && <span className="text-xs font-normal text-slate-500 mt-0.5">{subValue}</span>}
    </div>
  </div>
);

const getActionBadgeColor = (action: string): BadgeColor => {
  const normalized = action.toLowerCase().replace(/[_\s-]+/g, " ");
  switch (normalized) {
    case "create": case "approve": case "publish": case "enable": return "emerald";
    case "update": case "review": case "assign": case "submit": case "upload":
    case "view": case "open": case "preview": case "open preview": case "view page":
    case "close preview": case "replace file": case "update metadata":
    case "add working note": case "delete working note": case "download evidence":
    case "open edit online":
    case "upload to office online":
    case "revision file uploaded to office online":
    case "edit online synced back to minio":
    case "edit online session closed": return "blue";
    case "delete": case "reject": case "disable": case "failed login": case "destroy": return "red";
    case "archive": case "restore": case "cancel": case "obsolete": return "amber";
    default: return "slate";
  }
};

const getSeverityBadgeColor = (severity?: string): BadgeColor => {
  const normalized = (severity || "").toLowerCase();
  switch (normalized) {
    case "high": return "red";
    case "medium": return "amber";
    case "low": return "emerald";
    default: return "slate";
  }
};

const formatAuditLabel = (value?: string): string => {
  if (!value) return "-";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const getUserInitials = (name?: string): string => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const buildEntityLabel = (r: AuditTrailRecord): string => {
  if (r.entityName && r.entityName.trim()) return r.entityName.trim();
  if (r.entityLabel && r.entityLabel.trim()) return r.entityLabel.trim();
  if (r.objectCode && r.objectCode.trim()) return r.objectCode.trim();
  if (r.description && r.description.trim()) return r.description.trim();
  return "System Audit Record";
};

const buildReason = (r: AuditTrailRecord): string => {
  if (r.reason && r.reason.trim()) return r.reason.trim();
  if (r.description && r.description.trim()) return r.description.trim();
  return "-";
};

const getSignatureBadge = (r: AuditTrailRecord): { label: string; color: BadgeColor; isSigned: boolean } => {
  if (r.electronicSignatureApplied || Boolean(r.signatureId)) {
    return { label: "Electronically Signed", color: "emerald", isSigned: true };
  }
  return { label: "Standard Log", color: "slate", isSigned: false };
};

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

const formatAuditField = (field?: string | null): string => {
  const raw = String(field || "").trim();
  if (!raw) return "Field";
  const normalized = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const specialLabels: Record<string, string> = {
    "is active": "Active",
    "has expiry date": "Has Expiry Date",
    "email notifications enabled": "Email Notifications Enabled",
    "two factor enabled": "Two-Factor Authentication Enabled",
    "mfa enabled": "Multi-Factor Authentication Enabled",
    "file size bytes": "File Size",
  };
  const key = normalized.toLowerCase();
  return specialLabels[key] || normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

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
  const signature = r ? getSignatureBadge(r) : { label: "Standard Log", color: "slate" as BadgeColor, isSigned: false };
  const changes = r?.changes || [];
  const entityLabel = r ? buildEntityLabel(r) : "Audit Record";
  const reason = r ? buildReason(r) : "-";
  const actionLabel = (r?.actionType || r?.action || "").toString().toUpperCase() === "DESTROY"
    ? "Destroy"
    : formatAuditLabel(r?.action);
  const profileId = r?.user?.id || "";
  const userName = r?.user?.fullName || r?.fullName || "System User";
  const userInitials = getUserInitials(userName);
  const isDestroyAction = r ? isControlledCopyDestroyAction(r) : false;

  const destructionDetails = isDestroyAction && r ? [
    { label: "Controlled Copy Number", value: getMetadataValue(r.metadata, "controlledCopyNumber", "copyNumber", "objectCode", "entityLabel", "entityName") },
    { label: "Document", value: getMetadataValue(r.metadata, "documentNumber", "document_number", "documentDisplayLabel", "documentName") },
    { label: "Revision", value: getMetadataValue(r.metadata, "revisionNumber", "revision_number", "revisionName") },
    { label: "Destruction Type", value: getMetadataValue(r.metadata, "destructionType", "destruction_type") },
    { label: "Destruction Method", value: getMetadataValue(r.metadata, "destructionMethod", "destruction_method") },
    { label: "Destroy Reason", value: getMetadataValue(r.metadata, "destroyReason", "destroy_reason", "reason") || reason },
    { label: "Witness", value: getMetadataValue(r.metadata, "witnessName", "witnessedBy", "witnessed_by") },
    { label: "Destroyed By", value: getMetadataValue(r.metadata, "destroyedBy", "destroyed_by") || r.user?.fullName || r.fullName },
    { label: "Destroyed At", value: getMetadataValue(r.metadata, "destroyedAt", "destroyed_at") || r.timestamp },
  ].filter((item) => item.value && item.value !== "-" && item.value !== reason) : [];

  const evidenceFiles = isDestroyAction && Array.isArray(r?.metadata?.evidenceFiles) ? r.metadata.evidenceFiles : [];
  const evidenceCount = isDestroyAction
    ? (evidenceFiles.length || Number(getMetadataValue(r.metadata, "evidenceCount", "evidence_count")) || 0)
    : 0;

  const fieldChanges = changes.filter(c => c.field !== "Permission Granted" && c.field !== "Permission Revoked");
  const permissionChanges = changes.filter(c => c.field === "Permission Granted" || c.field === "Permission Revoked");

  return (
    <div className="w-full min-w-0 space-y-5 md:space-y-6">
      <PageHeader
        title="Audit Trail Detail"
        breadcrumbItems={auditTrailDetail(navigate)}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleBack} size="sm" variant="outline-emerald" className="whitespace-nowrap">
              Back
            </Button>
            <Button onClick={() => setIsExportModalOpen(true)} size="sm" variant="outline" className="gap-2 whitespace-nowrap">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />

      {isLoadingDetail && (
        <SectionLoading text="Loading audit record details..." minHeight="200px" />
      )}

      {detailError && !isLoadingDetail && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
          <span>{detailError}</span>
        </div>
      )}

      {!isLoadingDetail && r && (
        <div className="space-y-5 md:space-y-6">
          {/* Header Banner Card — identical to UserProfileView */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-slate-50 rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 sm:gap-5 p-4 sm:p-5 bg-gradient-to-b from-emerald-50/50 to-transparent">
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-emerald-600 shadow-md flex items-center justify-center flex-shrink-0 overflow-hidden text-white font-medium text-xl">
                <IconScanTraces className="h-7 w-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 leading-tight break-words">
                  {entityLabel}
                </h2>
                <p className="text-xs sm:text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {r.objectCode && (
                    <span className="text-emerald-700 font-semibold">{r.objectCode}</span>
                  )}
                  {r.objectCode && <span className="text-slate-400">&middot;</span>}
                  <span className="text-slate-500">{formatDateTime(r.timestamp) || "-"}</span>
                </p>
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <Badge color={getActionBadgeColor(r.action)} size="sm">
                    {actionLabel}
                  </Badge>
                  <Badge color="slate" size="sm">
                    {r.module || "General"}
                  </Badge>
                  {r.severity && (
                    <Badge color={getSeverityBadgeColor(r.severity)} size="sm">
                      {r.severity} Severity
                    </Badge>
                  )}
                  {r.signatureId && (
                    <span className="text-xs text-slate-600 font-medium whitespace-nowrap" title={`Full UUID: ${r.signatureId}`}>
                      Sig ID: {formatSignatureId(r.signatureId)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Primary Context Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
            {/* Left Column: User & Security Metadata */}
            <FormSection title="User & Security Context" icon={<UserIcon className="h-4 w-4" />}>
              <div className="space-y-1">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/80 mb-3 border border-slate-100">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-sm shadow-sm overflow-hidden border border-emerald-100">
                    {(r.user?.avatar || (r as any).avatar || r.metadata?.userAvatar) ? (
                      <img
                        src={r.user?.avatar || (r as any).avatar || r.metadata?.userAvatar}
                        alt={userName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      userInitials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {userName}
                      </span>
                      {profileId && r.user?.employeeCode && (
                        <button
                          type="button"
                          onClick={() => navigate(USER_MANAGEMENT_ROUTES.PROFILE(profileId))}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex-shrink-0"
                        >
                          {r.user.employeeCode}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {[r.user?.role, r.user?.department].filter(Boolean).join(" • ") || "User Record"}
                    </p>
                  </div>
                </div>

                <DetailItem
                  icon={<Shield className="h-3.5 w-3.5" />}
                  label="Role"
                  value={r.user?.role || "-"}
                />
                <DetailItem
                  icon={<UserIcon className="h-3.5 w-3.5" />}
                  label="Position"
                  value={r.user?.position || "-"}
                />
                <DetailItem
                  icon={<Layers className="h-3.5 w-3.5" />}
                  label="Department"
                  value={r.user?.department || "-"}
                />
                <DetailItem
                  icon={<Globe className="h-3.5 w-3.5" />}
                  label="IP Address"
                  value={r.ipAddress || "-"}
                />
                {(r.userAgent || r.device) && (
                  <DetailItem
                    icon={<Laptop className="h-3.5 w-3.5" />}
                    label="Client Device / Agent"
                    value={r.device || r.userAgent}
                  />
                )}
                {r.progressDurationSeconds !== undefined && r.progressDurationSeconds !== null && (
                  <DetailItem
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Processing Duration"
                    value={formatProcessingDuration(r.progressDurationSeconds)}
                    last
                  />
                )}
              </div>
            </FormSection>

            {/* Right Column: Event & Workflow Metadata */}
            <FormSection title="Event & Workflow Information" icon={<Info className="h-4 w-4" />}>
              <div className="space-y-1">
                <DetailItem
                  icon={<Activity className="h-3.5 w-3.5" />}
                  label="Action Type"
                  value={<Badge color={getActionBadgeColor(r.action)} size="sm">{actionLabel}</Badge>}
                />
                <DetailItem
                  icon={<Layers className="h-3.5 w-3.5" />}
                  label="Target Module"
                  value={r.module || "-"}
                />
                <DetailItem
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Entity Name"
                  value={entityLabel}
                />
                {r.entityId && (
                  <DetailItem
                    icon={<Hash className="h-3.5 w-3.5" />}
                    label="Entity ID"
                    value={r.entityId}
                  />
                )}
                {r.objectCode && (
                  <DetailItem
                    icon={<Hash className="h-3.5 w-3.5" />}
                    label="Object Code"
                    value={r.objectCode}
                  />
                )}
                {(r.fromStatus || r.toStatus) && (
                  <DetailItem
                    icon={<IconExchange className="h-3.5 w-3.5" />}
                    label="Status Transition"
                    value={
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {formatWorkflowStatusLabel(r.fromStatus)}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          {formatWorkflowStatusLabel(r.toStatus)}
                        </span>
                      </div>
                    }
                  />
                )}
                <DetailItem
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  label="E-Signature Status"
                  value={<Badge color={signature.color} size="sm">{signature.label}</Badge>}
                  last={!r.signatureId}
                />
                {r.signatureId && (
                  <DetailItem
                    icon={<ShieldCheck className="h-3.5 w-3.5 text-slate-400" />}
                    label="Signature ID"
                    value={
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 whitespace-nowrap" title={`Full UUID: ${r.signatureId}`}>
                        {formatSignatureId(r.signatureId)}
                      </span>
                    }
                    last
                  />
                )}
              </div>
            </FormSection>
          </div>

          {/* GxP Reason / Comment Box */}
          {reason !== "-" && (
            <FormSection title="GxP Reason / Description" icon={<IconMessage2 className="h-4 w-4" />}>
              <div className="rounded-xl bg-gradient-to-r from-slate-50 to-emerald-50/40 p-4 border border-slate-200/80">
                <p className="leading-relaxed text-xs sm:text-sm font-medium text-slate-800 whitespace-pre-wrap">
                  {reason}
                </p>
              </div>
            </FormSection>
          )}

          {/* Controlled Copy Destruction Details */}
          {isDestroyAction && (
            <FormSection title="Controlled Copy Destruction Record" icon={<AlertTriangle className="h-4 w-4 text-red-500" />}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {destructionDetails.map((item) => (
                    <div key={item.label} className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-500">{item.label}</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 break-words">{toReadableText(item.value)}</span>
                    </div>
                  ))}
                </div>

                {evidenceCount > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-700">Evidence Files ({evidenceCount})</span>
                    </div>
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

          {/* Field Changes Table */}
          {fieldChanges.length > 0 && (
            <FormSection title={`Field Modifications (${fieldChanges.length})`} icon={<IconExchange className="h-4 w-4 text-emerald-600" />}>
              <div className="-mx-4 -mb-4 overflow-x-auto rounded-b-xl md:-mx-5 md:-mb-5 border-t border-slate-200">
                <table className="w-full min-w-[550px]">
                  <thead className="bg-slate-50/90 border-b border-slate-200">
                    <tr>
                      <th className="w-1/3 px-4 py-3 text-left text-2xs md:text-xs font-bold uppercase tracking-wider text-slate-600">
                        Field Name
                      </th>
                      <th className="w-1/3 px-4 py-3 text-left text-2xs md:text-xs font-bold uppercase tracking-wider text-slate-500">
                        Original Value (Before)
                      </th>
                      <th className="w-1/3 px-4 py-3 text-left text-2xs md:text-xs font-bold uppercase tracking-wider text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5 text-emerald-600" />
                          New Value (After)
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {fieldChanges.map((change, i) => (
                      <tr key={i} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-xs md:text-sm font-bold text-slate-900">
                          {formatAuditField(change.field)}
                        </td>
                        <td className="px-4 py-3 text-xs md:text-sm">
                          {change.oldValue !== undefined && change.oldValue !== null ? (
                            <span className="rounded bg-slate-100 px-2 py-1 text-slate-500 line-through text-xs sm:text-sm font-medium break-all">
                              {formatAuditChangeValue(change.field, change.oldValue)}
                            </span>
                          ) : (
                            <span className="italic text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs md:text-sm">
                          {change.newValue !== undefined && change.newValue !== null ? (
                            <span className="inline-block rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-800 text-xs sm:text-sm font-semibold break-all">
                              {formatAuditChangeValue(change.field, change.newValue)}
                            </span>
                          ) : (
                            <span className="italic text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FormSection>
          )}

          {/* Permission Changes Table */}
          {permissionChanges.length > 0 && (
            <FormSection title={`Permission Modifications (${permissionChanges.length})`} icon={<Shield className="h-4 w-4 text-emerald-600" />}>
              <div className="-mx-4 -mb-4 overflow-x-auto rounded-b-xl md:-mx-5 md:-mb-5 border-t border-slate-200">
                <table className="w-full min-w-[400px]">
                  <thead className="bg-slate-50/90 border-b border-slate-200">
                    <tr>
                      <th className="w-36 px-4 py-3 text-left text-2xs md:text-xs font-bold uppercase tracking-wider text-slate-600">
                        Change
                      </th>
                      <th className="px-4 py-3 text-left text-2xs md:text-xs font-bold uppercase tracking-wider text-slate-600">
                        Permission Code / Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {permissionChanges.map((change, i) => {
                      const isGranted = change.field === "Permission Granted";
                      return (
                        <tr key={i} className="transition-colors hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge color={isGranted ? "emerald" : "red"} size="sm" showDot>
                              {isGranted ? "Granted" : "Revoked"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900">
                            {formatAuditChangeValue(change.field, change.newValue ?? change.oldValue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FormSection>
          )}
        </div>
      )}

      {isExportModalOpen && (
        <AuditExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} record={r} />
      )}

      {isNavigating && <div className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm" />}
    </div>
  );
};
