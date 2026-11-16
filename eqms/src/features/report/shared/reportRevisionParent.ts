import { ROUTES } from "@/app/routes.constants";

export interface ReportParent {
  label: string;
  onClick: () => void;
}

/** The pages from which a revision page is opened, with the name of the menu entry or page that names them in the breadcrumb. */
const LISTS: { path: string; label: string }[] = [
  { path: ROUTES.REPORT.TEMPLATE_REVISIONS_PENDING, label: "Pending My Approval" },
  { path: ROUTES.REPORT.TEMPLATE_REVISIONS, label: "All Revisions" },
  { path: ROUTES.REPORT.TEMPLATE_MANAGEMENT, label: "Report Templates" },
];
const DETAILS_PAGE = new RegExp(`^${ROUTES.REPORT.TEMPLATE_MANAGEMENT}/[^/]+/details$`);

/** Where a page of a revision was opened from: carried in the navigation state (`from`, the address of the page), as the pages of Document Control revisions do. */
export const comingFrom = (path: string) => ({ state: { from: path } });

/**
 * The parent of a page of a revision in the breadcrumb, and where Back leads: the list or page the person came from (All Revisions, Pending My Approval,
 * Report Templates, or the details page of the template), or `fallback` (one of the list addresses) when the page was opened by its address, for example from
 * a notification (REPORT-REVISION-TITLES-2026-11-15).
 */
export function reportRevisionParent(from: string | undefined, navigate: (path: string) => void, fallback: string): ReportParent {
  const path = (from ?? "").split("?")[0].replace(/\/$/, "");
  const list = LISTS.find((entry) => entry.path === path);
  if (list) return { label: list.label, onClick: () => navigate(list.path) };
  if (DETAILS_PAGE.test(path)) return { label: "Report Template Details", onClick: () => navigate(path) };
  const chosen = LISTS.find((entry) => entry.path === fallback) ?? LISTS[1];
  return { label: chosen.label, onClick: () => navigate(chosen.path) };
}
