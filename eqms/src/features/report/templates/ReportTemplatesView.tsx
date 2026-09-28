import { useEffect, useMemo, useState } from "react";
import { Eye, FileBarChart, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SearchInput } from "@/components/ui/form/SearchInput";
import { Button } from "@/components/ui/button/Button";
import { reportsApi, type ReportDefinition, type ReportFormat } from "@/services/api/reports";
import { ROUTES } from "@/app/routes.constants";
import { ReportPageSection } from "../shared/ReportPageSection";
import { parseReportFormats } from "../shared/reportUtils";

export function ReportTemplatesView() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<ReportDefinition[]>([]);
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [format, setFormat] = useState<ReportFormat>("CSV");
  const [search, setSearch] = useState("");
  const [previewRows, setPreviewRows] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    reportsApi.catalog()
      .then((items) => {
        if (!current) return;
        setCatalog(items);
        setSelected(items.find((definition) => definition.active) ?? null);
      })
      .catch(() => current && setNotice("Unable to load the report catalog."))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, []);

  const visible = useMemo(() => catalog.filter((definition) =>
    definition.displayName.toLowerCase().includes(search.toLowerCase()) || definition.code.toLowerCase().includes(search.toLowerCase()),
  ), [catalog, search]);

  const fields = selected?.fields?.filter((field) => field.defaultSelected || field.required).map((field) => field.code);
  const preview = async () => {
    if (!selected) return;
    setPreviewing(true);
    try { setPreviewRows((await reportsApi.previewDefinition(selected.code, fields)).rows); }
    catch { setNotice("Report preview could not be loaded."); }
    finally { setPreviewing(false); }
  };
  const generate = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const run = await reportsApi.createRun({ definitionCode: selected.code, format, fields }, crypto.randomUUID());
      setNotice(`Report queued: ${run.id}`);
      navigate(ROUTES.REPORT.HISTORY);
    } catch { setNotice("Report generation could not be queued."); }
    finally { setSubmitting(false); }
  };

  return <ReportPageSection title="Report Templates" sectionTitle="Available report templates" description="Choose an authorized template, preview its scoped data, or queue a new immutable report snapshot." icon={FileBarChart} notice={notice}>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Search</label>
        <SearchInput value={search} onChange={setSearch} placeholder="Search report templates..." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {loading ? <p className="text-sm text-slate-500">Loading catalog...</p> : visible.map((definition) => <button type="button" key={definition.code} onClick={() => { setSelected(definition); setFormat(parseReportFormats(definition.allowedFormats)[0] ?? "CSV"); }} className={`rounded-xl border p-4 text-left transition-colors ${selected?.code === definition.code ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
            <p className="font-semibold text-slate-900">{definition.displayName}</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{definition.description}</p><p className="mt-3 font-mono text-xs text-slate-400">{definition.code}</p>
            {!definition.active && <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Disabled</span>}
          </button>)}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">Generate report</h3>{selected ? <>
        <p className="mt-2 text-sm text-slate-600">{selected.displayName}</p><label className="mt-4 block text-sm font-medium text-slate-700">Format<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>{parseReportFormats(selected.allowedFormats).map((item) => <option key={item}>{item}</option>)}</select></label>
        <p className="mt-4 text-xs text-slate-500">Preview is server-scoped and never creates an official artifact.</p><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!selected.active || previewing} onClick={preview}><Eye className="h-4 w-4" />{previewing ? "Loading..." : "Preview"}</Button><Button size="sm" disabled={!selected.active || submitting} onClick={generate}><Play className="h-4 w-4" />{submitting ? "Queueing..." : "Generate Report"}</Button></div>
      </> : <p className="mt-3 text-sm text-slate-500">Select a report definition.</p>}</div>
    </div>
    {previewRows && <div className="mt-5 overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><p className="text-sm font-semibold text-slate-800">Server-scoped preview</p><Button variant="ghost" size="sm" onClick={() => setPreviewRows(null)}>Close</Button></div><div className="max-h-80 overflow-auto"><table className="w-full min-w-max text-sm"><tbody>{previewRows.map((row, index) => <tr key={index} className="border-b border-slate-100 last:border-b-0">{row.map((cell, cellIndex) => index === 0 ? <th key={cellIndex} className="bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">{cell}</th> : <td key={cellIndex} className="px-3 py-2 text-slate-700">{cell}</td>)}</tr>)}</tbody></table></div></div>}
  </ReportPageSection>;
}
