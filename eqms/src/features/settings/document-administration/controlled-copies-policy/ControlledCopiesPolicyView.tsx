import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Mail,
  Plus,
  RotateCcw,
  TimerReset,
  Trash2,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch/Switch";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { FormSection } from "@/components/ui/form/FormSection";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { controlledCopiesPolicy as controlledCopiesPolicyBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { controlledCopyPolicyApi } from "@/services/api";
import { dictionaryApi } from "@/services/api/dictionary";
import type {
  ControlledCopyDcoEligibleUser,
  ControlledCopyExpiryDurationUnit,
  ControlledCopyExpiryLimit,
  ControlledCopyPolicyMarking,
  ControlledCopyStatusMarking,
  ControlledCopyStatusMarkingKey,
  MarkingPlacementRule,
} from "@/services/api/controlledCopyPolicy";
import type {
  DepartmentItem,
  DocumentTypeItem,
} from "@/features/settings/dictionaries/types";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { IconPencilMinus } from "@tabler/icons-react";
import { usePermissions } from "@/hooks/usePermissions";
import {
  MarkCard,
  ShowToggles,
  StampFields,
  WatermarkFields,
} from "./MarkingEditors";
import { MarkingPreviewPane } from "./MarkingPreviewPane";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

type PolicyTabKey = "policy" | "markings";

const POLICY_TABS: TabItem[] = [
  { id: "policy", label: "Distribution & Lifecycle" },
  { id: "markings", label: "PDF Markings" },
];

type MarkingTabKey = "ISSUED" | ControlledCopyStatusMarkingKey;

const MARKING_TABS: {
  key: MarkingTabKey;
  label: string;
}[] = [
  { key: "ISSUED", label: "Distributed Copy" },
  { key: "OBSOLETED", label: "Obsoleted" },
  { key: "CLOSED_CANCELLED", label: "Closed - Cancelled" },
];

interface PolicyState {
  distributionSecurity: {
    allowEmailDistribution: boolean;
    allowPortalView: boolean;
    allowDownload: boolean;
    allowPrint: boolean;
    downloadOnce: boolean;
    printOnce: boolean;
    watermarkEnabled: boolean;
    watermarkCopyNumber: boolean;
    watermarkRecipient: boolean;
    watermarkDistributedDate: boolean;
    watermarkExpiryDate: boolean;
    previewSessionMinutes: number;
  };
  recallLostDamaged: {
    allowManualRecall: boolean;
    allowReportLostDamaged: boolean;
    allowReplacementForLostDamaged: boolean;
  };
  delivery: {
    redirectDeliveryToDco: boolean;
    dcoRecipientUserId: string;
    /** From the server: false when the assigned user no longer holds the DCO permission. Display-only. */
    dcoRecipientEligible: boolean;
  };
  marking: ControlledCopyPolicyMarking;
  statusMarking: Record<
    ControlledCopyStatusMarkingKey,
    ControlledCopyStatusMarking
  >;
}

// Display defaults only; the server owns the real defaults and validates every value on save.
const defaultMarking: ControlledCopyPolicyMarking = {
  stampEnabled: true,
  stampText: "CONTROLLED COPY",
  stampColor: "#C00000",
  stampPosition: "TOP_RIGHT",
  stampMarginMm: 4,
  stampSize: "SMALL",
  stampOpacityPercent: 90,
  stampPages: "ALL",
  stampShowCopyNumber: true,
  stampShowRecipient: false,
  stampShowDistributedDate: false,
  stampShowExpiryDate: false,
  stampFontFamily: "NOTO_SANS",
  watermarkText: "CONTROLLED COPY",
  watermarkColor: "#808080",
  watermarkOpacityPercent: 15,
  watermarkAngleDegrees: 35,
  watermarkPages: "ALL",
  watermarkLayer: "BEHIND",
  watermarkFontFamily: "NOTO_SANS",
};

const defaultStatusMarking = (
  cancelled: boolean,
): ControlledCopyStatusMarking => ({
  watermarkEnabled: true,
  watermarkLayer: "ABOVE",
  watermarkText: "",
  watermarkColor: "#C00000",
  watermarkOpacityPercent: 35,
  watermarkAngleDegrees: 35,
  watermarkShowDate: true,
  watermarkPages: "ALL",
  stampEnabled: true,
  stampText: cancelled ? "CANCELLED" : "WITHDRAWN",
  stampColor: "#C00000",
  stampPosition: "TOP_RIGHT",
  stampMarginMm: 4,
  stampSize: "SMALL",
  stampOpacityPercent: 100,
  stampShowDate: true,
  stampFontFamily: "NOTO_SANS",
  stampPages: "ALL",
  watermarkFontFamily: "NOTO_SANS",
});

const defaultPolicy: PolicyState = {
  distributionSecurity: {
    allowEmailDistribution: true,
    allowPortalView: true,
    allowDownload: false,
    allowPrint: false,
    watermarkEnabled: true,
    downloadOnce: false,
    printOnce: false,
    watermarkCopyNumber: true,
    watermarkRecipient: false,
    watermarkDistributedDate: false,
    watermarkExpiryDate: false,
    previewSessionMinutes: 120,
  },
  recallLostDamaged: {
    allowManualRecall: true,
    allowReportLostDamaged: true,
    allowReplacementForLostDamaged: true,
  },
  delivery: {
    redirectDeliveryToDco: false,
    dcoRecipientUserId: "",
    dcoRecipientEligible: true,
  },
  marking: defaultMarking,
  statusMarking: {
    OBSOLETED: defaultStatusMarking(false),
    CLOSED_CANCELLED: defaultStatusMarking(true),
  },
};

const DURATION_UNIT_OPTIONS: {
  label: string;
  value: ControlledCopyExpiryDurationUnit;
  example: string;
}[] = [
  {
    label: "Hours",
    value: "HOURS",
    example: "e.g. 24 Hours → expires 1 day after distribution",
  },
  {
    label: "Days",
    value: "DAYS",
    example: "e.g. 30 Days → expires 1 month after distribution",
  },
  {
    label: "Weeks",
    value: "WEEKS",
    example: "e.g. 2 Weeks → expires 14 days after distribution",
  },
  {
    label: "Months",
    value: "MONTHS",
    example: "e.g. 6 Months → expires half a year after distribution",
  },
];

