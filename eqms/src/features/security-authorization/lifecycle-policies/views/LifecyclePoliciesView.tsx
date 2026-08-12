import React, { useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { Button } from "@/components/ui/button/Button";
import { workflowAuthorization as workflowAuthorizationBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { ROUTES } from "@/app/routes.constants";
import { Plus, RefreshCw, Shield } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkflowAuthorizationView, type WorkflowAuthorizationViewHandle } from "./WorkflowAuthorizationView";
import { StatePoliciesView } from "./StatePoliciesView";
import { ActionStatusMatrix } from "../components/ActionStatusMatrix";

type TabId = "matrix" | "transitions" | "capabilities";

const TAB_LABELS: Record<TabId, string> = {
  matrix: "Matrix",
  transitions: "Transitions",
  capabilities: "Capabilities",
};

const TABS: TabItem[] = [
  { id: "matrix", label: TAB_LABELS.matrix },
  { id: "transitions", label: TAB_LABELS.transitions },
  { id: "capabilities", label: TAB_LABELS.capabilities },
];

export const LifecyclePoliciesView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const transitionViewRef = useRef<WorkflowAuthorizationViewHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabId = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "capabilities" || tab === "matrix" ? tab : "transitions";
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
  const pageActions = activeTab === "capabilities" ? (
    canManage ? (
    <Button
      size="sm"
      className="whitespace-nowrap gap-2"
      onClick={() => navigate(`${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/state-policies/new`)}
    >
      <Plus className="h-4 w-4" />
      New State Policy
    </Button>
    ) : undefined
  ) : activeTab === "transitions" ? (
    <>
      <Button variant="outline" size="sm" className="whitespace-nowrap gap-2" onClick={() => transitionViewRef.current?.openEffectiveLookup()}>
        <Shield className="h-4 w-4" />
        Effective Lookup
      </Button>
      <Button variant="outline" size="sm" className="whitespace-nowrap gap-2" onClick={() => transitionViewRef.current?.refresh()}>
        <RefreshCw className="h-4 w-4" />
        Refresh
      </Button>
      {canManage && (
        <Button size="sm" className="whitespace-nowrap gap-2" onClick={() => navigate(`${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}/new`)}>
          <Plus className="h-4 w-4" />
          New Policy
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="Workflow Authorization"
        breadcrumbItems={breadcrumbItems}
        actions={pageActions}
      />
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <TabNav tabs={TABS} activeTab={activeTab} onChange={handleTabChange} variant="underline" />
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          {activeTab === "matrix" && <ActionStatusMatrix />}
          {activeTab === "capabilities" && <StatePoliciesView embedded />}
          {activeTab === "transitions" && <WorkflowAuthorizationView ref={transitionViewRef} embedded />}
        </div>
      </div>
    </div>
  );
};
