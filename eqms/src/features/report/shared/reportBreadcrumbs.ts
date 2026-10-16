import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { dashboard } from "@/components/ui/breadcrumb/breadcrumbs/shared";
import { reportAdministration } from "@/components/ui/breadcrumb/breadcrumbs/settings";

/**
 * Breadcrumb of every report page. A page of Reports & Analytics starts at the Dashboard and "Reports & Analytics"; a page of Report
 * Administration shares the System Administration trail of the other administration pages. A page below a list names that list as its parent.
 */
export function reportBreadcrumbs(
  navigate: (path: string) => void,
  title: string,
  configuration = false,
  parent?: { label: string; onClick: () => void },
): BreadcrumbItem[] {
  const base: BreadcrumbItem[] = configuration
    ? reportAdministration(navigate, "").slice(0, -1)
    : [dashboard(navigate), { label: "Reports & Analytics" }];
  return [...base, ...(parent ? [parent] : []), { label: title, isActive: true }];
}
