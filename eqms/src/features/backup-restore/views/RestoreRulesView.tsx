import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { backupRestoreApi, type RestoreRuleRecord } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { formatDateTime } from "../format";

/** The control rules of the restore. They are part of the procedure, not settings, so they are listed here and cannot be changed. */
const FIXED_CONTROLS = [
  "The person who asked for a restore cannot approve it.",
  "The person who runs a restore cannot be the person who approved it.",
  "Approving and rejecting need an electronic signature, recorded with the decision.",
  "The maintenance window is entered by an administrator, and the system is locked while the restore runs.",
  "A production restore needs a passed test restore of the same backup.",
];

type Edit = { rule: RestoreRuleRecord; step: "form" | "sign"; value: string; reason: string };

/**
 * The restore rules the owner may change (SDS 14.1). A change takes two steps: the new value and the reason, then the electronic
 * signature. The rules are kept with their history on the server; nothing here is stored in the browser.
 */
export const RestoreRulesView: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canChange = hasPermission("backup.admin.restore_rules.manage");
  const [rules, setRules] = useState<RestoreRuleRecord[]>();
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<Edit>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .restoreRules()
      .then((list) => {
        if (!live) return;
        setRules(list);
        setError("");
      })
      .catch((e) => {
        if (live) setError(getApiErrorMessage(e, "The restore rules could not be loaded."));
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const newValue = editing ? Number(editing.value) : NaN;
  const valid = !!editing && Number.isInteger(newValue) && newValue >= editing.rule.min && newValue <= editing.rule.max && newValue !== editing.rule.value;

  const signed = async (data: { signatureToken?: string }) => {
    const current = editing;
    setEditing(undefined);
    if (!current) return;
    if (!data.signatureToken) {
      showToast({ type: "error", title: "The signature could not be confirmed", message: "Try again." });
      return;
    }
    setBusy(true);
    try {
      await backupRestoreApi.changeRestoreRule(current.rule.code, Number(current.value), current.reason.trim(), data.signatureToken);
      showToast({ type: "success", title: "Rule changed", message: `${current.rule.code} is now ${current.value}` });
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: "The rule was not changed", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BackupRestorePage title="Restore Approval & Execution Rules" group="Restore" preview={false}>
      <WarningBanner variant="info" title="What can be set here" description="Only the values listed below can be changed. Each change needs a reason and an electronic signature, and is kept with its history." />
      {error && <WarningBanner variant="error" title="Unable to load" description={error} />}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-sm font-semibold text-slate-800">Values you may change</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {rules?.length === 0 && <li className="py-2 text-sm text-slate-500">No rules are defined.</li>}
          {rules?.map((rule) => (
            <li key={rule.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{rule.code}</p>
                <p className="text-xs text-slate-500">{rule.description}</p>
                <p className="text-xs text-slate-500">
                  Allowed: {rule.min} to {rule.max}. Last changed by {rule.updatedBy} on {formatDateTime(rule.updatedAt)}.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-slate-900">{rule.value}</span>
                {canChange && (
                  <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setEditing({ rule, step: "form", value: String(rule.value), reason: "" })}>
                    Change
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-sm font-semibold text-slate-800">Fixed controls (part of the procedure)</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {FIXED_CONTROLS.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </div>

      <FormModal
        isOpen={editing?.step === "form"}
        onClose={() => setEditing(undefined)}
        title={`Change ${editing?.rule.code ?? "rule"}`}
        description={`Currently ${editing?.rule.value ?? ""}. Allowed from ${editing?.rule.min ?? ""} to ${editing?.rule.max ?? ""}.`}
        confirmText="Continue to sign"
        confirmDisabled={!valid || !editing?.reason.trim() || busy}
        onConfirm={() => editing && setEditing({ ...editing, step: "sign" })}
      >
        <FormField label="New value" required>
          <Input type="number" value={editing?.value ?? ""} onChange={(event) => editing && setEditing({ ...editing, value: event.target.value })} />
        </FormField>
        <FormField label="Reason" required>
          <Textarea rows={3} maxLength={500} value={editing?.reason ?? ""} onChange={(event) => editing && setEditing({ ...editing, reason: event.target.value })} />
        </FormField>
      </FormModal>

      <ESignatureModal
        isOpen={editing?.step === "sign"}
        onClose={() => setEditing(undefined)}
        deferConfirm
        onConfirm={signed}
        actionTitle={`Change ${editing?.rule.code ?? "rule"} to ${editing?.value ?? ""}`}
        meaningDisplayName="Backup Restore Rule Change"
        meaningCode="BACKUP_RESTORE_RULE_CHANGE"
      />
    </BackupRestorePage>
  );
};
