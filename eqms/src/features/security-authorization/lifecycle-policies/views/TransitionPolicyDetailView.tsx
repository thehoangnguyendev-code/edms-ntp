import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ShieldCheck, UserCheck, Workflow } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { useToast } from "@/components/ui/toast/Toast";
import { lifecyclePoliciesSubPage } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { workflowActionPolicyApi } from "@/services/api/workflowActionPolicy";
import { formatDateTime } from "@/utils/format";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { extractApiError } from "../workflowPolicyUtils";
import type { WorkflowActionPolicy, WorkflowActionPolicyActor } from "../types";
import { statusText } from "../../shared/humanizeCode";
import { tr } from "@/i18n";

const MANAGE_PERM = "security.workflow_authorization.manage";
const LIST_ROUTE = `${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}?tab=transitions`;

const warningCodes = (policy: WorkflowActionPolicy): string[] =>
  ((policy.warnings ?? []) as unknown[]).map((w) => (typeof w === "string" ? w : String((w as { code?: string }).code ?? "")));

/** "Permission: Permission (x)" would say the type twice: show the name alone when it already starts with the type. */
const actorText = (a: WorkflowActionPolicyActor): string => {
  const type = a.actorTypeLabel ?? a.actorType;
  const name = a.actorDisplayName ?? (a.actorCode ? `(${a.actorCode})` : "");
  if (!name) return type;
  return name.toLowerCase().startsWith(type.toLowerCase()) ? name : `${type}: ${name}`;
};

const Field: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={wide ? "md:col-span-2" : undefined}>
    <dt className="text-xs font-medium text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm text-slate-900 break-words">{children}</dd>
  </div>
);

/**
 * Workflow Authorization > Transition Policies > Transition Policy Details: the read-only page of one policy. Editing is its own page (Edit Transition Policy); the functions that belong to a policy
 * (edit, override for one document type, duplicate, activate or deactivate, reset to the system default) are the buttons of this page's header, as in the menu of the list.
 */
