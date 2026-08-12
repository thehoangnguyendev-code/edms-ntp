import type { BreadcrumbItem } from "../Breadcrumb";
import { dashboard } from "./shared";
import { ROUTES } from "@/app/routes.constants";

type NavigateFn = (path: string) => void;

export const equipmentManagement = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Equipment Management", isActive: true },
];

export const changeControl = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Change Controls", isActive: true },
];

export const auditTrail = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Audit Trail", onClick: () => navigate?.(ROUTES.AUDIT_TRAIL) },
  { label: "All Records", isActive: true },
];

export const auditTrailDetail = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Audit Trail", onClick: () => navigate?.(ROUTES.AUDIT_TRAIL) },
  { label: "All Records", onClick: () => navigate?.(ROUTES.AUDIT_TRAIL) },
  { label: "Audit Trail Detail", isActive: true },
];

export const auditTrailReview = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Audit Trail", onClick: () => navigate?.(ROUTES.AUDIT_TRAIL) },
  { label: "Audit Trail Review", isActive: true },
];

export const auditTrailReviewCampaignDetail = (navigate?: NavigateFn, campaignName?: string): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Audit Trail", onClick: () => navigate?.(ROUTES.AUDIT_TRAIL) },
  { label: "Audit Trail Review", onClick: () => navigate?.(ROUTES.AUDIT_TRAIL_REVIEW) },
  { label: campaignName || "Audit Trail Review Campaign", isActive: true },
];

export const report = (navigate?: NavigateFn, subLabel?: string): BreadcrumbItem[] => {
  const items = [dashboard(navigate)];
  if (subLabel) {
    items.push({ label: "Reports & Analytics" });
    items.push({ label: subLabel, isActive: true });
  } else {
    items.push({ label: "Reports & Analytics", isActive: true });
  }
  return items;
};

export const deviations = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Deviations & Nonconformances", isActive: true },
];

export const capa = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "CAPA Management", isActive: true },
];

export const complaints = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Complaints Management", isActive: true },
];

export const supplier = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Supplier Management", isActive: true },
];

export const product = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Product Management", isActive: true },
];

export const regulatory = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Regulatory Management", isActive: true },
];

export const riskManagement = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Risk Management", isActive: true },
];

export const notifications = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Notifications", isActive: true },
];
