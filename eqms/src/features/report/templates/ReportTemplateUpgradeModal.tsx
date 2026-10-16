import { useEffect, useState } from "react";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { reportTemplatesApi, reportError, type ReportTemplate } from "@/services/api/reportTemplates";

/**
 * Upgrade Report Template: starts the next revision from the effective one (REPORT-TEMPLATE-REVISION-2026-10-14). The effective revision goes on
 * running until the new revision is approved. The server checks that no revision is open and that the template has not changed.
 */
export function ReportTemplateUpgradeModal({
  template,
  isOpen,
  onClose,
  onUpgraded,
}: {
  template: Pick<ReportTemplate, "code" | "definitionVersion" | "effectiveRevision">;
  isOpen: boolean;
  onClose: () => void;
  onUpgraded: (upgraded: ReportTemplate) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError("");
    }
  }, [isOpen]);

  const upgrade = async () => {
    setBusy(true);
    setError("");
    try {
      onUpgraded(await reportTemplatesApi.upgrade(template.code, template.definitionVersion, reason.trim()));
    } catch (e) {
      setError(reportError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Upgrade Report Template"
      description={`Start Rev ${(template.effectiveRevision ?? 0) + 1} from Rev ${template.effectiveRevision ?? ""}. Rev ${template.effectiveRevision ?? ""} stays in use until the new revision is approved; then it becomes Obsoleted and can still be viewed.`}
      confirmText="Upgrade"
      confirmDisabled={!reason.trim() || busy}
      onConfirm={() => void upgrade()}
    >
      <FormField label="Reason for the upgrade" required>
        <Textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </FormField>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </FormModal>
  );
}
