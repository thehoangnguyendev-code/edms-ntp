import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, TimerReset, Plus, Search, X, MoreVertical } from "lucide-react";
import { IconPencilMinus, IconTrash } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch/Switch";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { FullPageLoading, SectionLoading } from "@/components/ui/loading/Loading";
import { FormSection } from "@/components/ui/form/FormSection";
import { useToast } from "@/components/ui/toast/Toast";
import { cn } from "@/components/ui/utils";
import { uncontrolledCopiesPolicy as uncontrolledCopiesPolicyBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce, usePortalDropdown } from "@/hooks";
import {
  uncontrolledCopyPolicyApi,
  type UncontrolledCopyPolicy,
  type UncontrolledCopyPolicyMarking,
  type UncontrolledCopyEligibilityRule,
} from "@/services/api/uncontrolledCopyPolicy";
import type { MarkingPlacementRule } from "@/services/api/controlledCopyPolicy";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { dictionaryApi } from "@/services/api";
import { MarkCard, ShowToggles, StampFields, WatermarkFields } from "../controlled-copies-policy/MarkingEditors";
import { MarkingPreviewPane } from "../controlled-copies-policy/MarkingPreviewPane";
import { UncontrolledCopyMarkingPreview } from "@/features/documents/uncontrolled-copies/UncontrolledCopyMarkingPreview";
import { formatDateTime } from "@/utils/format";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";

type PolicyTabKey = "policy" | "markings";

const POLICY_TABS: TabItem[] = [
  { id: "policy", label: "Eligibility & Validity" },
  { id: "markings", label: "PDF Markings" },
];

const ANY_VALUE = "ANY";

type RuleFormData = {
  documentTypeId: string;
  allowed: boolean;
  active: boolean;
};

const EMPTY_RULE_FORM: RuleFormData = {
  documentTypeId: ANY_VALUE,
  allowed: true,
  active: true,
};

const VALIDITY_MIN_HOURS = 1;
const VALIDITY_MAX_HOURS = 8760;

const DEFAULT_MARKING: UncontrolledCopyPolicyMarking = {
  watermarkEnabled: true,
  watermarkLayer: "ABOVE",
  watermarkText: "UNCONTROLLED COPY — NOT VALID FOR PRODUCTION USE",
  watermarkColor: "#C00000",
  watermarkOpacityPercent: 25,
  watermarkAngleDegrees: 35,
  watermarkFontFamily: "NOTO_SANS",
  watermarkShowDate: true,
  watermarkPages: "ALL",
  watermarkShowRecipient: true,
  watermarkShowIssuedDate: true,
  stampEnabled: true,
  stampText: "UNCONTROLLED COPY",
  stampColor: "#C00000",
  stampPosition: "TOP_RIGHT",
  stampMarginMm: 4,
  stampSize: "SMALL",
  stampOpacityPercent: 90,
  stampShowDate: true,
  stampShowCopyNumber: true,
  stampFontFamily: "NOTO_SANS",
  stampPages: "ALL",
  placements: [],
};

const DEFAULT_POLICY: UncontrolledCopyPolicy = {
  approvalRequired: true,
  validityHours: 72,
  allowRedownload: true,
  marking: DEFAULT_MARKING,
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
      <span className="text-xs sm:text-sm font-medium text-slate-900 break-words">{label}</span>
      {note && <p className="text-2xs sm:text-xs text-slate-400 mt-0.5 break-words">{note}</p>}
    </div>
    <Switch checked={checked} onChange={onChange} size="sm" disabled={disabled} />
  </div>
);

/**
 * Uncontrolled Copies Policy -- mirrors ControlledCopiesPolicyView's layout (PageHeader + TabNav + FormSection
 * cards + marking editors with a preview on the right). One "Save Changes" = one e-signature = one consolidated
 * Audit Trail entry on the server, including all staged Eligibility Rules changes.
 */
