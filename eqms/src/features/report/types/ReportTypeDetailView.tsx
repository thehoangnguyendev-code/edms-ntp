import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { reportError } from "@/services/api/reportTemplates";
import { reportTypesApi, type ReportTypeDetail } from "@/services/api/reportTypes";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { ReportTypeColumnsPanel } from "./ReportTypeColumnsPanel";

const Item: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
    <div className="text-sm text-slate-800 break-words">{children}</div>
  </div>
);

/** One Report Type: what it reports on, who may use it, its columns and filters. Read only; Enable and Disable are in the list. */
export const ReportTypeDetailView: React.FC = () => {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const [detail, setDetail] = React.useState<ReportTypeDetail | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    reportTypesApi
      .detail(code)
      .then(setDetail)
      .catch((e) => setError(reportError(e)))
      .finally(() => setLoading(false));
  }, [code]);
  React.useEffect(load, [load]);

  const title = detail?.name ?? "Report Type";
  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title={title}
        breadcrumbItems={reportBreadcrumbs(navigate, title, true, { label: "Report Types", onClick: () => navigate("/settings/report-types") })}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("/settings/report-types")}>
            Back
          </Button>
        }
      />
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <SectionLoading text="Loading report type..." />
        </div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
          <p role="alert" className="text-sm font-medium text-amber-800">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </div>
      )}
      {!loading && !error && detail && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Item label="Name">{detail.name}</Item>
            <Item label="Code"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{detail.code}</code></Item>
            <Item label="Category">{detail.category}</Item>
            <Item label="Status">{detail.enabled ? <Badge color="emerald" size="sm">Enabled</Badge> : <Badge color="slate" size="sm">Disabled</Badge>}</Item>
            <div className="sm:col-span-2 lg:col-span-4">
              <Item label="Description">{detail.description || "-"}</Item>
            </div>
            <Item label="Report templates">{detail.templateCount}</Item>
            <Item label="Needs the permission">
              {detail.usePermissions.length === 0 && detail.requiredPermissions.length === 0 ? (
                "None of its own: the scope of each template decides what is shown."
              ) : (
                <>
                  {detail.requiredPermissions.length > 0 && <span className="mr-1">All of:</span>}
                  {detail.requiredPermissions.map((p) => <code key={p} className="mr-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{p}</code>)}
                  {detail.usePermissions.length > 0 && <span className="mr-1">One of:</span>}
                  {detail.usePermissions.map((p) => <code key={p} className="mr-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{p}</code>)}
                </>
              )}
            </Item>
          </div>
          <ReportTypeColumnsPanel detail={detail} />
        </div>
      )}
    </div>
  );
};