// Mirrors ControlledCopyExpiryLimitService#toApproxHours exactly -- must stay in sync with the
// backend's own approximation (weeks = 7 days, months = 30 days) so the comparison this powers
// agrees with what the server will actually resolve.
function toApproxHours(
  value: number,
  unit: ControlledCopyExpiryDurationUnit,
): number {
  switch (unit) {
    case "HOURS":
      return value;
    case "WEEKS":
      return value * 24 * 7;
    case "MONTHS":
      return value * 24 * 30;
    default:
      return value * 24; // DAYS
  }
}

/**
 * Mirrors ControlledCopyExpiryLimitService#resolveMatchingLimit's priority order exactly:
 * (documentType + department) > documentType-only > department-only > Global Default. Used to
 * find which rule would apply to a given scope if the rule currently being edited did not exist
 * -- i.e. what this rule is about to override -- so the form can warn when the new rule is
 * *longer* (laxer) than what it overrides, a likely unintended relaxation of the policy.
 */
function resolveFallbackLimit(
  limits: ControlledCopyExpiryLimit[],
  documentTypeId: string,
  departmentId: string,
  excludeId?: string | null,
): ControlledCopyExpiryLimit | null {
  const candidates = limits.filter((l) => l.active && l.id !== excludeId);
  const pick = (matches: ControlledCopyExpiryLimit[]) =>
    matches.length === 0
      ? null
      : matches.reduce((min, l) =>
          toApproxHours(l.durationValue, l.durationUnit) <
          toApproxHours(min.durationValue, min.durationUnit)
            ? l
            : min,
        );

  if (documentTypeId && departmentId) {
    const exact = pick(
      candidates.filter(
        (l) =>
          l.documentTypeId === documentTypeId &&
          l.departmentId === departmentId,
      ),
    );
    if (exact) return exact;
  }
  if (documentTypeId) {
    const byType = pick(
      candidates.filter(
        (l) => !l.departmentId && l.documentTypeId === documentTypeId,
      ),
    );
    if (byType) return byType;
  }
  if (departmentId) {
    const byDept = pick(
      candidates.filter(
        (l) => !l.documentTypeId && l.departmentId === departmentId,
      ),
    );
    if (byDept) return byDept;
  }
  return pick(candidates.filter((l) => !l.documentTypeId && !l.departmentId));
}

const SESSION_MIN_MINUTES = 5;
const SESSION_MAX_MINUTES = 480;

/** Session length entered as a number of minutes or hours; the server stores minutes (5 to 480, i.e. up to 8 hours). */
const SessionLengthField: React.FC<{
  minutes: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}> = ({ minutes, onChange, disabled }) => {
  const [unit, setUnit] = useState<"MINUTES" | "HOURS">(
    minutes >= 60 && minutes % 60 === 0 ? "HOURS" : "MINUTES",
  );
  const shown = unit === "HOURS" ? minutes / 60 : minutes;
  const invalid =
    !Number.isInteger(minutes) ||
    minutes < SESSION_MIN_MINUTES ||
    minutes > SESSION_MAX_MINUTES;
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)]">
        <div className="min-w-0">
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Session length
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(shown) ? shown : ""}
            disabled={disabled}
            onChange={(e) => {
              const value =
                e.target.value === "" ? NaN : Number(e.target.value);
              onChange(
                Number.isFinite(value)
                  ? Math.round(value * (unit === "HOURS" ? 60 : 1))
                  : 0,
              );
            }}
            className={`w-full h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500 ${
              invalid ? "border-red-300 bg-red-50" : "border-slate-200"
            }`}
          />
        </div>
        <Select
          label="Unit"
          value={unit}
          onChange={(v) => setUnit(v as "MINUTES" | "HOURS")}
          options={[
            { label: "Minutes", value: "MINUTES" },
            { label: "Hours", value: "HOURS" },
          ]}
          enableSearch={false}
          disabled={disabled}
        />
      </div>
      <p
        className={`mt-1.5 text-2xs ${invalid ? "text-red-600" : "text-slate-400"}`}
      >
        Between {SESSION_MIN_MINUTES} minutes and 8 hours ({SESSION_MAX_MINUTES}{" "}
        minutes). Currently {minutes} minutes. Default: 2 hours.
      </p>
    </div>
  );
};

const SwitchRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  note?: string;
}> = ({ label, checked, onChange, disabled, note }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <div className="min-w-0">
      <span className="text-xs sm:text-sm font-medium text-slate-900 break-words">
        {label}
      </span>
      {note && (
        <p className="text-2xs sm:text-xs text-slate-400 mt-0.5 break-words">{note}</p>
      )}
    </div>
    <Switch
      checked={checked}
      onChange={onChange}
      size="sm"
      disabled={disabled}
    />
  </div>
);

/** The mandatory "Global Default" row is always sorted first; the rest keep server order. */
const sortExpiryLimits = (limits: ControlledCopyExpiryLimit[]) =>
  [...limits].sort((a, b) =>
    a.isSystem === b.isSystem ? 0 : a.isSystem ? -1 : 1,
  );

