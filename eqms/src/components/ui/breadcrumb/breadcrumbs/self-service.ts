import type { BreadcrumbItem } from "../Breadcrumb";
import { dashboard } from "./shared";

type NavigateFn = (path: string) => void;

/** Base breadcrumb path for the Self-Service group (Dashboard, Knowledge). */
const selfServiceBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Self-Service" },
];

export const knowledge = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...selfServiceBase(navigate),
  { label: "Knowledge", isActive: true },
];
