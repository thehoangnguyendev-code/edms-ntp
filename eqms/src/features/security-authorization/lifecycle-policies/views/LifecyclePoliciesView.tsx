import React, { useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { workflowAuthorization as workflowAuthorizationBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { ROUTES } from "@/app/routes.constants";
import { Plus, RefreshCw, Shield } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkflowTransitionsView, type WorkflowTransitionsViewHandle } from "./WorkflowTransitionsView";
import { StateCapabilitiesView } from "./StateCapabilitiesView";
import { WorkflowRolesView, type WorkflowRolesViewHandle } from "./WorkflowRolesView";
import { ActionStatusMatrix } from "../components/ActionStatusMatrix";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { tr } from "@/i18n";

type TabId = "matrix" | "transitions" | "capabilities" | "roles";

const TAB_LABELS: Record<TabId, string> = {
  matrix: tr("Action Matrix"),
  transitions: tr("Transition Policies"),
  capabilities: tr("State Capabilities"),
  roles: tr("Workflow Roles"),
};

const TABS: TabItem[] = [
  { id: "matrix", label: TAB_LABELS.matrix },
  { id: "transitions", label: TAB_LABELS.transitions },
  { id: "capabilities", label: TAB_LABELS.capabilities },
  { id: "roles", label: TAB_LABELS.roles },
];

export const LifecyclePoliciesView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const transitionViewRef = useRef<WorkflowTransitionsViewHandle>(null);
  const rolesViewRef = useRef<WorkflowRolesViewHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabId = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "capabilities" || tab === "transitions" || tab === "roles" ? tab : "matrix";
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };

  const breadcrumbItems = useMemo(
    () => workflowAuthorizationBreadcrumb(navigate, TAB_LABELS[activeTab]),
    [navigate, activeTab],
  );

  const canManage = hasPermissionAlias("security.workflow_authorization.manage");
  const pageActions = activeTab === "roles" ? (
    canManage ? (
      <Button size="sm" className="whitespace-nowrap gap-2" onClick={() => rolesViewRef.current?.openNew()}>
        <Plus className="h-4 w-4" />
        {tr("New Custom Role")}
      </Button>
    ) : undefined
  ) : activeTab === "capabilities" ? (
    canManage ? (
    <Button
      size="sm"
      className="whitespace-nowrap gap-2"
      onClick={() => navigate(`${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/state-policies/new`)}
    >
      <Plus className="h-4 w-4" />
      {tr("New State Policy")}
    </Button>
    ) : undefined
  ) : activeTab === "transitions" ? (
    <>
      <Button variant="outline" size="sm" className="whitespace-nowrap gap-2" onClick={() => navigate(ROUTES.SECURITY.POLICY_RESOLVER)}>
        <Shield className="h-4 w-4" />
        {tr("Engine Diagnostics")}
      </Button>
      <Button variant="outline" size="sm" className="whitespace-nowrap gap-2" onClick={() => transitionViewRef.current?.refresh()}>
        <RefreshCw className="h-4 w-4" />
        {tr("Refresh")}
      </Button>
      {canManage && (
        <Button size="sm" className="whitespace-nowrap gap-2" onClick={() => navigate(`${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/new`)}>
          <Plus className="h-4 w-4" />
          {tr("New Policy")}
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={tr("Workflow Authorization")}
        breadcrumbItems={breadcrumbItems}
        actions={pageActions}
      />
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <TabNav tabs={TABS} activeTab={activeTab} onChange={handleTabChange} variant="underline" />
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          {activeTab !== "matrix" && (
            <div className="mb-4">
              <WarningBanner
                variant="info"
                description={
                  activeTab === "roles"
                    ? tr("A workflow role is a job a person can be given on a record, such as Reviewer or Approver. An Access Profile lists the roles its holders have, and the policies in the other tabs use them to decide who may act.")
                    : activeTab === "transitions"
                    ? tr("Advanced: this is the full list of rules behind the Action Matrix, one row per rule. Open it to change a rule or add an exception. To just see who may do what, use the Action Matrix tab.")
                    : tr("Advanced: these rules decide what each status allows (for example whether a record can be edited). Change them only when the lifecycle itself changes. To see who may do what, use the Action Matrix tab.")
                }
              />
            </div>
          )}
          {activeTab === "matrix" && <ActionStatusMatrix />}
          {activeTab === "capabilities" && <StateCapabilitiesView embedded />}
          {activeTab === "transitions" && <WorkflowTransitionsView ref={transitionViewRef} embedded />}
          {activeTab === "roles" && <WorkflowRolesView ref={rolesViewRef} />}
        </div>
      </div>
    </div>
  );
};
