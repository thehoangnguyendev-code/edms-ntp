import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { reportBreadcrumbs } from "./reportBreadcrumbs";

/** Who may see the registers that follow the reports (the same rule as the routes in QualityRoutes). */
const REGISTER_PERMISSIONS = ["reports.definition.view"];

interface PairTab {
  id: string;
  label: string;
  path: string;
  needsRegisterAccess?: boolean;
}

/**
 * Two menu entries hold a second list as a tab: Report Run History (with the Legal Hold Register) and Scheduled Reports (with the Delivery Log). The page title
 * and the breadcrumb are the name of the menu entry for both tabs, as in Job Assignments; each tab keeps its own address below the address of the entry,
 * so the sidebar finds the entry and a link or a notification opens the right tab.
 */
export const REPORT_TAB_PAIRS = {
  runs: {
    title: "Report Run History",
    tabs: [
      { id: "history", label: "Run History", path: ROUTES.REPORT.HISTORY },
      { id: "legal-holds", label: "Legal Hold Register", path: ROUTES.REPORT.LEGAL_HOLDS, needsRegisterAccess: true },
    ] as PairTab[],
  },
  scheduled: {
    title: "Scheduled Reports",
    tabs: [
      { id: "scheduled", label: "Schedules", path: ROUTES.REPORT.SCHEDULED },
      { id: "delivery-log", label: "Delivery Log", path: ROUTES.REPORT.DELIVERY_LOG, needsRegisterAccess: true },
    ] as PairTab[],
  },
};

/** Header (title, breadcrumb, actions of the tab that is open) and one card holding the tabs and the list, with the list not framed again, as Job Assignments does. */
export function ReportTabsFrame({ pair, actions, children }: { pair: keyof typeof REPORT_TAB_PAIRS; actions?: ReactNode; children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { hasAnyPermission } = usePermissions();
  const { title, tabs } = REPORT_TAB_PAIRS[pair];
  const visible = tabs.filter((tab) => !tab.needsRegisterAccess || hasAnyPermission(REGISTER_PERMISSIONS));
  const active = visible.find((tab) => tab.path === pathname)?.id ?? visible[0].id;
  return (
    <>
      <PageHeader title={title} breadcrumbItems={reportBreadcrumbs(navigate, title)} actions={actions} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {visible.length > 1 && (
          <TabNav
            tabs={visible}
            activeTab={active}
            variant="underline"
            ariaLabel={title}
            tabIdPrefix={`report-${pair}-tab`}
            panelIdPrefix={`report-${pair}-panel`}
            onChange={(id) => {
              const tab = visible.find((candidate) => candidate.id === id);
              if (tab && tab.path !== pathname) navigate(tab.path);
            }}
          />
        )}
        <div id={`report-${pair}-panel-${active}`} role="tabpanel" aria-labelledby={`report-${pair}-tab-${active}`} className="min-w-0">
          {children}
        </div>
      </div>
    </>
  );
}
