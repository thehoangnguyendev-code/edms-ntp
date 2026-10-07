import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { dashboard } from "@/components/ui/breadcrumb/breadcrumbs/shared";

export function reportBreadcrumbs(
  navigate: (path: string) => void,
  title: string,
  configuration = false,
  parent?: { label: string; onClick: () => void },
): BreadcrumbItem[] {
  return [
    dashboard(navigate),
    { label: configuration ? "Application Settings" : "Reports & Analytics" },
    ...(parent ? [parent] : []),
    { label: title, isActive: true },
  ];
}
