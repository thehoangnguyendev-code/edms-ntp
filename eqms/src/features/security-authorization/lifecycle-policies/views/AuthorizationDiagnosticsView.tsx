import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { authorizationDiagnostics as authorizationDiagnosticsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { RelationDefinitionsTab } from "./RelationDefinitionsTab";
import { SimulatorTab } from "./SimulatorTab";
import { PolicyResolverTab } from "./PolicyResolverTab";
import { tr } from "@/i18n";

type TabId = "resolver" | "simulator" | "relations";

const TAB_LABELS: Record<TabId, string> = {
  get resolver() { return tr("Policy Resolver"); },
  get simulator() { return tr("Simulator"); },
  get relations() { return tr("Relation Definitions"); },
};

const TABS: TabItem[] = [
  { id: "resolver", label: TAB_LABELS.resolver },
  { id: "simulator", label: TAB_LABELS.simulator },
  { id: "relations", label: TAB_LABELS.relations },
];

/**
 * Read-only diagnostic tools for the hybrid authorization engine, all on this one page: Policy
 * Resolver ("which policy applies to this action?"), Simulator ("could this person do it?") and
 * Relation Definitions. Split into its own page
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
    return tab === "simulator" || tab === "relations" ? tab : "resolver";
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };

  // The breadcrumb ends at the page name; the tab is shown by the tab bar itself.
  const breadcrumbItems = useMemo(() => authorizationDiagnosticsBreadcrumb(navigate), [navigate]);

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader title={tr("Engine Diagnostics")} breadcrumbItems={breadcrumbItems} />
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <TabNav tabs={TABS} activeTab={activeTab} onChange={handleTabChange} variant="underline" />
        <div className="p-4 md:p-5 flex-1 flex flex-col">
          {activeTab === "resolver" && <PolicyResolverTab />}
          {activeTab === "simulator" && <SimulatorTab />}
          {activeTab === "relations" && <RelationDefinitionsTab />}
        </div>
      </div>
    </div>
  );
};
