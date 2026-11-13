import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { authorizationDiagnostics as authorizationDiagnosticsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { RelationDefinitionsTab } from "./RelationDefinitionsTab";
import { EngineHealthTab } from "./EngineHealthTab";
import { SimulatorTab } from "./SimulatorTab";
import { PolicyResolverTab } from "./PolicyResolverTab";

type TabId = "resolver" | "simulator" | "relations" | "engineHealth";

const TAB_LABELS: Record<TabId, string> = {
  resolver: "Policy Resolver",
  simulator: "Simulator",
  relations: "Relation Definitions",
  engineHealth: "Engine Health",
};

const TABS: TabItem[] = [
  { id: "resolver", label: TAB_LABELS.resolver },
  { id: "simulator", label: TAB_LABELS.simulator },
  { id: "relations", label: TAB_LABELS.relations },
  { id: "engineHealth", label: TAB_LABELS.engineHealth },
];

/**
 * Read-only diagnostic tools for the hybrid authorization engine, all on this one page: Policy
 * Resolver ("which policy applies to this action?"), Simulator ("could this person do it?"),
 * Relation Definitions and Engine Health. Split into its own page
 * (nested under "Advanced" in the sidebar, alongside the other expert/one-time-config screens)
 * rather than tabs sharing "Workflow Authorization", since these answer a different kind of
 * question (engine internals/testing) than the policy configuration tabs do. See each tab's own
 * intro text for what it's for.
 */
export const AuthorizationDiagnosticsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabId = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "simulator" || tab === "relations" || tab === "engineHealth" ? tab : "resolver";
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };

  const breadcrumbItems = useMemo(
    () => authorizationDiagnosticsBreadcrumb(navigate, TAB_LABELS[activeTab]),
    [navigate, activeTab],
  );

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader title="Engine Diagnostics" breadcrumbItems={breadcrumbItems} />
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <TabNav tabs={TABS} activeTab={activeTab} onChange={handleTabChange} variant="underline" />
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          {activeTab === "resolver" && <PolicyResolverTab />}
          {activeTab === "simulator" && <SimulatorTab />}
          {activeTab === "relations" && <RelationDefinitionsTab />}
          {activeTab === "engineHealth" && <EngineHealthTab />}
        </div>
      </div>
    </div>
  );
};
