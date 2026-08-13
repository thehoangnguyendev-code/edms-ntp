import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, Pencil, Plus, TimerReset, Trash2, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch/Switch";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { controlledCopiesPolicy as controlledCopiesPolicyBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { controlledCopyPolicyApi } from "@/services/api";
import { dictionaryApi } from "@/services/api/dictionary";
import type { ControlledCopyExpiryLimit } from "@/services/api/controlledCopyPolicy";
import type { DepartmentItem, DocumentTypeItem } from "@/features/settings/dictionaries/types";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { IconPencilMinus } from "@tabler/icons-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslation } from "@/i18n";

interface PolicyState {
  distributionSecurity: {
    allowEmailDistribution: boolean; allowPortalView: boolean; allowDownload: boolean;
    allowPrint: boolean; downloadOnce: boolean; printOnce: boolean;
    watermarkEnabled: boolean;
    watermarkCopyNumber: boolean; watermarkRecipient: boolean;
    watermarkDistributedDate: boolean; watermarkExpiryDate: boolean;
  };
  recallLostDamaged: {
    allowManualRecall: boolean; allowReportLost: boolean; allowReportDamaged: boolean;
    allowReplacementForLostDamaged: boolean;
  };
}

const defaultPolicy: PolicyState = {
  distributionSecurity: {
    allowEmailDistribution: true, allowPortalView: true, allowDownload: false, allowPrint: false,
    watermarkEnabled: true, downloadOnce: false, printOnce: false,
    watermarkCopyNumber: true, watermarkRecipient: true,
    watermarkDistributedDate: true, watermarkExpiryDate: true,
  },
  recallLostDamaged: {
    allowManualRecall: true, allowReportLost: true, allowReportDamaged: true,
    allowReplacementForLostDamaged: true,
  },
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
      <span className="text-xs sm:text-sm text-slate-700 break-words">{label}</span>
      {note && <p className="text-2xs text-slate-400 mt-0.5 break-words">{note}</p>}
    </div>
    <Switch checked={checked} onChange={onChange} size="sm" disabled={disabled} />
  </div>
);

/** The mandatory "Global Default" row is always sorted first; the rest keep server order. */
const sortExpiryLimits = (limits: ControlledCopyExpiryLimit[]) =>
  [...limits].sort((a, b) => (a.isSystem === b.isSystem ? 0 : a.isSystem ? -1 : 1));

