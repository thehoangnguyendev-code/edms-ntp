import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { dashboard } from "@/components/ui/breadcrumb/breadcrumbs/shared";
import { reportAdministration } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { ROUTES } from "@/app/routes.constants";

/**
 * The group of the menu that holds a page of Reports (REPORT-MENU-2026-11-15, REPORT-MODULE-FLAT-2026-11-16). Keyed by the name of the menu entry; a page that opens one record
 * is found by its parent, which is that entry. Report Library, Report Run History and Scheduled Reports are entries of their own, with no group.
 */
const MENU_GROUP: Record<string, string> = {
  "Report Templates": "Template Management",
  "All Revisions": "Template Management",
  "Pending My Approval": "Template Management",
  "Report Template Details": "Template Management",
};

/**
 * Breadcrumb of every report page. A page of Reports starts at the Dashboard, "Reports" and the menu group of the page; a page of Report
 * Administration shares the System Administration trail of the other administration pages. A page below a list names that list as its parent.
 */
export function reportBreadcrumbs(
  navigate: (path: string) => void,
  title: string,
  configuration = false,
  parent?: { label: string; onClick: () => void },
): BreadcrumbItem[] {
  const group = configuration ? undefined : MENU_GROUP[parent?.label ?? title];
  const base: BreadcrumbItem[] = configuration
    ? reportAdministration(navigate, "").slice(0, -1)
    : [dashboard(navigate), { label: "Reports" }, ...(group ? [{ label: group }] : [])];
  // The details page of a template sits below the list of templates: a page opened from it says so, as the page of the template itself does.
  const chain = parent?.label === "Report Template Details" && !configuration
    ? [{ label: "Report Templates", onClick: () => navigate(ROUTES.REPORT.TEMPLATE_MANAGEMENT) }, parent]
    : parent ? [parent] : [];
  return [...base, ...chain, { label: title, isActive: true }];
}
