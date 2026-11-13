import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Pause, Pin, PinOff } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DataTable } from "@/components/ui/table";
import { cn } from "@/components/ui/utils";
import { ROUTES } from "@/app/routes.constants";
import { Card, CardHeader } from "@/features/self-service/dashboard/shared/dashboardUi";
import { useToast } from "@/components/ui/toast/Toast";
import { reportsApi, type ReportAttentionItem, type ReportRunSummary } from "@/services/api/reports";
import { codeLabel, runStatusLabel } from "@/features/report/shared/reportLabels";
import { displayDateTime } from "@/utils/format";
import { ReportAnalyticsPage } from "./ReportAnalyticsPage";
import { SectionBody } from "./SectionBody";
import { useSection } from "./useSection";

const TONE = {
  red: { box: "border-red-100 bg-red-50/60", icon: "text-red-600", Icon: AlertOctagon },
  amber: { box: "border-amber-100 bg-amber-50/60", icon: "text-amber-600", Icon: AlertTriangle },
  emerald: { box: "border-emerald-100 bg-emerald-50/60", icon: "text-emerald-600", Icon: CheckCircle2 },
  blue: { box: "border-blue-100 bg-blue-50/60", icon: "text-blue-600", Icon: Info },
} as const;

const RUN_COLOR = (status: string) => (status === "COMPLETED" ? "emerald" : status === "FAILED" ? "red" : "slate");

/**
 * Reports Overview: what needs attention, the reports the person pinned, the next scheduled runs and the latest runs. Every list is read from the server when the page opens; nothing on it is
 * a sample. A list that cannot be read says so and can be retried.
 */
export const ReportOverviewView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const attention = useSection(() => reportsApi.overview());
  const pins = useSection(() => reportsApi.listPins());
  const schedules = useSection(() => reportsApi.searchSchedules({ search: "", status: "", page: 1, sortBy: "nextRunAt", direction: "asc" }));
  const runs = useSection(() => reportsApi.listRuns({ page: 1, limit: 5, sortBy: "queuedAt", sortDirection: "desc" }));
  const [busyPin, setBusyPin] = useState<string | null>(null);

  const unpin = async (code: string) => {
    setBusyPin(code);
    try {
      await reportsApi.unpinReport(code);
      pins.reload();
    } catch {
      showToast({ type: "error", message: "The report could not be unpinned." });
    } finally {
      setBusyPin(null);
    }
  };

  return (
    <ReportAnalyticsPage
      title="Reports Overview"
      actions={
        <Button size="sm" variant="outline-emerald" onClick={() => navigate(ROUTES.REPORT.TEMPLATES)} className="whitespace-nowrap">
          Open Report Library
        </Button>
      }
    >
      <Card aria-label="Needs your attention" role="region">
        <CardHeader title="Needs your attention" subtitle="Your runs and schedules" />
        <SectionBody state={attention.state} reload={attention.reload}>
          {(data) =>
            data.attention.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Nothing needs your attention.</p>
            ) : (
              <ul className="space-y-2 px-4 pb-4 pt-3">
                {data.attention.map((item: ReportAttentionItem) => {
                  const tone = TONE[item.tone];
                  return (
                    <li key={item.code}>
                      <button
                        type="button"
                        onClick={() => navigate(item.path)}
                        className={cn("flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:brightness-95", tone.box)}
                      >
                        <tone.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.icon)} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-900">{item.title}</span>
                          <span className="mt-0.5 block text-xs text-slate-600">{item.detail}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          }
        </SectionBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
        <Card aria-label="Pinned reports" role="region">
          <CardHeader title="Pinned reports" subtitle="Run again in one click" />
          <SectionBody state={pins.state} reload={pins.reload}>
            {(list) =>
              list.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No pinned report. Pin one from the Report Library.</p>
              ) : (
                <ul className="divide-y divide-slate-100 px-4 pb-2 pt-2">
                  {list.map((pin) => (
                    <li key={pin.code} className="flex items-center justify-between gap-2 py-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-sm text-slate-900">
                        <Pin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate" title={pin.name}>
                          {pin.name}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Button size="sm" variant="outline" disabled={!pin.active} onClick={() => navigate(`/report/templates/${encodeURIComponent(pin.code)}/run`)}>
                          Run
                        </Button>
                        <button
                          type="button"
                          aria-label={`Unpin ${pin.name}`}
                          disabled={busyPin === pin.code}
                          onClick={() => void unpin(pin.code)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <PinOff className="h-4 w-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )
            }
          </SectionBody>
        </Card>

        <Card aria-label="Upcoming schedules" role="region" className="xl:col-span-2">
          <CardHeader title="Upcoming schedules" subtitle="Next run of each scheduled report" />
          <SectionBody state={schedules.state} reload={schedules.reload} deniedText="You do not have access to scheduled reports.">
            {(page) =>
              page.data.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No scheduled report.</p>
              ) : (
                <ul className="divide-y divide-slate-100 px-4 pb-2 pt-2">
                  {page.data.slice(0, 5).map((schedule) => (
                    <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <button type="button" className="min-w-0 text-left" onClick={() => navigate(`/report/scheduled/${schedule.id}`)}>
                        <span className="block truncate text-sm font-medium text-slate-900">{schedule.name}</span>
                        <span className="block text-xs text-slate-500">
                          {schedule.format} · {schedule.definitionCode}
                        </span>
                      </button>
                      {schedule.active ? (
                        <span className="text-xs tabular-nums text-slate-600">Next {schedule.nextRunAt ? displayDateTime(schedule.nextRunAt) : "—"}</span>
                      ) : (
                        <Badge color="amber" size="sm" icon={<Pause className="h-3 w-3" />}>
                          {codeLabel(schedule.status)}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )
            }
          </SectionBody>
        </Card>
      </div>

      <Card aria-label="Recent runs" role="region">
        <CardHeader
          title="Recent runs"
          subtitle="Open a run to see its evidence record"
          right={
            <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.REPORT.HISTORY)}>
              All runs
            </Button>
          }
        />
        <SectionBody state={runs.state} reload={runs.reload}>
          {(page) =>
            page.data.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No run yet.</p>
            ) : (
              <div className="px-4 pb-4 pt-3">
                <DataTable
                  rows={page.data}
                  getRowKey={(row: ReportRunSummary) => row.id}
                  onRowClick={(row: ReportRunSummary) => navigate(`/report/runs/${row.id}`)}
                  columns={[
                    { id: "report", header: "Report", cell: (row: ReportRunSummary) => <span className="font-medium text-slate-900">{row.reportTitle || row.definitionCode}</span> },
                    { id: "template", header: "Template", cell: (row: ReportRunSummary) => row.definitionCode },
                    { id: "type", header: "Run type", cell: (row: ReportRunSummary) => (row.fullRun ? <Badge color="blue" size="sm">Full</Badge> : "Filtered") },
                    { id: "queued", header: "Queued", cell: (row: ReportRunSummary) => displayDateTime(row.queuedAt) },
                    {
                      id: "status",
                      header: "Status",
                      cell: (row: ReportRunSummary) => (
                        <Badge color={RUN_COLOR(row.status)} size="sm">
                          {runStatusLabel(row.status)}
                        </Badge>
                      ),
                    },
                  ]}
                />
              </div>
            )
          }
        </SectionBody>
      </Card>
    </ReportAnalyticsPage>
  );
};