export const ControlledCopiesPolicyView: React.FC = () => {
  const { navigateTo } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const { hasPermissionAlias } = usePermissions();
  const canManagePolicy = hasPermissionAlias(
    "documents.admin.controlled_copies_policy.manage",
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<PolicyState>(defaultPolicy);
  // Snapshot taken right after load and right after a successful save -- Save Changes stays
  // disabled until something in policy/expiryLimits actually diverges from it.
  const [original, setOriginal] = useState<{ policy: PolicyState; expiryLimits: ControlledCopyExpiryLimit[] } | null>(null);
  const [markingTab, setMarkingTab] = useState<MarkingTabKey>("ISSUED");
  const [previewPageKind, setPreviewPageKind] = useState<"COVER" | "BODY">(
    "COVER",
  );
  // The page tab lives in the URL (?tab=markings) so a refresh or a shared link opens the same tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: PolicyTabKey =
    searchParams.get("tab") === "markings" ? "markings" : "policy";
  const selectTab = (tab: PolicyTabKey) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "policy") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const [dcoUsers, setDcoUsers] = useState<ControlledCopyDcoEligibleUser[]>([]);
  const [dcoUsersLoaded, setDcoUsersLoaded] = useState(false);

  // Held as a local draft, same as every other field on this screen -- persisted only when "Save
  // Changes" is clicked, under that one signature, as part of that one consolidated Audit Trail
  // entry. A new rule's id is "" until the save round-trip returns its real one.
  const [expiryLimits, setExpiryLimits] = useState<ControlledCopyExpiryLimit[]>(
    [],
  );
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [editingLimit, setEditingLimit] =
    useState<ControlledCopyExpiryLimit | null>(null);
  const [limitForm, setLimitForm] = useState<{
    documentTypeId: string;
    departmentId: string;
    durationValue: string;
    durationUnit: ControlledCopyExpiryDurationUnit;
    active: boolean;
  }>({
    documentTypeId: "",
    departmentId: "",
    durationValue: "",
    durationUnit: "DAYS",
    active: true,
  });

  useEffect(() => {
    dictionaryApi
      .getDocumentTypes()
      .then(setDocumentTypes)
      .catch(() => {});
    dictionaryApi
      .getDepartments()
      .then(setDepartments)
      .catch(() => {});
    controlledCopyPolicyApi
      .getDcoEligibleUsers()
      .then((users) => setDcoUsers(users))
      .catch(() => {})
      .finally(() => setDcoUsersLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddLimitModal = () => {
    setEditingLimit(null);
    setLimitForm({
      documentTypeId: "",
      departmentId: "",
      durationValue: "",
      durationUnit: "DAYS",
      active: true,
    });
    setIsLimitModalOpen(true);
  };

  const openEditLimitModal = (limit: ControlledCopyExpiryLimit) => {
    setEditingLimit(limit);
    setLimitForm({
      documentTypeId: limit.documentTypeId || "",
      departmentId: limit.departmentId || "",
      durationValue: String(limit.durationValue),
      durationUnit: limit.durationUnit || "DAYS",
      active: limit.active,
    });
    setIsLimitModalOpen(true);
  };

  /** Edits the in-memory draft only -- no API call, no signature. The rule is only actually
   *  persisted (created/updated/deleted) when the page's own "Save Changes" is signed. */
  const handleSaveLimit = () => {
    const durationValue = Number(limitForm.durationValue);
    if (!durationValue || durationValue <= 0) {
      showToast({
        type: "error",
        title: "Error",
        message: "Duration must be a positive number.",
      });
      return;
    }
    const documentType = documentTypes.find((d) => d.id === limitForm.documentTypeId);
    const department = departments.find((d) => d.id === limitForm.departmentId);
    const draftRow: ControlledCopyExpiryLimit = {
      id: editingLimit?.id ?? "",
      documentTypeId: editingLimit?.isSystem ? null : limitForm.documentTypeId || null,
      documentTypeName: editingLimit?.isSystem ? null : documentType?.name ?? null,
      departmentId: editingLimit?.isSystem ? null : limitForm.departmentId || null,
      departmentName: editingLimit?.isSystem ? null : department?.name ?? null,
      durationValue,
      durationUnit: limitForm.durationUnit,
      active: limitForm.active,
      isSystem: Boolean(editingLimit?.isSystem),
    };
    setExpiryLimits((prev) =>
      sortExpiryLimits(
        editingLimit
          ? prev.map((l) => (l === editingLimit ? draftRow : l))
          : [...prev, draftRow],
      ),
    );
    showToast({
      type: "success",
      title: editingLimit ? "Rule updated" : "Rule added",
      message: 'Not saved yet -- click "Save Changes" to persist it.',
    });
    setIsLimitModalOpen(false);
  };

  const handleDeleteLimit = (limit: ControlledCopyExpiryLimit) => {
    if (
      !window.confirm(
        `Remove the expiry rule "${(limit.documentTypeName || "Any document type") + " / " + (limit.departmentName || "Any department")}" from this draft? It is only actually deleted once you click "Save Changes".`,
      )
    ) {
      return;
    }
    setExpiryLimits((prev) => prev.filter((l) => l !== limit));
  };

  const breadcrumbItems = useMemo(
    () => controlledCopiesPolicyBreadcrumbs(navigateTo),
    [navigateTo],
  );

  useEffect(() => {
    let active = true;
    controlledCopyPolicyApi
      .getPolicy()
      .then((data) => {
        if (!active) return;
        const loadedPolicy: PolicyState = {
          distributionSecurity: {
            allowEmailDistribution:
              data.distributionSecurity?.allowEmailDistribution ??
              defaultPolicy.distributionSecurity.allowEmailDistribution,
            allowPortalView:
              data.distributionSecurity?.allowPortalView ??
              defaultPolicy.distributionSecurity.allowPortalView,
            allowDownload:
              data.distributionSecurity?.allowDownload ??
              defaultPolicy.distributionSecurity.allowDownload,
            allowPrint:
              data.distributionSecurity?.allowPrint ??
              defaultPolicy.distributionSecurity.allowPrint,
            downloadOnce:
              data.distributionSecurity?.downloadOnce ??
              defaultPolicy.distributionSecurity.downloadOnce,
            printOnce:
              data.distributionSecurity?.printOnce ??
              defaultPolicy.distributionSecurity.printOnce,
            watermarkEnabled:
              data.distributionSecurity?.watermarkEnabled ??
              defaultPolicy.distributionSecurity.watermarkEnabled,
            watermarkCopyNumber:
              data.distributionSecurity?.watermarkCopyNumber ??
              defaultPolicy.distributionSecurity.watermarkCopyNumber,
            watermarkRecipient:
              data.distributionSecurity?.watermarkRecipient ??
              defaultPolicy.distributionSecurity.watermarkRecipient,
            watermarkDistributedDate:
              data.distributionSecurity?.watermarkDistributedDate ??
              defaultPolicy.distributionSecurity.watermarkDistributedDate,
            watermarkExpiryDate:
              data.distributionSecurity?.watermarkExpiryDate ??
              defaultPolicy.distributionSecurity.watermarkExpiryDate,
            previewSessionMinutes:
              data.distributionSecurity?.previewSessionMinutes ??
              defaultPolicy.distributionSecurity.previewSessionMinutes,
          },
          recallLostDamaged: {
            allowManualRecall:
              data.recallLostDamaged?.allowManualRecall ??
              defaultPolicy.recallLostDamaged.allowManualRecall,
            allowReportLostDamaged:
              data.recallLostDamaged?.allowReportLostDamaged ??
              defaultPolicy.recallLostDamaged.allowReportLostDamaged,
            allowReplacementForLostDamaged:
              data.recallLostDamaged?.allowReplacementForLostDamaged ??
              defaultPolicy.recallLostDamaged.allowReplacementForLostDamaged,
          },
          delivery: {
            redirectDeliveryToDco:
              data.delivery?.redirectDeliveryToDco ??
              defaultPolicy.delivery.redirectDeliveryToDco,
            dcoRecipientUserId: data.delivery?.dcoRecipientUserId || "",
            dcoRecipientEligible: data.delivery?.dcoRecipientEligible ?? true,
          },
          marking: { ...defaultMarking, ...(data.marking ?? {}) },
          statusMarking: {
            OBSOLETED: {
              ...defaultStatusMarking(false),
              ...(data.statusMarking?.OBSOLETED ?? {}),
            },
            CLOSED_CANCELLED: {
              ...defaultStatusMarking(true),
              ...(data.statusMarking?.CLOSED_CANCELLED ?? {}),
            },
          },
        };
        const loadedExpiryLimits = sortExpiryLimits((data.expiryLimits as ControlledCopyExpiryLimit[]) ?? []);
        setPolicy(loadedPolicy);
        setExpiryLimits(loadedExpiryLimits);
        setOriginal({ policy: loadedPolicy, expiryLimits: loadedExpiryLimits });
      })
      .catch((error) => {
        if (active)
          showToast({
            type: "error",
            title: "Error",
            message: getApiErrorMessage(
              error,
              "Unable to load Controlled Copies Policy from server.",
            ),
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const handleSave = async () => {
    const sessionMinutes = policy.distributionSecurity.previewSessionMinutes;
    if (
      !Number.isInteger(sessionMinutes) ||
      sessionMinutes < SESSION_MIN_MINUTES ||
      sessionMinutes > SESSION_MAX_MINUTES
    ) {
      showToast({
        type: "error",
        title: "Error",
        message:
          "External viewer session length must be between 5 minutes and 8 hours.",
      });
      return;
    }
    if (
      policy.delivery.redirectDeliveryToDco &&
      !policy.delivery.dcoRecipientUserId
    ) {
      showToast({
        type: "error",
        title: "Error",
        message: "Select a DCO recipient before enabling delivery redirection.",
      });
      return;
    }
    const sig = await requestSignature(
      "Update Controlled Copies Policy",
      "Security Configuration Change",
    );
    if (!sig) return;
    setSaving(true);
    try {
      const saved = await controlledCopyPolicyApi.savePolicy(
        {
          distributionSecurity: policy.distributionSecurity,
          recallLostDamaged: policy.recallLostDamaged,
          delivery: {
            redirectDeliveryToDco: policy.delivery.redirectDeliveryToDco,
            dcoRecipientUserId: policy.delivery.dcoRecipientUserId || null,
          },
          marking: policy.marking,
          statusMarking: policy.statusMarking,
          // Every row (kept/edited/newly added); anything currently stored but missing from this
          // list is deleted -- see ControlledCopyExpiryLimitInput's javadoc on the backend.
          expiryLimits: expiryLimits.map((l) => ({
            id: l.id || undefined,
            documentTypeId: l.documentTypeId || null,
            departmentId: l.departmentId || null,
            durationValue: l.durationValue,
            durationUnit: l.durationUnit,
            active: l.active,
          })),
        },
        sig,
      );
      // The round trip returns real ids for any newly-added rule, so the draft can keep editing
      // (e.g. clicking Edit again) without treating an already-created rule as still-new.
      const savedExpiryLimits = saved.expiryLimits
        ? sortExpiryLimits(saved.expiryLimits as ControlledCopyExpiryLimit[])
        : expiryLimits;
      if (saved.expiryLimits) {
        setExpiryLimits(savedExpiryLimits);
      }
      setOriginal({ policy, expiryLimits: savedExpiryLimits });
      showToast({
        type: "success",
        title: "Success",
        message: "Controlled Copies Policy saved successfully.",
      });
    } catch (err) {
      showToast({
        type: "error",
        title: "Error",
        message: extractApiMessage(
          err,
          "Failed to save policy. Please try again.",
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  const setDS = <K extends keyof PolicyState["distributionSecurity"]>(
    key: K,
    value: boolean,
  ) =>
    setPolicy((p) => ({
      ...p,
      distributionSecurity: { ...p.distributionSecurity, [key]: value },
    }));
  const setPreviewSessionMinutes = (minutes: number) =>
    setPolicy((p) => ({
      ...p,
      distributionSecurity: {
        ...p.distributionSecurity,
        previewSessionMinutes: minutes,
      },
    }));
  const setRecall = <K extends keyof PolicyState["recallLostDamaged"]>(
    key: K,
    value: boolean,
  ) =>
    setPolicy((p) => ({
      ...p,
      recallLostDamaged: { ...p.recallLostDamaged, [key]: value },
    }));
  const setStatusMarking = <K extends keyof ControlledCopyStatusMarking>(
    status: ControlledCopyStatusMarkingKey,
    key: K,
    value: ControlledCopyStatusMarking[K],
  ) =>
    setPolicy((p) => ({
      ...p,
      statusMarking: {
        ...p.statusMarking,
        [status]: { ...p.statusMarking[status], [key]: value },
      },
    }));
  const setMarking = <K extends keyof ControlledCopyPolicyMarking>(
    key: K,
    value: ControlledCopyPolicyMarking[K],
  ) => setPolicy((p) => ({ ...p, marking: { ...p.marking, [key]: value } }));

  const hasCustomPosition = (kind: "stamp" | "watermark") =>
    (markingTab === "ISSUED"
      ? policy.marking.placements
      : policy.statusMarking[markingTab].placements
    )?.some((placement) =>
      Object.entries(placement).some(([key, value]) =>
        key.startsWith(kind) && value != null,
      ),
    ) ?? false;

  const resetPosition = (kind: "stamp" | "watermark") => {
    if (!canManagePolicy || saving) return;
    setPolicy((previous) => {
      const marking = markingTab === "ISSUED"
        ? previous.marking
        : previous.statusMarking[markingTab];
      const placements = (marking.placements ?? [])
        .map((placement) => {
          if (kind === "stamp") {
            const { stampX, stampY, stampWidthPercent, ...remaining } = placement;
            return remaining;
          }
          const { watermarkX, watermarkY, watermarkScalePercent, watermarkAngleDegrees, ...remaining } = placement;
          return remaining;
        })
        .filter((placement) => Object.entries(placement)
          .some(([key, value]) => key !== "pages" && value != null));
      return markingTab === "ISSUED"
        ? { ...previous, marking: { ...previous.marking, placements } }
        : {
            ...previous,
            statusMarking: {
              ...previous.statusMarking,
              [markingTab]: { ...previous.statusMarking[markingTab], placements },
            },
          };
    });
  };

  const renderResetPosition = (kind: "stamp" | "watermark") =>
    canManagePolicy && hasCustomPosition(kind) && (
      <div className="mt-4 flex justify-end border-t border-slate-200 pt-3">
        <Button
          size="sm"
          variant="outline-emerald"
          aria-label={`Reset ${kind === "stamp" ? "Stamp" : "Watermark"} Position`}
          onClick={() => resetPosition(kind)}
          disabled={saving}
        >
          Reset Position
        </Button>
      </div>
    );

  /** Adds/updates/removes one placement rule for the given pages, keeping the rest untouched. */
  const upsertPlacement = (
    placements: MarkingPlacementRule[] | undefined,
    pagesKey: "FIRST" | "OTHERS",
    patch: Partial<MarkingPlacementRule>,
  ): MarkingPlacementRule[] => {
    const list = placements ? [...placements] : [];
    const index = list.findIndex((r) => r.pages === pagesKey);
    if (index === -1) {
      list.push({ pages: pagesKey, ...patch });
    } else {
      list[index] = { ...list[index], ...patch };
    }
    return list;
  };

  const handleIssuedPlacementChange = (
    kind: "stamp" | "watermark",
    pagesKey: "FIRST" | "OTHERS",
    patch: Partial<MarkingPlacementRule> | null,
  ) =>
    setPolicy((p) => ({
      ...p,
      marking: {
        ...p.marking,
        placements: patch
          ? upsertPlacement(p.marking.placements, pagesKey, patch)
          : p.marking.placements,
      },
    }));

  const handleStatusPlacementChange = (
    status: ControlledCopyStatusMarkingKey,
    kind: "stamp" | "watermark",
    pagesKey: "FIRST" | "OTHERS",
    patch: Partial<MarkingPlacementRule> | null,
  ) =>
    setPolicy((p) => ({
      ...p,
      statusMarking: {
        ...p.statusMarking,
        [status]: {
          ...p.statusMarking[status],
          placements: patch
            ? upsertPlacement(
                p.statusMarking[status].placements,
                pagesKey,
                patch,
              )
            : p.statusMarking[status].placements,
        },
      },
    }));
  const setDelivery = <K extends keyof PolicyState["delivery"]>(
    key: K,
    value: PolicyState["delivery"][K],
  ) => setPolicy((p) => ({ ...p, delivery: { ...p.delivery, [key]: value } }));

  if (loading) return <FullPageLoading />;

  const isDirty =
    original !== null &&
    (JSON.stringify(policy) !== JSON.stringify(original.policy) ||
      JSON.stringify(expiryLimits) !== JSON.stringify(original.expiryLimits));

  const selectedDurationUnit =
    DURATION_UNIT_OPTIONS.find((u) => u.value === limitForm.durationUnit) ||
    DURATION_UNIT_OPTIONS[1];

  // Warn when this rule is *longer* (laxer) than the rule it would otherwise override for the
  // same scope -- e.g. a Global Default of 1 Day, with a new SOP-specific rule of 3 Days: the more
  // specific rule always wins by design (not a conflict the system can't resolve), but a duration
  // longer than what it overrides is very likely an accidental relaxation, not the intent.
  const enteredDurationValue = Number(limitForm.durationValue);
  const overriddenLimit =
    !editingLimit?.isSystem && enteredDurationValue > 0
      ? resolveFallbackLimit(
          expiryLimits,
          limitForm.documentTypeId,
          limitForm.departmentId,
          editingLimit?.id,
        )
      : null;
  const isLaxerThanOverridden =
    overriddenLimit != null &&
    toApproxHours(enteredDurationValue, limitForm.durationUnit) >
      toApproxHours(
        overriddenLimit.durationValue,
        overriddenLimit.durationUnit,
      );

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="Controlled Copies Policy"
        breadcrumbItems={breadcrumbItems}
        actions={
          canManagePolicy ? (
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="gap-2 whitespace-nowrap"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={POLICY_TABS}
          activeTab={activeTab}
          onChange={(id) => selectTab(id as PolicyTabKey)}
          ariaLabel="Controlled copies policy sections"
        />

        <div className="p-4 md:p-5">
          {activeTab === "policy" && (
            <div className="space-y-4">
              {/* Distribution & Access */}
              <FormSection
                title="Distribution & Access"
                icon={<Mail className="h-4 w-4" />}
              >
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
                      Channels
                    </p>
                    <div className="divide-y divide-slate-100 -my-2">
                      <SwitchRow
                        label="Email distribution"
                        checked={
                          policy.distributionSecurity.allowEmailDistribution
                        }
                        onChange={(v) => setDS("allowEmailDistribution", v)}
                        disabled={!canManagePolicy}
                        note="Allow distribution notifications and links by email."
                      />
                      <SwitchRow
                        label="Portal view"
                        checked={policy.distributionSecurity.allowPortalView}
                        onChange={(v) => setDS("allowPortalView", v)}
                        disabled={!canManagePolicy}
                        note="Allow recipients to open the controlled-copy portal."
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
                      Recipient Actions
                    </p>
                    <div className="divide-y divide-slate-100 -my-2">
                      <SwitchRow
                        label="Download"
                        checked={policy.distributionSecurity.allowDownload}
                        onChange={(v) => setDS("allowDownload", v)}
                        disabled={!canManagePolicy}
                        note="Allow downloading a PDF copy."
                      />
                      {policy.distributionSecurity.allowDownload && (
                        <div className="pl-3 border-l-2 border-emerald-100 ml-1">
                          <SwitchRow
                            label="One download per record"
                            checked={policy.distributionSecurity.downloadOnce}
                            onChange={(v) => setDS("downloadOnce", v)}
                            disabled={!canManagePolicy}
                          />
                        </div>
                      )}
                      <SwitchRow
                        label="Print"
                        checked={policy.distributionSecurity.allowPrint}
                        onChange={(v) => setDS("allowPrint", v)}
                        disabled={!canManagePolicy}
                        note="Allow the viewer Print command and Ctrl+P."
                      />
                      {policy.distributionSecurity.allowPrint && (
                        <div className="pl-3 border-l-2 border-emerald-100 ml-1">
                          <SwitchRow
                            label="One print per record"
                            checked={policy.distributionSecurity.printOnce}
                            onChange={(v) => setDS("printOnce", v)}
                            disabled={!canManagePolicy}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
                      External Viewer Session
                    </p>
                    <SessionLengthField
                      minutes={
                        policy.distributionSecurity.previewSessionMinutes
                      }
                      onChange={setPreviewSessionMinutes}
                      disabled={!canManagePolicy}
                    />
                  </div>
                </div>
              </FormSection>

              {/* DCO Delivery Routing */}
              <FormSection
                title="DCO Delivery Routing"
                icon={<UserCheck className="h-4 w-4" />}
              >
                <div className="divide-y divide-slate-100 -my-2">
                  <SwitchRow
                    label="Redirect delivery to DCO"
                    checked={policy.delivery.redirectDeliveryToDco}
                    onChange={(v) => setDelivery("redirectDeliveryToDco", v)}
                    disabled={!canManagePolicy}
                  />
                  {policy.delivery.redirectDeliveryToDco && (
                    <div className="pl-3 border-l-2 border-sky-200 ml-1 pt-3 pb-1 space-y-2">
                      {dcoUsersLoaded && dcoUsers.length === 0 && (
                        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-2xs text-amber-800">
                          No user currently holds the "Receive Controlled
                          Copies as DCO" permission yet, so there is no one to
                          select below. Grant it to at least one user via
                          Access Profiles / Permission Sets, then come back and
                          pick them here -- this switch can stay on in the
                          meantime, but saving needs a recipient.
                        </p>
                      )}
                      <Select
                        label="DCO Recipient"
                        placeholder="Select the user who will receive controlled copies"
                        options={dcoUsers.map((u) => ({
                          label: u.email
                            ? `${u.fullName} (${u.email})`
                            : u.fullName,
                          value: u.id,
                        }))}
                        value={policy.delivery.dcoRecipientUserId}
                        onChange={(v) =>
                          setDelivery("dcoRecipientUserId", String(v))
                        }
                        disabled={!canManagePolicy}
                      />
                      {policy.delivery.dcoRecipientUserId &&
                        !policy.delivery.dcoRecipientEligible && (
                          <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-2xs text-rose-700">
                            This user no longer holds the "Receive Controlled
                            Copies as DCO" permission (revoked, or account
                            inactive). Until fixed, distributions fall back to
                            normal delivery and the issue is logged. Select a
                            different eligible user, or re-grant the
                            permission.
                          </p>
                        )}
                    </div>
                  )}
                </div>
              </FormSection>

              {/* Recall / Lost / Damaged */}
              <FormSection
                title="Recall / Lost / Damaged"
                icon={<RotateCcw className="h-4 w-4" />}
              >
                <div className="divide-y divide-slate-100 -my-2">
                  <SwitchRow
                    label="Allow Manual Recall"
                    checked={policy.recallLostDamaged.allowManualRecall}
                    onChange={(v) => setRecall("allowManualRecall", v)}
                    disabled={!canManagePolicy}
                    note="Lets a DCO pull back a distributed copy, e.g. after a new revision is published."
                  />
                  <SwitchRow
                    label="Allow Report Lost/Damaged"
                    checked={policy.recallLostDamaged.allowReportLostDamaged}
                    onChange={(v) => setRecall("allowReportLostDamaged", v)}
                    disabled={!canManagePolicy}
                    note="Lets a recipient report their copy as lost or damaged (evidence required for damaged)."
                  />
                  <SwitchRow
                    label="Allow Replacement"
                    checked={
                      policy.recallLostDamaged.allowReplacementForLostDamaged
                    }
                    onChange={(v) =>
                      setRecall("allowReplacementForLostDamaged", v)
                    }
                    disabled={!canManagePolicy}
                    note="Lets a new copy be issued to replace one reported lost or damaged."
                  />
                </div>
              </FormSection>

              {/* Every Controlled Copy always has an expiry; the mandatory "Global Default" row guarantees a
                  resolution, with document type/department rows overriding it when more specific. */}
              <FormSection
                title="Expiry Duration"
                icon={<TimerReset className="h-4 w-4" />}
                headerRight={
                  canManagePolicy && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={openAddLimitModal}
                      className="gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Rule
                    </Button>
                  )
                }
              >
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <TableMarkup.Root className="w-full text-xs sm:text-sm">
                    <TableMarkup.Head className="bg-slate-50">
                      <TableMarkup.Row>
                        <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell43}>
                          Document Type
                        </TableMarkup.HeaderCell>
                        <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell43}>
                          Department
                        </TableMarkup.HeaderCell>
                        <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell43}>
                          Duration
                        </TableMarkup.HeaderCell>
                        <TableMarkup.HeaderCell className="text-right px-3 py-2 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Actions
                        </TableMarkup.HeaderCell>
                      </TableMarkup.Row>
                    </TableMarkup.Head>
                    <TableMarkup.Body className="divide-y divide-slate-100">
                      {expiryLimits.map((limit) => (
                        <TableMarkup.Row
                          key={limit.id}
                          className={
                            limit.isSystem ? "bg-emerald-50/40" : undefined
                          }
                        >
                          <TableMarkup.Cell className="px-3 py-2 text-slate-700">
                            {limit.isSystem ? (
                              <span className="font-semibold text-emerald-700">
                                Global Default
                              </span>
                            ) : (
                              limit.documentTypeName || "Any"
                            )}
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="px-3 py-2 text-slate-700">
                            {limit.isSystem
                              ? "Any"
                              : limit.departmentName || "Any"}
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">
                            {limit.durationValue}{" "}
                            {DURATION_UNIT_OPTIONS.find(
                              (u) => u.value === limit.durationUnit,
                            )?.label || limit.durationUnit}
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="px-3 py-2 text-right whitespace-nowrap">
                            {canManagePolicy && (
                              <button
                                type="button"
                                onClick={() => openEditLimitModal(limit)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Edit rule"
                              >
                                <IconPencilMinus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canManagePolicy && !limit.isSystem && (
                              <button
                                type="button"
                                onClick={() => handleDeleteLimit(limit)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Delete rule"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </TableMarkup.Cell>
                        </TableMarkup.Row>
                      ))}
                    </TableMarkup.Body>
                  </TableMarkup.Root>
                </div>
              </FormSection>
            </div>
          )}

          {activeTab === "markings" && (
            <div>
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
                <div className="min-w-0 space-y-4 lg:col-span-4">
                  <div
                    role="tablist"
                    aria-label="Marking scenario"
                    className="flex flex-nowrap gap-1 rounded-lg bg-slate-100 p-1"
                  >
                    {MARKING_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={markingTab === tab.key}
                        onClick={() => setMarkingTab(tab.key)}
                        className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-2xs sm:text-xs font-medium transition-colors ${
                          markingTab === tab.key
                            ? "bg-white text-emerald-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {markingTab === "ISSUED" ? (
                    <div className="space-y-4">
                      <MarkCard
                        title="Stamp"
                        enabled={policy.marking.stampEnabled}
                        onToggle={(v) => setMarking("stampEnabled", v)}
                        disabled={!canManagePolicy}
                      >
                        <StampFields
                          value={policy.marking}
                          onChange={(k, v) =>
                            setMarking(
                              k as keyof ControlledCopyPolicyMarking,
                              v as never,
                            )
                          }
                          disabled={!canManagePolicy}
                        />
                        <ShowToggles
                          disabled={!canManagePolicy}
                          items={[
                            {
                              label: "Copy number",
                              checked: policy.marking.stampShowCopyNumber,
                              onChange: (v) =>
                                setMarking("stampShowCopyNumber", v),
                            },
                            {
                              label: "Recipient",
                              checked: policy.marking.stampShowRecipient,
                              onChange: (v) =>
                                setMarking("stampShowRecipient", v),
                            },
                            {
                              label: "Distributed date",
                              checked: policy.marking.stampShowDistributedDate,
                              onChange: (v) =>
                                setMarking("stampShowDistributedDate", v),
                            },
                            {
                              label: "Expiry date",
                              checked: policy.marking.stampShowExpiryDate,
                              onChange: (v) =>
                                setMarking("stampShowExpiryDate", v),
                            },
                          ]}
                        />
                        {renderResetPosition("stamp")}
                      </MarkCard>

                      <MarkCard
                        title="Watermark"
                        enabled={policy.distributionSecurity.watermarkEnabled}
                        onToggle={(v) => setDS("watermarkEnabled", v)}
                        disabled={!canManagePolicy}
                      >
                        <WatermarkFields
                          value={policy.marking}
                          onChange={(k, v) =>
                            setMarking(
                              k as keyof ControlledCopyPolicyMarking,
                              v as never,
                            )
                          }
                          disabled={!canManagePolicy}
                          textHint="Letters, digits and . , : ; / ( ) -"
                          opacityRange={[5, 50]}
                          layerOptions={[
                            {
                              label: "Behind the content (text stays crisp)",
                              value: "BEHIND",
                            },
                            {
                              label: "Above the content (always visible)",
                              value: "ABOVE",
                            },
                          ]}
                        />
                        <ShowToggles
                          disabled={!canManagePolicy}
                          items={[
                            {
                              label: "Copy number",
                              checked:
                                policy.distributionSecurity.watermarkCopyNumber,
                              onChange: (v) => setDS("watermarkCopyNumber", v),
                            },
                            {
                              label: "Recipient",
                              checked:
                                policy.distributionSecurity.watermarkRecipient,
                              onChange: (v) => setDS("watermarkRecipient", v),
                            },
                            {
                              label: "Distributed date",
                              checked:
                                policy.distributionSecurity
                                  .watermarkDistributedDate,
                              onChange: (v) =>
                                setDS("watermarkDistributedDate", v),
                            },
                            {
                              label: "Expiry date",
                              checked:
                                policy.distributionSecurity.watermarkExpiryDate,
                              onChange: (v) => setDS("watermarkExpiryDate", v),
                            },
                          ]}
                        />
                        {renderResetPosition("watermark")}
                      </MarkCard>
                    </div>
                  ) : (
                    (() => {
                      const status = markingTab;
                      const cfg = policy.statusMarking[status];
                      const set = (k: string, v: string | number) =>
                        setStatusMarking(
                          status,
                          k as keyof ControlledCopyStatusMarking,
                          v as never,
                        );
                      return (
                        <div className="space-y-4">
                          <MarkCard
                            title="Stamp"
                            enabled={cfg.stampEnabled}
                            onToggle={(v) =>
                              setStatusMarking(status, "stampEnabled", v)
                            }
                            disabled={!canManagePolicy}
                          >
                            <StampFields
                              value={cfg}
                              onChange={set}
                              disabled={!canManagePolicy}
                            />
                            <ShowToggles
                              disabled={!canManagePolicy}
                              items={[
                                {
                                  label:
                                    status === "OBSOLETED"
                                      ? "Withdrawal date"
                                      : "Cancellation date",
                                  checked: cfg.stampShowDate,
                                  onChange: (v) =>
                                    setStatusMarking(
                                      status,
                                      "stampShowDate",
                                      v,
                                    ),
                                },
                              ]}
                            />
                            {renderResetPosition("stamp")}
                          </MarkCard>
                          <MarkCard
                            title="Watermark"
                            enabled={cfg.watermarkEnabled}
                            onToggle={(v) =>
                              setStatusMarking(status, "watermarkEnabled", v)
                            }
                            disabled={!canManagePolicy}
                          >
                            <WatermarkFields
                              value={cfg}
                              onChange={set}
                              disabled={!canManagePolicy}
                              textHint="Leave blank to use the automatic text."
                              opacityRange={[5, 60]}
                              layerOptions={[
                                {
                                  label: "Above the content (always visible)",
                                  value: "ABOVE",
                                },
                                {
                                  label: "Behind the content",
                                  value: "BEHIND",
                                },
                              ]}
                            />
                            <ShowToggles
                              disabled={!canManagePolicy}
                              items={[
                                {
                                  label:
                                    status === "OBSOLETED"
                                      ? "Withdrawal date"
                                      : "Cancellation date",
                                  checked: cfg.watermarkShowDate,
                                  onChange: (v) =>
                                    setStatusMarking(
                                      status,
                                      "watermarkShowDate",
                                      v,
                                    ),
                                },
                              ]}
                            />
                            {renderResetPosition("watermark")}
                          </MarkCard>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* The picture comes first on narrow screens (so it's seen before the settings) and to the right on wide ones. */}
                <div className="order-first min-w-0 lg:order-last lg:col-span-8 lg:sticky lg:top-4">
                  <MarkingPreviewPane
                    scenario={markingTab}
                    draft={{
                      distributionSecurity: policy.distributionSecurity,
                      marking: policy.marking,
                      statusMarking: policy.statusMarking,
                    }}
                    pageKind={previewPageKind}
                    onPageKindChange={setPreviewPageKind}
                    onPlacementChange={
                      markingTab === "ISSUED"
                        ? handleIssuedPlacementChange
                        : (kind, pagesKey, patch) =>
                            handleStatusPlacementChange(
                              markingTab,
                              kind,
                              pagesKey,
                              patch,
                            )
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <FormModal
        isOpen={isLimitModalOpen}
        onClose={() => setIsLimitModalOpen(false)}
        onConfirm={handleSaveLimit}
        title={
          editingLimit
            ? editingLimit.isSystem
              ? "Edit Global Default"
              : "Edit Expiry Rule"
            : "Add Expiry Rule"
        }
        confirmText="Save"
      >
        <div className="space-y-3">
          {editingLimit?.isSystem ? (
            <p className="text-2xs text-slate-500 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              The Global Default applies to Any document type / Any department
              and cannot be scoped — only its duration can be edited.
            </p>
          ) : (
            <>
              <Select
                label="Document Type"
                options={[
                  { label: "Any", value: "" },
                  ...documentTypes.map((d) => ({ label: d.name, value: d.id })),
                ]}
                value={limitForm.documentTypeId}
                onChange={(v) =>
                  setLimitForm((f) => ({ ...f, documentTypeId: v as string }))
                }
              />
              <Select
                label="Department"
                options={[
                  { label: "Any", value: "" },
                  ...departments.map((d) => ({ label: d.name, value: d.id })),
                ]}
                value={limitForm.departmentId}
                onChange={(v) =>
                  setLimitForm((f) => ({ ...f, departmentId: v as string }))
                }
              />
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs sm:text-sm text-slate-700 mb-1.5 block">
                Duration
              </label>
              <input
                type="number"
                min={1}
                value={limitForm.durationValue}
                onChange={(e) =>
                  setLimitForm((f) => ({ ...f, durationValue: e.target.value }))
                }
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <Select
              label="Unit"
              options={DURATION_UNIT_OPTIONS.map((u) => ({
                label: u.label,
                value: u.value,
              }))}
              value={limitForm.durationUnit}
              onChange={(v) =>
                setLimitForm((f) => ({
                  ...f,
                  durationUnit: v as ControlledCopyExpiryDurationUnit,
                }))
              }
            />
          </div>
          <p className="text-2xs text-slate-400">
            {selectedDurationUnit.example}
          </p>
          {isLaxerThanOverridden && overriddenLimit && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-2xs text-amber-800">
              This rule is longer than the{" "}
              {overriddenLimit.isSystem
                ? "Global Default"
                : overriddenLimit.documentTypeName ||
                  overriddenLimit.departmentName ||
                  "less specific"}{" "}
              rule it will override for this scope (
              {overriddenLimit.durationValue}{" "}
              {overriddenLimit.durationUnit.toLowerCase()}) — controlled copies
              here will stay valid longer than that policy intends. Confirm this
              relaxation is deliberate before saving.
            </p>
          )}
          <div className="flex items-center gap-3">
            <Checkbox
              id="isActive expiry-limit"
              checked={limitForm.active}
              onChange={(active) => setLimitForm((f) => ({ ...f, active }))}
              label="Active"
              disabled={Boolean(editingLimit?.isSystem)}
            />
          </div>
        </div>
      </FormModal>

      {signatureModal}
    </div>
  );
};