export const UncontrolledCopyPolicyView: React.FC = () => {
  const { navigateTo } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const { hasPermissionAlias } = usePermissions();
  const canManagePolicy = hasPermissionAlias("documents.admin.uncontrolled_copies_policy.manage") || hasPermissionAlias("settings.configuration.manage");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<UncontrolledCopyPolicy>(DEFAULT_POLICY);
  const [validityText, setValidityText] = useState(String(DEFAULT_POLICY.validityHours));
  // Snapshot taken right after load and right after a successful save -- Save Changes stays
  // disabled until policy/validityText actually diverges from it (eligibility rule changes are
  // tracked separately by ruleChanges below).
  const [originalPolicy, setOriginalPolicy] = useState<{ policy: UncontrolledCopyPolicy; validityText: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: PolicyTabKey = tabParam === "markings" ? tabParam : "policy";
  const selectTab = (tab: PolicyTabKey) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "policy") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const breadcrumbItems = useMemo(() => uncontrolledCopiesPolicyBreadcrumbs(navigateTo), [navigateTo]);

  useEffect(() => {
    let active = true;
    uncontrolledCopyPolicyApi
      .getPolicy()
      .then((data) => {
        if (!active) return;
        const next: UncontrolledCopyPolicy = {
          approvalRequired: data.approvalRequired ?? DEFAULT_POLICY.approvalRequired,
          validityHours: data.validityHours ?? DEFAULT_POLICY.validityHours,
          allowRedownload: data.allowRedownload ?? DEFAULT_POLICY.allowRedownload,
          marking: { ...DEFAULT_MARKING, ...(data.marking ?? {}) },
        };
        setPolicy(next);
        setValidityText(String(next.validityHours));
        setOriginalPolicy({ policy: next, validityText: String(next.validityHours) });
      })
      .catch((error) => {
        if (active) showToast({ type: "error", title: "Error", message: extractApiMessage(error, "Unable to load the Uncontrolled Copies Policy.") });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  // Filter/sort/page a complete draft matrix without replacing pending edits from the server.
  const [draftRules, setDraftRules] = useState<UncontrolledCopyEligibilityRule[]>([]);
  const [storedRules, setStoredRules] = useState<UncontrolledCopyEligibilityRule[]>([]);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesPage, setRulesPage] = useState(1);
  const [rulesLimit, setRulesLimit] = useState(20);
  const [rulesSearch, setRulesSearch] = useState("");
  const debouncedRulesSearch = useDebounce(rulesSearch, 400);
  const [rulesStatus, setRulesStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [rulesSortBy, setRulesSortBy] = useState<"documentTypeName" | "allowed" | "active" | "updatedAt">("updatedAt");
  const [rulesSortDirection, setRulesSortDirection] = useState<"asc" | "desc">("desc");
  const [documentTypeOptions, setDocumentTypeOptions] = useState<SelectOption[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<UncontrolledCopyEligibilityRule | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleFormData>(EMPTY_RULE_FORM);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<UncontrolledCopyEligibilityRule | null>(null);
  const { openId: openRuleMenuId, position: ruleMenuPosition, getRef: getRuleMenuRef, toggle: toggleRuleMenu, close: closeRuleMenu } = usePortalDropdown();

  const loadRules = useCallback(() => {
    setRulesLoading(true);
    return uncontrolledCopyPolicyApi
      .listEligibilityRules()
      .then((res) => {
        setStoredRules(res);
        setDraftRules(res);
        setRulesLoaded(true);
      })
      .catch((error) => showToast({ type: "error", title: "Error", message: extractApiMessage(error, "Unable to load eligibility rules.") }))
      .finally(() => setRulesLoading(false));
  }, [showToast]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    dictionaryApi.getDocumentTypes()
      .then((types) => setDocumentTypeOptions(types.filter((t) => t.isActive).map((t) => ({ label: t.name, value: t.id }))))
      .catch(() => setDocumentTypeOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddRuleModal = () => {
    setEditingRule(null);
    setRuleForm(EMPTY_RULE_FORM);
    setShowRuleModal(true);
  };

  const openEditRuleModal = (rule: UncontrolledCopyEligibilityRule) => {
    setEditingRule(rule);
    setRuleForm({
      documentTypeId: rule.documentTypeId ?? ANY_VALUE,
      allowed: rule.allowed,
      active: rule.active,
    });
    setShowRuleModal(true);
  };

  const closeRuleModal = () => {
    setShowRuleModal(false);
    setEditingRule(null);
  };

  const handleSaveRule = () => {
    const row: UncontrolledCopyEligibilityRule = {
      id: editingRule?.id ?? `draft-${crypto.randomUUID()}`,
      documentTypeId: ruleForm.documentTypeId === ANY_VALUE ? null : ruleForm.documentTypeId,
      documentTypeName: ruleForm.documentTypeId === ANY_VALUE ? null : documentTypeOptions.find((option) => option.value === ruleForm.documentTypeId)?.label?.toString() ?? editingRule?.documentTypeName ?? "",
      allowed: ruleForm.allowed,
      active: ruleForm.active,
      system: Boolean(storedRules.find((stored) => stored.id === editingRule?.id)?.system && ruleForm.documentTypeId === ANY_VALUE),
      updatedAt: editingRule?.updatedAt ?? "",
    };
    setDraftRules((previous) => editingRule ? previous.map((rule) => rule.id === row.id ? row : rule) : [...previous, row]);
    closeRuleModal();
  };

  const handleDeleteRule = () => {
    if (!deleteRuleTarget) return;
    setDraftRules((previous) => previous.filter((rule) => rule.id !== deleteRuleTarget.id));
    setDeleteRuleTarget(null);
  };

  const filteredRules = useMemo(() => {
    const query = debouncedRulesSearch.trim().toLocaleLowerCase();
    return draftRules.filter((rule) =>
      (rulesStatus === "ALL" || rule.active === (rulesStatus === "ACTIVE")) &&
      (rule.documentTypeName ?? "Any").toLocaleLowerCase().includes(query)
    ).sort((a, b) => {
      const left = rulesSortBy === "documentTypeName" ? a.documentTypeName ?? "Any" : a[rulesSortBy];
      const right = rulesSortBy === "documentTypeName" ? b.documentTypeName ?? "Any" : b[rulesSortBy];
      const comparison = typeof left === "boolean" ? Number(left) - Number(right) : String(left).localeCompare(String(right));
      return (rulesSortDirection === "asc" ? comparison : -comparison) || a.id.localeCompare(b.id);
    });
  }, [draftRules, debouncedRulesSearch, rulesStatus, rulesSortBy, rulesSortDirection]);
  const rulesTotal = filteredRules.length;
  const rulesTotalPages = Math.max(1, Math.ceil(rulesTotal / rulesLimit));
  const visibleRulesPage = Math.min(rulesPage, rulesTotalPages);
  const rules = filteredRules.slice((visibleRulesPage - 1) * rulesLimit, visibleRulesPage * rulesLimit);

  const ruleChanges = useMemo(() => {
    const changes = storedRules.flatMap((stored) => {
      const draft = draftRules.find((row) => row.id === stored.id);
      if (draft && draft.documentTypeId === stored.documentTypeId && draft.allowed === stored.allowed && draft.active === stored.active) return [];
      return [{
        id: stored.id, expectedUpdatedAt: stored.updatedAt, delete: !draft,
        documentTypeId: draft?.documentTypeId ?? null, allowed: draft?.allowed ?? false, active: draft?.active ?? false,
      }];
    });
    return [...changes, ...draftRules.filter((rule) => rule.id.startsWith("draft-")).map((rule) => ({
      id: null, expectedUpdatedAt: null, delete: false,
      documentTypeId: rule.documentTypeId, allowed: rule.allowed, active: rule.active,
    }))];
  }, [draftRules, storedRules]);

  const setMarking = <K extends keyof UncontrolledCopyPolicyMarking>(key: K, value: UncontrolledCopyPolicyMarking[K]) =>
    setPolicy((prev) => ({ ...prev, marking: { ...prev.marking, [key]: value } }));

  const [previewPageKind, setPreviewPageKind] = useState<"COVER" | "BODY">("COVER");

  const hasCustomPosition = (kind: "stamp" | "watermark") =>
    (policy.marking.placements ?? []).some((placement) =>
      Object.entries(placement).some(([key, value]) => key.startsWith(kind) && value != null),
    );

  const resetPosition = (kind: "stamp" | "watermark") => {
    if (!canManagePolicy || saving) return;
    setPolicy((previous) => ({
      ...previous,
      marking: {
        ...previous.marking,
        placements: (previous.marking.placements ?? []).map((placement) => {
          if (kind === "stamp") {
            const { stampX, stampY, stampWidthPercent, ...remaining } = placement;
            return remaining;
          }
          const { watermarkX, watermarkY, watermarkScalePercent, watermarkAngleDegrees, ...remaining } = placement;
          return remaining;
        }).filter((placement) => Object.entries(placement).some(([key, value]) => key !== "pages" && value != null)),
      },
    }));
  };

  /** Drag/resize on the server-rendered preview writes a per-page placement rule (FIRST = cover, OTHERS = page 2+). */
  const handlePlacementChange = (
    _kind: "stamp" | "watermark",
    pagesKey: "FIRST" | "OTHERS",
    patch: Partial<MarkingPlacementRule> | null,
  ) => {
    if (!patch || !canManagePolicy || saving) return;
    setPolicy((prev) => {
      const list = [...(prev.marking.placements ?? [])];
      const index = list.findIndex((rule) => rule.pages === pagesKey);
      if (index === -1) list.push({ pages: pagesKey, ...patch });
      else list[index] = { ...list[index], ...patch };
      return { ...prev, marking: { ...prev.marking, placements: list } };
    });
  };

  const handleSave = async () => {
    const hours = Number(validityText);
    if (!Number.isInteger(hours) || hours < VALIDITY_MIN_HOURS || hours > VALIDITY_MAX_HOURS) {
      showToast({ type: "error", title: "Error", message: "Validity must be a whole number of hours between 1 and 8760." });
      return;
    }
    setSaving(true);
    try {
      const sig = await requestSignature("Update Uncontrolled Copies Policy", "Security Configuration Change");
      if (!sig) return;
      const saved = await uncontrolledCopyPolicyApi.savePolicy(
        {
          approvalRequired: policy.approvalRequired,
          validityHours: hours,
          allowRedownload: policy.allowRedownload,
          // The watermark is mandatory: never send it disabled.
          marking: { ...policy.marking, watermarkEnabled: true },
          eligibilityRuleChanges: ruleChanges,
        },
        sig,
      );
      const savedPolicy: UncontrolledCopyPolicy = { ...saved, marking: { ...DEFAULT_MARKING, ...saved.marking } };
      setPolicy(savedPolicy);
      setValidityText(String(saved.validityHours));
      setOriginalPolicy({ policy: savedPolicy, validityText: String(saved.validityHours) });
      setStoredRules(draftRules.filter((rule) => !rule.id.startsWith("draft-")));
      setRulesLoaded(false);
      await loadRules();
      showToast({ type: "success", title: "Saved", message: "Uncontrolled Copies Policy updated." });
    } catch (error) {
      showToast({ type: "error", title: "Error", message: extractApiMessage(error, "Unable to save the Uncontrolled Copies Policy.") });
    } finally {
      setSaving(false);
    }
  };

  const ruleColumns: DataTableColumn<UncontrolledCopyEligibilityRule>[] = [
    { id: "no", header: "No.", cell: (_rule, index) => (visibleRulesPage - 1) * rulesLimit + index + 1 },
    ...([
      { id: "documentTypeName", header: "Document Type", cell: (rule: UncontrolledCopyEligibilityRule) => <>{rule.documentTypeName ?? "Any"}{rule.system && <Badge color="blue" size="xs" className="ml-2 align-middle">System Default</Badge>}</> },
      { id: "allowed", header: "Allowed", cell: (rule: UncontrolledCopyEligibilityRule) => <Badge color={rule.allowed ? "emerald" : "red"} size="sm">{rule.allowed ? "Allowed" : "Blocked"}</Badge> },
      { id: "active", header: "Status", cell: (rule: UncontrolledCopyEligibilityRule) => <Badge color={rule.active ? "emerald" : "slate"} size="sm">{rule.active ? "Active" : "Inactive"}</Badge> },
      { id: "updatedAt", header: "Updated", cell: (rule: UncontrolledCopyEligibilityRule) => formatDateTime(rule.updatedAt) },
    ] as const).map((column) => ({
      ...column,
      sort: {
        direction: rulesSortBy === column.id ? rulesSortDirection : undefined,
        onSort: () => {
          setRulesSortBy(column.id);
          setRulesSortDirection(rulesSortBy === column.id && rulesSortDirection === "asc" ? "desc" : "asc");
          setRulesPage(1);
        },
      },
    })),
  ];

  if (loading) return <FullPageLoading text="Loading Uncontrolled Copies Policy..." />;

  const isDirty =
    ruleChanges.length > 0 ||
    (originalPolicy !== null &&
      (JSON.stringify(policy) !== JSON.stringify(originalPolicy.policy) || validityText !== originalPolicy.validityText));

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="Uncontrolled Copies Policy"
        breadcrumbItems={breadcrumbItems}
        actions={
          canManagePolicy ? (
            <Button size="sm" variant="outline-emerald" onClick={handleSave} disabled={saving || !rulesLoaded || showRuleModal || !isDirty} className="gap-2 whitespace-nowrap">
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
          ariaLabel="Uncontrolled copies policy sections"
        />

        <fieldset disabled={saving} className="min-w-0 p-4 md:p-5">
          {activeTab === "policy" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
              <FormSection title="Eligibility" icon={<ShieldCheck className="h-4 w-4" />}>
                <div className="divide-y divide-slate-100 -my-2">
                  <SwitchRow
                    label="Approval required"
                    checked={policy.approvalRequired}
                    onChange={(v) => setPolicy((prev) => ({ ...prev, approvalRequired: v }))}
                    disabled={!canManagePolicy}
                    note="When on, every request waits for an approver (e-signed) before the copy can be generated."
                  />
                </div>
                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-2xs sm:text-xs text-slate-500">
                  Configure allowed Document Types in Eligibility Rules below. Only the current Effective revision can ever be requested.
                </p>
              </FormSection>

              <FormSection title="Validity" icon={<TimerReset className="h-4 w-4" />}>
                <div className="space-y-4">
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Validity after distribution (hours)</label>
                    <input
                      type="number"
                      min={VALIDITY_MIN_HOURS}
                      max={VALIDITY_MAX_HOURS}
                      step={1}
                      value={validityText}
                      onChange={(e) => setValidityText(e.target.value)}
                      disabled={!canManagePolicy}
                      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <p className="mt-1 text-2xs text-slate-400">1 to 8760. After this window the file can no longer be viewed or downloaded.</p>
                  </div>
                  <div className="divide-y divide-slate-100 -my-2">
                    <SwitchRow
                      label="Allow re-download"
                      checked={policy.allowRedownload}
                      onChange={(v) => setPolicy((prev) => ({ ...prev, allowRedownload: v }))}
                      disabled={!canManagePolicy}
                      note="When off, the recipient can download the copy only once within the validity window."
                    />
                  </div>
                </div>
              </FormSection>
            </div>
          )}

          {activeTab === "markings" && (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
              <div className="min-w-0 space-y-4 lg:col-span-5">
                <MarkCard title="Watermark (mandatory)" enabled onToggle={() => undefined} disabled>
                  <WatermarkFields
                    value={{ ...policy.marking, watermarkPages: undefined }}
                    onChange={(k, v) => setMarking(k as keyof UncontrolledCopyPolicyMarking, v as never)}
                    disabled={!canManagePolicy}
                    textHint='The watermark title line. Leave as the default, or replace it entirely -- the watermark itself always prints, only its wording is editable.'
                    opacityRange={[5, 60]}
                    layerOptions={[
                      { label: "Above the content (always visible)", value: "ABOVE" },
                      { label: "Behind the content", value: "BEHIND" },
                    ]}
                  />
                  <ShowToggles
                    disabled={!canManagePolicy}
                    items={[
                      {
                        label: "Recipient",
                        checked: policy.marking.watermarkShowRecipient ?? true,
                        onChange: (v) => setMarking("watermarkShowRecipient", v),
                      },
                      {
                        label: "Issued date",
                        checked: policy.marking.watermarkShowIssuedDate ?? true,
                        onChange: (v) => setMarking("watermarkShowIssuedDate", v),
                      },
                    ]}
                  />
                  {canManagePolicy && hasCustomPosition("watermark") && (
                    <div className="mt-4 flex justify-end border-t border-slate-200 pt-3">
                      <Button size="sm" variant="outline-emerald" aria-label="Reset Watermark Position" onClick={() => resetPosition("watermark")} disabled={saving}>
                        Reset Position
                      </Button>
                    </div>
                  )}
                </MarkCard>
                <MarkCard
                  title="Stamp"
                  enabled={policy.marking.stampEnabled}
                  onToggle={(v) => setMarking("stampEnabled", v)}
                  disabled={!canManagePolicy}
                >
                  <StampFields
                    value={policy.marking}
                    onChange={(k, v) => setMarking(k as keyof UncontrolledCopyPolicyMarking, v as never)}
                    disabled={!canManagePolicy}
                  />
                  <ShowToggles
                    disabled={!canManagePolicy}
                    items={[
                      {
                        label: "Copy number",
                        checked: policy.marking.stampShowCopyNumber ?? true,
                        onChange: (v) => setMarking("stampShowCopyNumber", v),
                      },
                      {
                        label: "Issue date",
                        checked: policy.marking.stampShowDate,
                        onChange: (v) => setMarking("stampShowDate", v),
                      },
                    ]}
                  />
                  {canManagePolicy && hasCustomPosition("stamp") && (
                    <div className="mt-4 flex justify-end border-t border-slate-200 pt-3">
                      <Button size="sm" variant="outline-emerald" aria-label="Reset Stamp Position" onClick={() => resetPosition("stamp")} disabled={saving}>
                        Reset Position
                      </Button>
                    </div>
                  )}
                </MarkCard>
              </div>
              <div className="order-first min-w-0 space-y-2 lg:order-last lg:col-span-7 lg:sticky lg:top-4">
                {canManagePolicy ? (
                  <>
                    <MarkingPreviewPane
                      copyType="UNCONTROLLED"
                      marking={{ ...policy.marking, watermarkEnabled: true }}
                      pageKind={previewPageKind}
                      onPageKindChange={setPreviewPageKind}
                      onPlacementChange={handlePlacementChange}
                    />
                  </>
                ) : (
                  <UncontrolledCopyMarkingPreview marking={policy.marking} />
                )}
              </div>
            </div>
          )}

          {activeTab === "policy" && (
            <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5">
              <h2 className="text-sm font-semibold text-slate-900">Eligibility Rules</h2>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Changes are drafts until you click Save Changes. {ruleChanges.length > 0 && `${ruleChanges.length} rule change(s) pending.`}
              </p>
              {!rulesLoaded && !rulesLoading && (
                <Button variant="outline" size="sm" onClick={() => void loadRules()}>Reload saved rules</Button>
              )}
              <p className="text-2xs sm:text-xs text-slate-500 flex items-start gap-2">
                Rules are evaluated by Document Type. "Any" matches every document type.
                An active "Any" rule applies whenever no more specific active rule matches. If no active rule matches, issuance is blocked.
              </p>

              <div className="flex items-center justify-between gap-2">
                <div className="flex-1" />
                {canManagePolicy && (
                  <Button size="sm" variant="default" disabled={saving || !rulesLoaded} className="whitespace-nowrap gap-1.5" onClick={openAddRuleModal}>
                    <Plus className="h-4 w-4" />
                    Add Rule
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={rulesSearch}
                      onChange={(e) => {
                        setRulesSearch(e.target.value);
                        setRulesPage(1);
                      }}
                      placeholder="Document type..."
                      className="w-full h-9 pl-10 pr-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 bg-white"
                    />
                    {rulesSearch && (
                      <button
                        type="button"
                        onClick={() => setRulesSearch("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Status</label>
                  <Select
                    value={rulesStatus}
                    onChange={(v) => {
                      setRulesStatus(v as typeof rulesStatus);
                      setRulesPage(1);
                    }}
                    options={[
                      { label: "All", value: "ALL" },
                      { label: "Active", value: "ACTIVE" },
                      { label: "Inactive", value: "INACTIVE" },
                    ]}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRulesSearch("");
                      setRulesStatus("ALL");
                      setRulesPage(1);
                    }}
                    className="h-9 px-4 gap-2 font-medium hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              <DataTable
                rows={rules}
                columns={ruleColumns}
                getRowKey={(rule) => rule.id}
                isLoading={rulesLoading}
                loadingContent={<SectionLoading minHeight="200px" />}
                rowClassName={(rule) => cn(!rule.active && "opacity-60")}
                emptyState={<TableEmptyState title="No eligibility rules" description="Add a rule to configure which Document Types may be issued as an Uncontrolled Copy." />}
                action={{
                  cell: (rule) => canManagePolicy ? (
                    <button
                      ref={getRuleMenuRef(rule.id)}
                      onClick={(e) => toggleRuleMenu(rule.id, e)}
                      className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                      aria-label={`Actions for ${rule.documentTypeName ?? "Any"}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  ) : null,
                }}
                pagination={
                  <TablePagination
                    currentPage={visibleRulesPage}
                    totalPages={rulesTotalPages}
                    totalItems={rulesTotal}
                    itemsPerPage={rulesLimit}
                    onPageChange={setRulesPage}
                    onItemsPerPageChange={(value) => {
                      setRulesLimit(value);
                      setRulesPage(1);
                    }}
                  />
                }
              />

              {openRuleMenuId && (() => {
                const menuRule = rules.find((r) => r.id === openRuleMenuId);
                if (!menuRule) return null;
                return (
                  <PortalDropdownMenu isOpen onClose={closeRuleMenu} position={ruleMenuPosition} minWidth={180}>
                    <div className="py-1">
                      <DropdownMenuItem
                        icon={<IconPencilMinus className="h-4 w-4" />}
                        onClick={() => {
                          openEditRuleModal(menuRule);
                          closeRuleMenu();
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        icon={<IconTrash className="h-4 w-4" />}
                        variant="danger"
                        onClick={() => {
                          setDeleteRuleTarget(menuRule);
                          closeRuleMenu();
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </div>
                  </PortalDropdownMenu>
                );
              })()}
            </div>
          )}
        </fieldset>
      </div>

      <FormModal
        isOpen={showRuleModal}
        onClose={closeRuleModal}
        onConfirm={handleSaveRule}
        title={editingRule ? "Edit Eligibility Rule" : "Add Eligibility Rule"}
        confirmText="Apply to draft"
        description="Changes take effect only after Save Changes on the policy page."
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Document Type"
            value={ruleForm.documentTypeId}
            onChange={(v) => setRuleForm((prev) => ({ ...prev, documentTypeId: String(v) }))}
            options={[{ label: "Any", value: ANY_VALUE }, ...documentTypeOptions]}
            disabled={saving}
          />
          <div className="flex items-center justify-between py-1">
            <span className="text-xs sm:text-sm font-medium text-slate-900">Allowed</span>
            <Switch checked={ruleForm.allowed} onChange={(v) => setRuleForm((prev) => ({ ...prev, allowed: v }))} size="sm" disabled={saving} />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-xs sm:text-sm font-medium text-slate-900">Active</span>
            <Switch checked={ruleForm.active} onChange={(v) => setRuleForm((prev) => ({ ...prev, active: v }))} size="sm" disabled={saving} />
          </div>
        </div>
      </FormModal>

      <AlertModal
        isOpen={Boolean(deleteRuleTarget)}
        onClose={() => setDeleteRuleTarget(null)}
        onConfirm={handleDeleteRule}
        type="warning"
        title="Delete Eligibility Rule"
        description={
          deleteRuleTarget
            ? `Remove the rule for "${deleteRuleTarget.documentTypeName ?? "Any"}" from the draft? Deletion takes effect only after Save Changes.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        showCancel
      />

      {signatureModal}
    </div>
  );
};
