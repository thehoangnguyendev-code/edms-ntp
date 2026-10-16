import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

  if (template) return <ReportTemplateRun template={template} onBack={() => navigate("/report/templates")} />;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Create Report"
        breadcrumbItems={reportBreadcrumbs(navigate, "Create Report", false, { label: "Report Library", onClick: () => navigate("/report/templates") })}
        actions={
          <Button size="sm" variant="outline" className="whitespace-nowrap touch-manipulation" onClick={() => navigate("/report/templates")}>
            Back
          </Button>
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
