import { navigateBack } from "@/app/navigation/backNavigation";
import { tr } from "@/i18n";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { ReportTemplateRun } from "./ReportTemplateRun";
import { reportTemplatesApi, reportError, type ReportTemplate } from "@/services/api/reportTemplates";

/** Create a report from a template, on a page of its own (/report/templates/:code/run). The wizard itself is ReportTemplateRun. */
export function ReportTemplateRunPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?filter.<code>=<value> starts the wizard with that filter filled in
  const initialFilters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith("filter.") && value) initialFilters[key.slice("filter.".length)] = value;
  });
  const [template, setTemplate] = useState<ReportTemplate>();
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    reportTemplatesApi
      .list({ search: code, page: 1, sortBy: "displayName", direction: "asc" }, false)
      .then((page) => {
        const found = page.data.find((item) => item.code === code);
        if (!alive) return;
        if (found) setTemplate(found);
        else setError("This report template is not available to you.");
      })
      .catch((e) => alive && setError(reportError(e)));
    return () => {
      alive = false;
    };
  }, [code]);

  if (template) return <ReportTemplateRun template={template} initialFilters={initialFilters} onBack={() => navigateBack(navigate, null, "/report/templates")} />;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={tr("Create Report")}
        breadcrumbItems={reportBreadcrumbs(navigate, "Create Report", false, { label: tr("Report Library"), onClick: () => navigate("/report/templates") })}
        actions={
          <Button size="sm" variant="outline" className="whitespace-nowrap touch-manipulation" onClick={() => navigateBack(navigate, null, "/report/templates")}>
            {tr("Back")}</Button>
        }
      />
      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <SectionLoading text="Loading report template…" />
      )}
    </div>
  );
}
