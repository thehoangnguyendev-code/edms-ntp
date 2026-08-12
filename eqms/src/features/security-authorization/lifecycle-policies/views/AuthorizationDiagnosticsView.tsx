import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { authorizationDiagnostics as authorizationDiagnosticsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { RelationDefinitionsTab } from "./RelationDefinitionsTab";
import { EngineHealthTab } from "./EngineHealthTab";
import { SimulatorTab } from "./SimulatorTab";

type TabId = "relations" | "engineHealth" | "simulator";

const TAB_LABELS: Record<TabId, string> = {
  relations: "Relation Definitions",
  engineHealth: "Engine Health",
  simulator: "Simulator",
};

const TABS: TabItem[] = [
  { id: "relations", label: TAB_LABELS.relations },
  { id: "engineHealth", label: TAB_LABELS.engineHealth },
  { id: "simulator", label: TAB_LABELS.simulator },
];

/**
 * Read-only diagnostic tools for the new hybrid authorization engine -- split into its own page
 * (sibling to "Workflow Authorization" in the sidebar) rather than tabs sharing that page, since
 * these answer a different kind of question (engine internals/testing) than the policy
 * configuration tabs do. See each tab's own intro text for what it's for.
 */
export const AuthorizationDiagnosticsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabId = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "engineHealth" || tab === "simulator" ? tab : "relations";
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
          {activeTab === "relations" && <RelationDefinitionsTab />}
          {activeTab === "engineHealth" && <EngineHealthTab />}
          {activeTab === "simulator" && <SimulatorTab />}
        </div>
      </div>
    </div>
  );
};
