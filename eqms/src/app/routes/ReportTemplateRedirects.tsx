import { Navigate, useParams } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";

/**
 * The old addresses of the report templates (/settings/report-configuration/...) lead to the same page in Reports, so a link that was saved or sent still works.
 */
export function LegacyReportTemplateRedirect({ page }: { page: "list" | "edit" | "details" | "revision" }) {
  const { code = "", revision = "" } = useParams();
  const base = ROUTES.REPORT.TEMPLATE_MANAGEMENT;
  const encoded = encodeURIComponent(code);
  const to = page === "list" ? base : page === "edit" ? `${base}/${encoded}` : page === "details" ? `${base}/${encoded}/details` : `${base}/${encoded}/revisions/${encodeURIComponent(revision)}`;
  return <Navigate to={to} replace />;
}

/** A person who only runs reports has no page of revisions: the old address leads to the report itself. */
export function ReportRevisionToLibraryRedirect() {
  const { code = "" } = useParams();
  return <Navigate to={`/report/templates/${encodeURIComponent(code)}`} replace />;
}
