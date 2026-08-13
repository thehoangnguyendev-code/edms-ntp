import React, { useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { useToast } from "@/components/ui/toast";
import { useTranslation } from "@/i18n";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { settingsApi } from "@/services/api";
import type { PermissionSetResponse } from "@/services/api/settings";

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";

interface PermissionSetCloneModalProps {
  isOpen: boolean;
  source: PermissionSetResponse;
  onClose: () => void;
  onCloned: (cloned: PermissionSetResponse) => void;
}

export const PermissionSetCloneModal: React.FC<PermissionSetCloneModalProps> = ({ isOpen, source, onClose, onCloned }) => {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { requestSignature, signatureModal } = useSecurityESign();
  const [name, setName] = useState(`${source.name} Copy`);
  const [description, setDescription] = useState(source.description ?? "");
  const [clonePermissions, setClonePermissions] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast({ type: "error", message: t("permissionSets.nameRequired") });
      return;
    }
    const sig = await requestSignature("Clone Permission Set", "Permission Set Change");
    if (!sig) return;
    setSaving(true);
    try {
      const result = await settingsApi.createPermissionSet(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          active: source.active,
          permissionCodes: clonePermissions ? source.permissionCodes : [],
        },
        sig,
      );
      showToast({ type: "success", message: t("permissionSets.cloned") });
      onCloned(result);
      onClose();
    } catch (err: any) {
      showToast({ type: "error", message: err?.response?.data?.message ?? t("permissionSets.cloneFailed") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {signatureModal}
      <FormModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleSave}
        title="Clone Permission Set"
        description={`Create a copy of "${source.name}" with custom options.`}
        confirmText="Clone"
        cancelText="Cancel"
        showCancel
        isLoading={saving}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={textareaClass}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the responsibility scope of this permission set"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Clone Options</p>
            <Checkbox
              checked={clonePermissions}
              onChange={setClonePermissions}
              label={`Clone Permissions (${source.permissionCount} permission codes)`}
            />
          </div>
        </div>
      </FormModal>
    </>
  );
};
