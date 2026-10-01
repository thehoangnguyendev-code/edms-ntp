import React, { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { metadataApi } from "@/services/api/metadata";
import { formSettingsApi, type FormSettings } from "@/services/api/formSettings";

const searchSystemUsers = async (query: string, keep: SelectOption | null): Promise<SelectOption[]> => {
  const users = await metadataApi.getUsersLookup({ search: query.trim() || undefined });
  const options: SelectOption[] = users.map((u) => ({
    value: u.id,
    label: [u.fullName || u.username || u.id, u.email || u.department].filter(Boolean).join(" · "),
  }));
  return keep && !options.some((o) => o.value === keep.value) ? [keep, ...options] : options;
};

/** Per-Form opt-in configuration (allow eForm / allow paper / require approval + approver) --
 *  decided here by whoever holds documents.form.configure, same panel style used for other
 *  per-Document workflow decisions (Reviewer/Approver assignment, Training requirement). */
export const FormSettingsCard: React.FC<{
  formDocumentId: string;
  settings: FormSettings | null;
  onSaved: () => void;
}> = ({ formDocumentId, settings, onSaved }) => {
  const { showToast } = useToast();
  const [allowEform, setAllowEform] = useState(false);
  const [allowPaper, setAllowPaper] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [approver, setApprover] = useState<SelectOption | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const labels = useRef(new Map<string, string>());

  useEffect(() => {
    setAllowEform(settings?.allowEform ?? false);
    setAllowPaper(settings?.allowPaper ?? false);
    setRequireApproval(settings?.requireApproval ?? false);
    setApprover(
      settings?.approverUserId ? { value: settings.approverUserId, label: settings.approverName || settings.approverUserId } : null,
    );
  }, [settings]);

  const isDirty =
    allowEform !== (settings?.allowEform ?? false) ||
    allowPaper !== (settings?.allowPaper ?? false) ||
    requireApproval !== (settings?.requireApproval ?? false) ||
    (approver?.value ?? "") !== (settings?.approverUserId ?? "");

  const canSave = isDirty && (!requireApproval || Boolean(approver));

  const handleSigned = async (data: { reason: string; signatureToken: string }) => {
    try {
      await formSettingsApi.updateFormSettings(formDocumentId, {
        allowEform,
        allowPaper,
        requireApproval,
        approverUserId: approver?.value ? String(approver.value) : null,
        reason: data.reason,
        signatureToken: data.signatureToken,
      });
      setIsSigning(false);
      showToast({ type: "success", title: "Saved", message: "Form settings updated." });
      onSaved();
    } catch (err) {
      showToast({ type: "error", title: "Error", message: extractApiMessage(err, "Unable to save Form settings.") });
      throw err;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-slate-500" />
        <p className="text-sm font-semibold text-slate-800">Form Settings</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Checkbox
          id="allow-eform"
          label="Allow eForm submission"
          checked={allowEform}
          onChange={setAllowEform}
        />
        <Checkbox
          id="allow-paper"
          label="Allow physical (paper) copy"
          checked={allowPaper}
          onChange={setAllowPaper}
        />
        <Checkbox
          id="require-approval"
          label="Require Approval after submission"
          checked={requireApproval}
          onChange={setRequireApproval}
        />
        {requireApproval && (
          <Select
            label="Approver"
            value={approver ? String(approver.value) : ""}
            options={approver ? [approver] : []}
            placeholder="Select an Approver"
            searchPlaceholder="Search by name, e-mail or code..."
            onSearch={async (query) => {
              const options = await searchSystemUsers(query, approver);
              options.forEach((o) => labels.current.set(String(o.value), o.label));
              return options;
            }}
            debounceMs={300}
            minSearchLength={0}
            onChange={(next) => {
              const id = next == null ? "" : String(next);
              setApprover(id ? { value: id, label: labels.current.get(id) ?? id } : null);
            }}
          />
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="outline-emerald" disabled={!canSave} onClick={() => setIsSigning(true)}>
          Save Form Settings
        </Button>
      </div>

      {isSigning && (
        <ESignatureModal
          isOpen
          onClose={() => setIsSigning(false)}
          onConfirm={handleSigned}
          actionTitle="Update Form Settings"
          meaningCode="FORM_SETTINGS_UPDATED"
        />
      )}
    </div>
  );
};
