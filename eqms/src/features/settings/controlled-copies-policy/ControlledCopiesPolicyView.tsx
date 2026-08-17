import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, TimerReset, Trash2, Truck } from "lucide-react";
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
import type { ControlledCopyDcoEligibleUser, ControlledCopyExpiryDurationUnit, ControlledCopyExpiryLimit } from "@/services/api/controlledCopyPolicy";
import type { DepartmentItem, DocumentTypeItem } from "@/features/settings/dictionaries/types";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { IconPencilMinus } from "@tabler/icons-react";
import { usePermissions } from "@/hooks/usePermissions";

interface PolicyState {
  distributionSecurity: {
    allowEmailDistribution: boolean; allowPortalView: boolean; allowDownload: boolean;
    allowPrint: boolean; downloadOnce: boolean; printOnce: boolean;
    watermarkEnabled: boolean;
    watermarkCopyNumber: boolean; watermarkRecipient: boolean;
    watermarkDistributedDate: boolean; watermarkExpiryDate: boolean;
  };
  recallLostDamaged: {
    allowManualRecall: boolean; allowReportLostDamaged: boolean;
    allowReplacementForLostDamaged: boolean;
  };
  delivery: {
    redirectDeliveryToDco: boolean;
    dcoRecipientUserId: string;
    /** From the server: false when the assigned user no longer holds the DCO permission. Display-only. */
    dcoRecipientEligible: boolean;
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
    allowManualRecall: true, allowReportLostDamaged: true,
    allowReplacementForLostDamaged: true,
  },
  delivery: {
    redirectDeliveryToDco: false,
    dcoRecipientUserId: "",
    dcoRecipientEligible: true,
  },
};

