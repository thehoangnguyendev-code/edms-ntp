import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Copy, Shield, FilePlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { workflowActionPolicyApi } from "@/services/api/workflowActionPolicy";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { lifecyclePoliciesSubPage } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { extractApiError } from "../workflowPolicyUtils";
import type { WorkflowActionPolicy } from "../types";
import { useTranslation } from "@/i18n";

const VIEW_PERM = "security.workflow_authorization.view";
const MANAGE_PERM = "security.workflow_authorization.manage";

const readOnlyField = (label: string, value: string) => (
  <div>
    <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">{label}</label>
    <div className="h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 truncate">
      {value || "(none)"}
    </div>
  </div>
);

export const WorkflowPolicyDuplicateView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias(MANAGE_PERM);
  const { requestSignature, signatureModal } = useSecurityESign();

  const [policy, setPolicy] = useState<WorkflowActionPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    workflowActionPolicyApi
      .getPolicy(id)
      .then((p) => {
        if (!cancelled) setPolicy(p);
      })
      .catch(() => {
        if (!cancelled) showToast({ type: "error", message: t("workflowPolicyDuplicate.loadFailed") });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, showToast, t]);

  const handleBack = () => navigateBack(navigate, location.state, ROUTES.SECURITY.WORKFLOW_AUTHORIZATION);

  const handleSave = async () => {
    if (!policy?.id) return;
    const sig = await requestSignature("Duplicate Workflow Authorization Policy", "Workflow Authorization Change");
    if (!sig) return;
    setSaving(true);
    try {
      await workflowActionPolicyApi.duplicatePolicy(policy.id, {
        changeReason: changeReason || undefined,
        signatureToken: sig.signatureToken,
      });
      showToast({ type: "success", title: t("workflowPolicyDuplicate.successTitle"), message: t("workflowPolicyDuplicate.successMessage") });
      handleBack();
    } catch (err) {
      const { message } = extractApiError(err);
      showToast({ type: "error", title: t("workflowPolicyDuplicate.saveFailedTitle"), message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <FullPageLoading text="Loading source policy..." />;
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">You do not have permission to manage Workflow Authorization policies.</p>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title="Duplicate Policy"
          breadcrumbItems={lifecyclePoliciesSubPage(navigate, "Transitions", "Duplicate Policy")}
          actions={<Button variant="outline-emerald" size="sm" onClick={handleBack}>Back</Button>}
        />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center gap-3">
          <Copy className="h-12 w-12 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Source policy not found</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleBack}>Back to Workflow Authorization</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {signatureModal}
      <PageHeader
        title="Duplicate Policy"
        breadcrumbItems={lifecyclePoliciesSubPage(navigate, "Transitions", "Duplicate Policy")}
        actions={
          <>
            <Button variant="outline-emerald" size="sm" onClick={handleBack} className="whitespace-nowrap">
              Cancel
            </Button>
            <Button size="sm" variant="outline-emerald" onClick={() => void handleSave()} disabled={saving} className="whitespace-nowrap">
              {saving ? "Saving…" : "Duplicate"}
            </Button>
          </>
        }
      />

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
        The duplicated policy will be created as <b>inactive</b> so it can be reviewed and configured before enabling.
        Use "Edit Policy" afterwards to adjust its permission, actors, or scope.
      </div>

      <FormSection title="Source Policy" icon={<Copy className="h-4 w-4" />} description="Read-only summary of the policy being duplicated." contentClassName="p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {readOnlyField("Module", policy.moduleLabel ?? policy.moduleKey)}
          {readOnlyField("Workflow", policy.workflowLabel ?? policy.workflowKey)}
          {readOnlyField("Object Type", policy.objectType)}
          {readOnlyField("Action", policy.actionLabel ?? policy.actionCode)}
          {readOnlyField("From Status", policy.fromStatusLabel ?? policy.fromStatus)}
          {readOnlyField("Document Type", policy.documentTypeName ?? "Global")}
          {readOnlyField("Required Permission", policy.requiredPermissionCode)}
          {readOnlyField("Priority", String(policy.priority))}
        </div>
        <div className="mt-4">
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Actors</label>
          <div className="flex flex-wrap gap-1.5">
            {policy.actors.length === 0 ? (
              <span className="text-sm text-slate-400">(none)</span>
            ) : (
              policy.actors.map((a, i) => (
                <Badge key={i} color="slate" size="sm">
                  {a.actorTypeLabel ?? a.actorType}
                  {a.actorCode ? ` (${a.actorCode})` : ""}
                </Badge>
              ))
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title="New Policy" icon={<FilePlus className="h-4 w-4" />} contentClassName="p-4 md:p-5">
        <div>
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Change Reason</label>
          <input
            type="text"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="Optional reason for this duplication..."
            className="h-9 w-full border border-slate-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </FormSection>
    </div>
  );
};