export const ControlledCopiesPolicyView: React.FC = () => {
  const { navigateTo } = useNavigateWithLoading();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { requestSignature, signatureModal } = useSecurityESign();
  const { hasPermissionAlias } = usePermissions();
  const canManagePolicy = hasPermissionAlias('settings.controlled_copy_policy.manage');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<PolicyState>(defaultPolicy);

  const [expiryLimits, setExpiryLimits] = useState<ControlledCopyExpiryLimit[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<ControlledCopyExpiryLimit | null>(null);
  const [limitForm, setLimitForm] = useState({ documentTypeId: "", departmentId: "", maxDurationDays: "", description: "", active: true });
  const [isSavingLimit, setIsSavingLimit] = useState(false);

  const loadExpiryLimits = () => {
    controlledCopyPolicyApi.listExpiryLimits().then((data) => setExpiryLimits(sortExpiryLimits(data))).catch(() => {
      showToast({ type: "error", title: t("controlledCopyPolicy.errorTitle"), message: t("controlledCopyPolicy.loadExpiryLimitsFailed") });
    });
  };

  useEffect(() => {
    loadExpiryLimits();
    dictionaryApi.getDocumentTypes().then(setDocumentTypes).catch(() => {});
    dictionaryApi.getDepartments().then(setDepartments).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddLimitModal = () => {
    setEditingLimit(null);
    setLimitForm({ documentTypeId: "", departmentId: "", maxDurationDays: "", description: "", active: true });
    setIsLimitModalOpen(true);
  };

  const openEditLimitModal = (limit: ControlledCopyExpiryLimit) => {
    setEditingLimit(limit);
    setLimitForm({
      documentTypeId: limit.documentTypeId || "",
      departmentId: limit.departmentId || "",
      maxDurationDays: String(limit.maxDurationDays),
      description: limit.description || "",
      active: limit.active,
    });
    setIsLimitModalOpen(true);
  };

  const handleSaveLimit = async () => {
    const days = Number(limitForm.maxDurationDays);
    if (!days || days <= 0) {
      showToast({ type: "error", title: t("controlledCopyPolicy.errorTitle"), message: t("controlledCopyPolicy.durationPositive") });
      return;
    }
    const sig = await requestSignature(
      editingLimit ? "Update Controlled Copy Expiry Rule" : "Create Controlled Copy Expiry Rule",
      "Security Configuration Change",
    );
    if (!sig) return;
    setIsSavingLimit(true);
    try {
      const payload = {
        documentTypeId: editingLimit?.isSystem ? null : (limitForm.documentTypeId || null),
        departmentId: editingLimit?.isSystem ? null : (limitForm.departmentId || null),
        maxDurationDays: days,
        active: limitForm.active,
        description: limitForm.description || null,
        ...sig,
      };
      if (editingLimit) {
        await controlledCopyPolicyApi.updateExpiryLimit(editingLimit.id, payload);
      } else {
        await controlledCopyPolicyApi.createExpiryLimit(payload);
      }
      showToast({ type: "success", title: t("controlledCopyPolicy.successTitle"), message: t("controlledCopyPolicy.expiryLimitSaved") });
      setIsLimitModalOpen(false);
      loadExpiryLimits();
    } catch (err) {
      showToast({ type: "error", title: t("controlledCopyPolicy.errorTitle"), message: extractApiMessage(err, t("controlledCopyPolicy.expiryLimitSaveFailed")) });
    } finally {
      setIsSavingLimit(false);
    }
  };

  const handleDeleteLimit = async (limit: ControlledCopyExpiryLimit) => {
    if (!window.confirm(`Delete the expiry rule "${limit.description || (limit.documentTypeName || "Any document type") + " / " + (limit.departmentName || "Any department")}"?`)) {
      return;
    }
    const sig = await requestSignature("Delete Controlled Copy Expiry Rule", "Security Configuration Change");
    if (!sig) return;
    try {
      await controlledCopyPolicyApi.deleteExpiryLimit(limit.id, sig);
      showToast({ type: "success", title: t("controlledCopyPolicy.successTitle"), message: t("controlledCopyPolicy.expiryLimitDeleted") });
      loadExpiryLimits();
    } catch (err) {
      showToast({ type: "error", title: t("controlledCopyPolicy.errorTitle"), message: extractApiMessage(err, t("controlledCopyPolicy.expiryLimitDeleteFailed")) });
    }
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
        setPolicy({
          distributionSecurity: {
            allowEmailDistribution: data.distributionSecurity?.allowEmailDistribution ?? defaultPolicy.distributionSecurity.allowEmailDistribution,
            allowPortalView: data.distributionSecurity?.allowPortalView ?? defaultPolicy.distributionSecurity.allowPortalView,
            allowDownload: data.distributionSecurity?.allowDownload ?? defaultPolicy.distributionSecurity.allowDownload,
            allowPrint: data.distributionSecurity?.allowPrint ?? defaultPolicy.distributionSecurity.allowPrint,
            downloadOnce: data.distributionSecurity?.downloadOnce ?? defaultPolicy.distributionSecurity.downloadOnce,
            printOnce: data.distributionSecurity?.printOnce ?? defaultPolicy.distributionSecurity.printOnce,
            watermarkEnabled: data.distributionSecurity?.watermarkEnabled ?? defaultPolicy.distributionSecurity.watermarkEnabled,
            watermarkCopyNumber: data.distributionSecurity?.watermarkCopyNumber ?? defaultPolicy.distributionSecurity.watermarkCopyNumber,
            watermarkRecipient: data.distributionSecurity?.watermarkRecipient ?? defaultPolicy.distributionSecurity.watermarkRecipient,
            watermarkDistributedDate: data.distributionSecurity?.watermarkDistributedDate ?? defaultPolicy.distributionSecurity.watermarkDistributedDate,
            watermarkExpiryDate: data.distributionSecurity?.watermarkExpiryDate ?? defaultPolicy.distributionSecurity.watermarkExpiryDate,
          },
          recallLostDamaged: {
            allowManualRecall: data.recallLostDamaged?.allowManualRecall ?? defaultPolicy.recallLostDamaged.allowManualRecall,
            allowReportLost: data.recallLostDamaged?.allowReportLost ?? defaultPolicy.recallLostDamaged.allowReportLost,
            allowReportDamaged: data.recallLostDamaged?.allowReportDamaged ?? defaultPolicy.recallLostDamaged.allowReportDamaged,
            allowReplacementForLostDamaged: data.recallLostDamaged?.allowReplacementForLostDamaged ?? defaultPolicy.recallLostDamaged.allowReplacementForLostDamaged,
          },
        });
      })
      .catch(() => {
        if (active) showToast({ type: "error", title: t("controlledCopyPolicy.errorTitle"), message: t("controlledCopyPolicy.loadFailed") });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showToast]);

  const handleSave = async () => {
    const sig = await requestSignature("Update Controlled Copies Policy", "Security Configuration Change");
    if (!sig) return;
    setSaving(true);
    try {
      await controlledCopyPolicyApi.savePolicy({
        distributionSecurity: policy.distributionSecurity,
        recallLostDamaged: policy.recallLostDamaged,
      }, sig);
      showToast({ type: "success", title: t("controlledCopyPolicy.successTitle"), message: t("controlledCopyPolicy.saved") });
    } catch (err) {
      showToast({ type: "error", title: t("controlledCopyPolicy.errorTitle"), message: extractApiMessage(err, t("controlledCopyPolicy.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };

  const setDS = <K extends keyof PolicyState["distributionSecurity"]>(key: K, value: boolean) =>
    setPolicy((p) => ({ ...p, distributionSecurity: { ...p.distributionSecurity, [key]: value } }));
  const setRecall = <K extends keyof PolicyState["recallLostDamaged"]>(key: K, value: boolean) =>
    setPolicy((p) => ({ ...p, recallLostDamaged: { ...p.recallLostDamaged, [key]: value } }));

  if (loading) return <FullPageLoading />;

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
              disabled={saving}
              className="gap-2 whitespace-nowrap"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Recall / Lost / Damaged */}
        <FormSection title="Recall / Lost / Damaged" icon={<ClipboardList className="h-4 w-4" />}>
          <div className="divide-y divide-slate-100">
            {false && <>
            <SwitchRow
              label="Auto-Recall on New Revision"
              checked
              onChange={() => {}}
              disabled
              note="Mandatory per GMP data-integrity rules — always on and cannot be disabled."
            />
            <SwitchRow
              label="Auto-Recall on Obsolete"
              checked
              onChange={() => {}}
              disabled
              note="Mandatory per GMP data-integrity rules — always on and cannot be disabled."
            />
            </>}
            <SwitchRow label="Allow Manual Recall" checked={policy.recallLostDamaged.allowManualRecall} onChange={(v) => setRecall("allowManualRecall", v)} disabled={!canManagePolicy} />
            <SwitchRow label="Allow Report Lost" checked={policy.recallLostDamaged.allowReportLost} onChange={(v) => setRecall("allowReportLost", v)} disabled={!canManagePolicy} />
            <SwitchRow label="Allow Report Damaged" checked={policy.recallLostDamaged.allowReportDamaged} onChange={(v) => setRecall("allowReportDamaged", v)} disabled={!canManagePolicy} />
            <SwitchRow label="Allow Replacement" checked={policy.recallLostDamaged.allowReplacementForLostDamaged} onChange={(v) => setRecall("allowReplacementForLostDamaged", v)} disabled={!canManagePolicy} />
          </div>
        </FormSection>

        {/* Expiry Duration Policy — full width. Every Controlled Copy always has an expiry;
            the mandatory "Global Default" row guarantees a resolution, with document
            type/department rows overriding it when more specific. */}
        <FormSection
          title="Expiry Duration Policy"
          icon={<TimerReset className="h-4 w-4" />}
          headerRight={
            canManagePolicy ? (
              <Button size="sm" variant="default" onClick={openAddLimitModal} className="gap-1.5 whitespace-nowrap shrink-0">
                <Plus className="h-3.5 w-3.5" />
                Add Rule
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Type</th>
                    <th className="text-left px-3 py-2 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                    <th className="text-left px-3 py-2 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration (Days)</th>
                    <th className="text-left px-3 py-2 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="text-right px-3 py-2 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expiryLimits.map((limit) => (
                    <tr key={limit.id} className={limit.isSystem ? "bg-emerald-50/40" : undefined}>
                      <td className="px-3 py-2 text-slate-700">
                        {limit.isSystem ? (
                          <span className="font-semibold text-emerald-700">Global Default</span>
                        ) : (
                          limit.documentTypeName || "Any"
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{limit.isSystem ? "Any" : (limit.departmentName || "Any")}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium">{limit.maxDurationDays}</td>
                      <td className="px-3 py-2 text-slate-500">{limit.description || "-"}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FormSection>

        {/* Distribution & Security — full width */}
        <FormSection className="md:col-span-2" title="Distribution & Security" icon={<Truck className="h-4 w-4" />}>
          <p className="mb-4 max-w-3xl text-xs leading-5 text-slate-500">
            Control how controlled copies are shared and which actions recipients can perform. Changes are applied after saving and enforced by the server.
          </p>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
              <div className="mb-2 border-b border-slate-200 pb-3">
                <h3 className="text-sm font-semibold text-slate-800">Distribution channels</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Choose where recipients may access the controlled copy.</p>
              </div>
              <div className="divide-y divide-slate-200">
                <SwitchRow label="Email distribution" checked={policy.distributionSecurity.allowEmailDistribution} onChange={(v) => setDS("allowEmailDistribution", v)} disabled={!canManagePolicy} note="Allow distribution notifications and links by email." />
                <SwitchRow label="Portal view" checked={policy.distributionSecurity.allowPortalView} onChange={(v) => setDS("allowPortalView", v)} disabled={!canManagePolicy} note="Allow recipients to open the controlled-copy portal." />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
              <div className="mb-2 border-b border-slate-200 pb-3">
                <h3 className="text-sm font-semibold text-slate-800">Recipient actions</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Allow or restrict operations on the rendered document.</p>
              </div>
              <div className="divide-y divide-slate-200">
                <SwitchRow label="Download" checked={policy.distributionSecurity.allowDownload} onChange={(v) => setDS("allowDownload", v)} disabled={!canManagePolicy} note="Allow downloading a PDF copy." />
                <SwitchRow label="Print" checked={policy.distributionSecurity.allowPrint} onChange={(v) => setDS("allowPrint", v)} disabled={!canManagePolicy} note="Allow the viewer Print command and Ctrl+P." />
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:p-4 xl:col-span-2">
              <div className="mb-2 border-b border-amber-200 pb-3">
                <h3 className="text-sm font-semibold text-slate-800">Usage limits</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">Each limit is tracked independently for every controlled-copy record. The server prevents concurrent requests from exceeding the limit.</p>
              </div>
              <div className="grid grid-cols-1 gap-x-8 divide-y divide-amber-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:[&>*+*]:pl-6">
                <SwitchRow label="One download per record" checked={policy.distributionSecurity.downloadOnce} onChange={(v) => setDS("downloadOnce", v)} disabled={!canManagePolicy || !policy.distributionSecurity.allowDownload} note="Requires Download to be enabled." />
                <SwitchRow label="One print per record" checked={policy.distributionSecurity.printOnce} onChange={(v) => setDS("printOnce", v)} disabled={!canManagePolicy || !policy.distributionSecurity.allowPrint} note="Requires Print to be enabled." />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 xl:col-span-2">
              <div className="mb-2 border-b border-slate-200 pb-3">
                <h3 className="text-sm font-semibold text-slate-800">Watermark</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Controls the diagonal stamp rendered on every preview/download of the controlled copy.</p>
              </div>
              <div className="divide-y divide-slate-100">
                <SwitchRow label="Enable Watermark" checked={policy.distributionSecurity.watermarkEnabled} onChange={(v) => setDS("watermarkEnabled", v)} disabled={!canManagePolicy} />
                {policy.distributionSecurity.watermarkEnabled && (
                  <div className="pl-3 border-l-2 border-emerald-100 ml-1 divide-y divide-slate-100">
                    <SwitchRow label="Show Copy Number" checked={policy.distributionSecurity.watermarkCopyNumber} onChange={(v) => setDS("watermarkCopyNumber", v)} disabled={!canManagePolicy} />
                    <SwitchRow label="Show Recipient" checked={policy.distributionSecurity.watermarkRecipient} onChange={(v) => setDS("watermarkRecipient", v)} disabled={!canManagePolicy} />
                    <SwitchRow label="Show Distributed Date" checked={policy.distributionSecurity.watermarkDistributedDate} onChange={(v) => setDS("watermarkDistributedDate", v)} disabled={!canManagePolicy} note="Shown only after the copy has been distributed." />
                    <SwitchRow label="Show Expiry Date" checked={policy.distributionSecurity.watermarkExpiryDate} onChange={(v) => setDS("watermarkExpiryDate", v)} disabled={!canManagePolicy} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </FormSection>

      </div>

      <FormModal
        isOpen={isLimitModalOpen}
        onClose={() => setIsLimitModalOpen(false)}
        onConfirm={handleSaveLimit}
        title={editingLimit ? (editingLimit.isSystem ? "Edit Global Default" : "Edit Expiry Rule") : "Add Expiry Rule"}
        isLoading={isSavingLimit}
        confirmText={isSavingLimit ? "Saving..." : "Save"}
      >
        <div className="space-y-3">
          {editingLimit?.isSystem ? (
            <p className="text-2xs text-slate-500 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              The Global Default applies to Any document type / Any department and cannot be scoped — only its duration/description can be edited.
            </p>
          ) : (
            <>
              <Select
                label="Document Type"
                options={[{ label: "— Any —", value: "" }, ...documentTypes.map((d) => ({ label: d.name, value: d.id }))]}
                value={limitForm.documentTypeId}
                onChange={(v) => setLimitForm((f) => ({ ...f, documentTypeId: v as string }))}
              />
              <Select
                label="Department"
                options={[{ label: "— Any —", value: "" }, ...departments.map((d) => ({ label: d.name, value: d.id }))]}
                value={limitForm.departmentId}
                onChange={(v) => setLimitForm((f) => ({ ...f, departmentId: v as string }))}
              />
            </>
          )}
          <div>
            <label className="text-xs sm:text-sm text-slate-700 mb-1.5 block">Duration (days)</label>
            <input
              type="number"
              min={1}
              value={limitForm.maxDurationDays}
              onChange={(e) => setLimitForm((f) => ({ ...f, maxDurationDays: e.target.value }))}
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <p className="text-xs sm:text-sm text-slate-700">Active</p>
              <p className="text-2xs text-slate-400">Inactive rules are retained but not used to calculate expiry.</p>
            </div>
            <Switch checked={limitForm.active} onChange={(active) => setLimitForm((f) => ({ ...f, active }))} size="sm" disabled={Boolean(editingLimit?.isSystem)} />
          </div>
          <div>
            <label className="text-xs sm:text-sm text-slate-700 mb-1.5 block">Description (optional)</label>
            <textarea
              value={limitForm.description}
              onChange={(e) => setLimitForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            />
          </div>
        </div>
      </FormModal>

      {signatureModal}
    </div>
  );
};
