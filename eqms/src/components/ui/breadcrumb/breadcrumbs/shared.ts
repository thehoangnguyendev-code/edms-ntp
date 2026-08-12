import type { BreadcrumbItem } from "../Breadcrumb";

import { ROUTES } from "@/app/routes.constants";

/** Dashboard root item — always the first breadcrumb */
export const dashboard = (_navigate?: (path: string) => void): BreadcrumbItem => ({
  label: "Dashboard",
  onClick: () => _navigate?.(ROUTES.DASHBOARD),
});