export const TransitionPolicyDetailView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias(MANAGE_PERM);
  const { requestSignature, signatureModal } = useSecurityESign();

  const [policy, setPolicy] = useState<WorkflowActionPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"activate" | "deactivate" | "reset" | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    try {
      setPolicy(await workflowActionPolicyApi.getPolicy(id));
    } catch {
      setFailed(true);
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const here = `${location.pathname}${location.search}`;
  const goBack = () => navigateBack(navigate, location.state, LIST_ROUTE);
  const base = ROUTES.SECURITY.WORKFLOW_AUTHORIZATION;
  const breadcrumbItems = lifecyclePoliciesSubPage(navigate, "Transition Policies", "Transition Policy Details");

  const decidesAlone = policy ? warningCodes(policy).includes("ENGINE_DECIDES_ALONE") : false;
  const otherWarnings = policy ? warningCodes(policy).filter((code) => code !== "ENGINE_DECIDES_ALONE") : [];

  const run = async (kind: "activate" | "deactivate" | "reset") => {
    if (!policy) return;
    const title = kind === "activate" ? "Activate Workflow Policy" : kind === "deactivate" ? "Deactivate Workflow Policy" : "Reset Policy to System Default";
    const sig = await requestSignature(title, "Workflow Authorization Change");
    if (!sig) return;
    setBusy(true);
    try {
      if (kind === "activate") await workflowActionPolicyApi.activatePolicy(policy.id, sig);
      else if (kind === "deactivate") await workflowActionPolicyApi.deactivatePolicy(policy.id, sig);
      else await workflowActionPolicyApi.resetToDefault(policy.id, sig);
      showToast({ type: "success", title: kind === "activate" ? "Activated" : kind === "deactivate" ? "Deactivated" : "Reset", message: kind === "activate" ? "Policy activated." : kind === "deactivate" ? "Policy deactivated." : "Policy reset to system default." });
      await load();
    } catch (err) {
      showToast({ type: "error", title: "Failed", message: extractApiError(err).message });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  if (loading) return <FullPageLoading text="Loading workflow policy..." />;

  if (failed || !policy) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <PageHeader title={tr("Transition Policy Details")} breadcrumbItems={breadcrumbItems} actions={<Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={goBack}>{tr("Back")}</Button>} />
        <TableEmptyState title={tr("Policy not found")} description={tr("This policy does not exist any more, or you do not have permission to view it.")} />
      </div>
    );
  }

  const required = (policy.relations ?? []).filter((r) => !r.forbidden);
  const forbidden = (policy.relations ?? []).filter((r) => r.forbidden);
  const actionName = statusText(policy.actionLabel, policy.actionCode);

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={goBack}>
        {tr("Back")}
      </Button>
      {canManage && (
        <>
          <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => navigate(`${base}/${policy.id}/edit`, { state: { from: here } })}>
            {tr("Edit Policy")}
          </Button>
          <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => navigate(`${base}/${policy.id}/edit?mode=override`, { state: { from: here } })}>
            {tr("Create Override")}
          </Button>
          <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => navigate(`${base}/${policy.id}/duplicate`, { state: { from: here } })}>
            {tr("Duplicate")}
          </Button>
          {!policy.active ? (
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setConfirm("activate")}>
              {tr("Activate")}
            </Button>
          ) : (
            policy.deactivatable !== false && (
              <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setConfirm("deactivate")}>
                {tr("Deactivate")}
              </Button>
            )
          )}
          {policy.system && policy.resettable !== false && (
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setConfirm("reset")}>
              {tr("Reset Default")}
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {signatureModal}
      <PageHeader title={tr("Transition Policy Details")} breadcrumbItems={breadcrumbItems} actions={actions} />

      {!policy.active && <WarningBanner variant="warning">{tr("This policy is inactive. It is not used until it is activated.")}</WarningBanner>}
      {decidesAlone && (
        <WarningBanner variant="info">{tr("This policy is the only decision about who may do this action. With it inactive, nobody can do the action from this state, whatever their permissions.")}</WarningBanner>
      )}
      {otherWarnings.length > 0 && <WarningBanner variant="warning">{otherWarnings.join(", ")}</WarningBanner>}

      <FormSection
        title={tr("Policy")}
        icon={<Workflow className="h-4 w-4" />}
        headerRight={
          <>
            <Badge color={policy.active ? "emerald" : "slate"} size="sm">{policy.active ? "Active" : "Inactive"}</Badge>
            <Badge color={policy.system ? "blue" : "slate"} size="sm">{policy.system ? "System" : "Custom"}</Badge>
          </>
        }
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <Field label={tr("Module")}>{policy.moduleLabel ?? policy.moduleKey}</Field>
          <Field label={tr("Workflow")}>{policy.workflowLabel ?? policy.workflowKey}</Field>
          <Field label={tr("Action")}>
            {actionName}
            <span className="block text-xs text-slate-500">{policy.actionCode}</span>
          </Field>
          <Field label={tr("From Status")}>
            {statusText(policy.fromStatusLabel, policy.fromStatus)}
            <span className="block text-xs text-slate-500">{policy.fromStatus}</span>
          </Field>
          <Field label={tr("Document Type")}>{policy.documentTypeName ?? <span className="italic text-slate-500">{tr("Global (all document types)")}</span>}</Field>
          <Field label={tr("Priority")}>{policy.priority}</Field>
          <Field label={tr("Required Permission")}>
            {policy.requiredPermissionName ?? policy.requiredPermissionCode}
            {policy.requiredPermissionName && <span className="block text-xs text-slate-500">{policy.requiredPermissionCode}</span>}
          </Field>
          <Field label={tr("Last Updated")}>{policy.updatedAt ? formatDateTime(policy.updatedAt) : "—"}</Field>
          <Field label={tr("Created")}>{policy.createdAt ? formatDateTime(policy.createdAt) : "—"}</Field>
          <Field label={tr("Description")} wide>{policy.description || <span className="text-slate-500">{tr("(none)")}</span>}</Field>
        </dl>
      </FormSection>

      <FormSection title={tr("Actors")} icon={<UserCheck className="h-4 w-4" />} description={tr("Who may do this action, besides holding the permission")}>
        {policy.actors.length === 0 ? (
          <p className="text-sm text-slate-500">{tr("No actor is set for this policy.")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {policy.actors.map((a, i) => (
              <li key={a.id ?? `${a.actorType}-${a.actorCode ?? i}`}>
                <Badge color="blue" size="sm">{actorText(a)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <FormSection title={tr("Relations")} icon={<ShieldCheck className="h-4 w-4" />} description={tr("What the person must be to the record, and who must be a different person")}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <Field label={`Required (${policy.relationMatchRule === "ALL" ? "all of them" : "any one of them"})`}>
            {required.length === 0 ? (
              <span className="text-slate-500">{tr("No relation is required: the permission is enough.")}</span>
            ) : (
              <span className="flex flex-wrap gap-2">
                {required.map((r) => (
                  <Badge key={r.id} color="emerald" size="sm">{r.relationDisplayName || r.relationCode}</Badge>
                ))}
              </span>
            )}
          </Field>
          <Field label={tr("Must be a different person from")}>
            {forbidden.length === 0 ? (
              <span className="text-slate-500">{tr("No one: the same person may do more than one job on the record.")}</span>
            ) : (
              <span className="flex flex-wrap gap-2">
                {forbidden.map((r) => (
                  <Badge key={r.id} color="red" size="sm">{r.relationDisplayName || r.relationCode}</Badge>
                ))}
              </span>
            )}
          </Field>
        </dl>
      </FormSection>

      <AlertModal
        isOpen={confirm === "activate"}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run("activate")}
        type="info"
        title={tr("Activate Policy")}
        description={`Activate policy for "${actionName}"?`}
        confirmText="Activate"
        cancelText="Cancel"
        showCancel
        isLoading={busy}
      />
      <AlertModal
        isOpen={confirm === "deactivate"}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run("deactivate")}
        type="warning"
        title={tr("Deactivate Policy")}
        description={`${decidesAlone ? "This policy is the only decision about who may do this action. With it inactive nobody can do the action from this state, whatever their permissions." : "Deactivating this policy may cause the action to be denied when no other active policy matches."}\n\nAre you sure you want to deactivate "${actionName}"?`}
        confirmText={tr("Deactivate")}
        cancelText="Cancel"
        showCancel
        isLoading={busy}
      />
      <AlertModal
        isOpen={confirm === "reset"}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run("reset")}
        type="warning"
        title={tr("Reset to System Default")}
        description={`This will restore the system default permission, actors, priority, active flag, description, and global document type scope for "${actionName}".`}
        confirmText="Reset"
        cancelText="Cancel"
        showCancel
        isLoading={busy}
      />
    </div>
  );
};
