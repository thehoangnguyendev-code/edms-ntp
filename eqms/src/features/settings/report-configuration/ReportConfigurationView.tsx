import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { reportsApi, type ReportDefinition } from "@/services/api/reports";
import { TableMarkup } from "@/components/ui/table/TablePrimitives";

export function ReportConfigurationView() {
  const navigate = useNavigate();
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let alive = true; reportsApi.listDefinitions().then(data => { if (alive) setDefinitions(data); }).catch(() => alive && setError("Unable to load report definitions.")).finally(() => alive && setLoading(false)); return () => { alive = false; }; }, []);
  return <div className="flex min-h-0 flex-1 flex-col gap-5">
    <PageHeader title="Report Configuration" breadcrumbItems={[{ label: "Application Settings", onClick: () => navigate("/settings/dictionaries") }, { label: "Report Configuration" }]} />
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-base font-semibold text-slate-900">Report Definitions</h2><p className="mt-1 text-sm text-slate-500">Control regulated report metadata, fields, scope and retention. Query logic remains code-managed.</p></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Loading definitions…</p> : error ? <p className="p-5 text-sm text-red-600">{error}</p> : <div className="overflow-x-auto"><TableMarkup.Root className="w-full min-w-[760px] text-sm"><TableMarkup.Head className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><TableMarkup.Row><TableMarkup.HeaderCell className="px-5 py-3">Definition</TableMarkup.HeaderCell><TableMarkup.HeaderCell className="px-5 py-3">Category</TableMarkup.HeaderCell><TableMarkup.HeaderCell className="px-5 py-3">Classification</TableMarkup.HeaderCell><TableMarkup.HeaderCell className="px-5 py-3">Version</TableMarkup.HeaderCell><TableMarkup.HeaderCell className="px-5 py-3">Status</TableMarkup.HeaderCell><TableMarkup.HeaderCell className="px-5 py-3 text-right">Action</TableMarkup.HeaderCell></TableMarkup.Row></TableMarkup.Head><TableMarkup.Body>{definitions.map(definition => <TableMarkup.Row key={definition.code} className="border-t border-slate-100"><TableMarkup.Cell className="px-5 py-4"><p className="font-medium text-slate-900">{definition.displayName}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{definition.code}</p></TableMarkup.Cell><TableMarkup.Cell className="px-5 py-4">{definition.category}</TableMarkup.Cell><TableMarkup.Cell className="px-5 py-4">{definition.classification}</TableMarkup.Cell><TableMarkup.Cell className="px-5 py-4">v{definition.definitionVersion}</TableMarkup.Cell><TableMarkup.Cell className="px-5 py-4"><span className={definition.active ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"}>{definition.active ? "Active" : "Disabled"}</span></TableMarkup.Cell><TableMarkup.Cell className="px-5 py-4 text-right"><Button variant="outline" size="sm" onClick={() => navigate(`/settings/report-configuration/${definition.code}`)}>Edit</Button></TableMarkup.Cell></TableMarkup.Row>)}</TableMarkup.Body></TableMarkup.Root></div>}
    </section>
  </div>;
}