const DURATION_UNIT_OPTIONS: { label: string; value: ControlledCopyExpiryDurationUnit; example: string }[] = [
  { label: "Hours", value: "HOURS", example: "e.g. 24 Hours → expires 1 day after distribution" },
  { label: "Days", value: "DAYS", example: "e.g. 30 Days → expires 1 month after distribution" },
  { label: "Weeks", value: "WEEKS", example: "e.g. 2 Weeks → expires 14 days after distribution" },
  { label: "Months", value: "MONTHS", example: "e.g. 6 Months → expires half a year after distribution" },
];

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
  const { requestSignature, signatureModal } = useSecurityESign();
  const { hasPermissionAlias } = usePermissions();
  const canManagePolicy = hasPermissionAlias('settings.controlled_copy_policy.manage');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<PolicyState>(defaultPolicy);

  const [dcoUsers, setDcoUsers] = useState<ControlledCopyDcoEligibleUser[]>([]);
  const [dcoUsersLoaded, setDcoUsersLoaded] = useState(false);

  const [expiryLimits, setExpiryLimits] = useState<ControlledCopyExpiryLimit[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<ControlledCopyExpiryLimit | null>(null);
  const [limitForm, setLimitForm] = useState<{ documentTypeId: string; departmentId: string; durationValue: string; durationUnit: ControlledCopyExpiryDurationUnit; active: boolean }>({
    documentTypeId: "", departmentId: "", durationValue: "", durationUnit: "DAYS", active: true,
  });
  const [isSavingLimit, setIsSavingLimit] = useState(false);

  const loadExpiryLimits = () => {
    controlledCopyPolicyApi.listExpiryLimits().then((data) => setExpiryLimits(sortExpiryLimits(data))).catch(() => {
      showToast({ type: "error", title: "Error", message: "Unable to load the Expiry Duration Policy." });
    });
  };

  useEffect(() => {
    loadExpiryLimits();
    dictionaryApi.getDocumentTypes().then(setDocumentTypes).catch(() => {});
    dictionaryApi.getDepartments().then(setDepartments).catch(() => {});
    controlledCopyPolicyApi.getDcoEligibleUsers()
      .then((users) => setDcoUsers(users))
      .catch(() => {})
      .finally(() => setDcoUsersLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddLimitModal = () => {
    setEditingLimit(null);
    setLimitForm({ documentTypeId: "", departmentId: "", durationValue: "", durationUnit: "DAYS", active: true });
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

  const handleSaveLimit = async () => {
    const durationValue = Number(limitForm.durationValue);
    if (!durationValue || durationValue <= 0) {
      showToast({ type: "error", title: "Error", message: "Duration must be a positive number." });
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
        durationValue,
        durationUnit: limitForm.durationUnit,
        active: limitForm.active,
        ...sig,
      };
      if (editingLimit) {
        await controlledCopyPolicyApi.updateExpiryLimit(editingLimit.id, payload);
      } else {
        await controlledCopyPolicyApi.createExpiryLimit(payload);
      }
      showToast({ type: "success", title: "Success", message: "Expiry Duration Policy rule saved." });
      setIsLimitModalOpen(false);
      loadExpiryLimits();
    } catch (err) {
      showToast({ type: "error", title: "Error", message: extractApiMessage(err, "Failed to save the rule.") });
    } finally {
      setIsSavingLimit(false);
    }
  };

  const handleDeleteLimit = async (limit: ControlledCopyExpiryLimit) => {
    if (!window.confirm(`Delete the expiry rule "${(limit.documentTypeName || "Any document type") + " / " + (limit.departmentName || "Any department")}"?`)) {
      return;
    }
    const sig = await requestSignature("Delete Controlled Copy Expiry Rule", "Security Configuration Change");
    if (!sig) return;
    try {
      await controlledCopyPolicyApi.deleteExpiryLimit(limit.id, sig);
      showToast({ type: "success", title: "Success", message: "Rule deleted." });
      loadExpiryLimits();
    } catch (err) {
      showToast({ type: "error", title: "Error", message: extractApiMessage(err, "Failed to delete the rule.") });
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
            allowReportLostDamaged: data.recallLostDamaged?.allowReportLostDamaged ?? defaultPolicy.recallLostDamaged.allowReportLostDamaged,
            allowReplacementForLostDamaged: data.recallLostDamaged?.allowReplacementForLostDamaged ?? defaultPolicy.recallLostDamaged.allowReplacementForLostDamaged,
          },
          delivery: {
            redirectDeliveryToDco: data.delivery?.redirectDeliveryToDco ?? defaultPolicy.delivery.redirectDeliveryToDco,
            dcoRecipientUserId: data.delivery?.dcoRecipientUserId || "",
            dcoRecipientEligible: data.delivery?.dcoRecipientEligible ?? true,
          },
        });
      })
      .catch(() => {
        if (active) showToast({ type: "error", title: "Error", message: "Unable to load Controlled Copies Policy from server." });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showToast]);

  const handleSave = async () => {
    if (policy.delivery.redirectDeliveryToDco && !policy.delivery.dcoRecipientUserId) {
      showToast({ type: "error", title: "Error", message: "Select a DCO recipient before enabling delivery redirection." });
      return;
    }
    const sig = await requestSignature("Update Controlled Copies Policy", "Security Configuration Change");
    if (!sig) return;
    setSaving(true);
    try {
      await controlledCopyPolicyApi.savePolicy({
        distributionSecurity: policy.distributionSecurity,
        recallLostDamaged: policy.recallLostDamaged,
        delivery: {
          redirectDeliveryToDco: policy.delivery.redirectDeliveryToDco,
          dcoRecipientUserId: policy.delivery.dcoRecipientUserId || null,
        },
      }, sig);
      showToast({ type: "success", title: "Success", message: "Controlled Copies Policy saved successfully." });
    } catch (err) {
      showToast({ type: "error", title: "Error", message: extractApiMessage(err, "Failed to save policy. Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  const setDS = <K extends keyof PolicyState["distributionSecurity"]>(key: K, value: boolean) =>
    setPolicy((p) => ({ ...p, distributionSecurity: { ...p.distributionSecurity, [key]: value } }));
  const setRecall = <K extends keyof PolicyState["recallLostDamaged"]>(key: K, value: boolean) =>
    setPolicy((p) => ({ ...p, recallLostDamaged: { ...p.recallLostDamaged, [key]: value } }));
  const setDelivery = <K extends keyof PolicyState["delivery"]>(key: K, value: PolicyState["delivery"][K]) =>
    setPolicy((p) => ({ ...p, delivery: { ...p.delivery, [key]: value } }));

  if (loading) return <FullPageLoading />;

  const selectedDurationUnit = DURATION_UNIT_OPTIONS.find((u) => u.value === limitForm.durationUnit) || DURATION_UNIT_OPTIONS[1];

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
        <FormSection
          title="Recall / Lost / Damaged"
          description="What can happen to a copy after it has already been distributed."
          icon={<ClipboardList className="h-4 w-4" />}
        >
          <div className="divide-y divide-slate-100">
            <SwitchRow label="Allow Manual Recall" checked={policy.recallLostDamaged.allowManualRecall} onChange={(v) => setRecall("allowManualRecall", v)} disabled={!canManagePolicy} note="Lets a Document Controller pull back a distributed copy, e.g. after a new revision is published." />
            <SwitchRow label="Allow Report Lost/Damaged" checked={policy.recallLostDamaged.allowReportLostDamaged} onChange={(v) => setRecall("allowReportLostDamaged", v)} disabled={!canManagePolicy} note="Lets a recipient report their copy as lost or damaged (evidence required for damaged)." />
            <SwitchRow label="Allow Replacement" checked={policy.recallLostDamaged.allowReplacementForLostDamaged} onChange={(v) => setRecall("allowReplacementForLostDamaged", v)} disabled={!canManagePolicy} note="Lets a new copy be issued to replace one reported lost or damaged." />
          </div>
        </FormSection>

        {/* Expiry Duration Policy — full width. Every Controlled Copy always has an expiry;
            the mandatory "Global Default" row guarantees a resolution, with document
            type/department rows overriding it when more specific. */}
        <FormSection
          title="Expiry Duration Policy"
          description="How long a distributed copy stays valid before it auto-expires."
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
                    <th className="text-left px-3 py-2 text-2xs md:text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
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
                      <td className="px-3 py-2 text-slate-700 font-medium">
                        {limit.durationValue} {DURATION_UNIT_OPTIONS.find((u) => u.value === limit.durationUnit)?.label || limit.durationUnit}
                      </td>
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
        <FormSection className="md:col-span-2" title="Distribution & Security" description="How controlled copies are shared and what recipients can do with them." icon={<Truck className="h-4 w-4" />}>
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

            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 sm:p-4 xl:col-span-2">
              <div className="mb-2 border-b border-sky-200 pb-3">
                <h3 className="text-sm font-semibold text-slate-800">DCO Delivery Routing</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  For recipients without a computer or phone (e.g. factory floor workers). When enabled, the requester only gets an email confirming their copy was distributed — no link. Instead, a user holding the "Receive Controlled Copies as DCO" permission receives the printable file: a direct link for a single distribution, or one email with all copies attached as a ZIP for a batch, so they can print and hand them out. Grant this permission via Access Profiles / Permission Sets first — any role can hold it, it is not tied to a fixed "DCO" role name.
                </p>
              </div>

              {dcoUsersLoaded && dcoUsers.length === 0 && (
                <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-2xs text-amber-800">
                  No user currently holds the "Receive Controlled Copies as DCO" permission. Grant it to at least one user (Access Profiles / Permission Sets) before enabling this option.
                </p>
              )}

              <div className="divide-y divide-sky-100">
                <SwitchRow
                  label="Redirect delivery to DCO"
                  checked={policy.delivery.redirectDeliveryToDco}
                  onChange={(v) => setDelivery("redirectDeliveryToDco", v)}
                  disabled={!canManagePolicy || (dcoUsersLoaded && dcoUsers.length === 0)}
                />
              </div>
              {policy.delivery.redirectDeliveryToDco && (
                <div className="mt-3 space-y-2">
                  <Select
                    label="DCO Recipient"
                    placeholder="Select the user who will receive controlled copies"
                    options={dcoUsers.map((u) => ({ label: u.email ? `${u.fullName} (${u.email})` : u.fullName, value: u.id }))}
                    value={policy.delivery.dcoRecipientUserId}
                    onChange={(v) => setDelivery("dcoRecipientUserId", String(v))}
                    disabled={!canManagePolicy}
                  />
                  {policy.delivery.dcoRecipientUserId && !policy.delivery.dcoRecipientEligible && (
                    <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-2xs text-rose-700">
                      This user no longer holds the "Receive Controlled Copies as DCO" permission (revoked, or account inactive). Until fixed, distributions fall back to normal (non-redirected) delivery and the issue is logged — select a different eligible user, or re-grant the permission.
                    </p>
                  )}
                </div>
              )}
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
              The Global Default applies to Any document type / Any department and cannot be scoped — only its duration can be edited.
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs sm:text-sm text-slate-700 mb-1.5 block">Duration</label>
              <input
                type="number"
                min={1}
                value={limitForm.durationValue}
                onChange={(e) => setLimitForm((f) => ({ ...f, durationValue: e.target.value }))}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <Select
              label="Unit"
              options={DURATION_UNIT_OPTIONS.map((u) => ({ label: u.label, value: u.value }))}
              value={limitForm.durationUnit}
              onChange={(v) => setLimitForm((f) => ({ ...f, durationUnit: v as ControlledCopyExpiryDurationUnit }))}
            />
          </div>
          <p className="text-2xs text-slate-400">{selectedDurationUnit.example}</p>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <p className="text-xs sm:text-sm text-slate-700">Active</p>
              <p className="text-2xs text-slate-400">Inactive rules are retained but not used to calculate expiry.</p>
            </div>
            <Switch checked={limitForm.active} onChange={(active) => setLimitForm((f) => ({ ...f, active }))} size="sm" disabled={Boolean(editingLimit?.isSystem)} />
          </div>
        </div>
      </FormModal>

      {signatureModal}
    </div>
  );
};
