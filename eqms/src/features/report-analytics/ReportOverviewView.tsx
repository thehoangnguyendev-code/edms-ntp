import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Pause, Pin } from "lucide-react";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DataTable } from "@/components/ui/table";
import { cn } from "@/components/ui/utils";
import { ROUTES } from "@/app/routes.constants";
import { Card, CardHeader } from "@/features/self-service/dashboard/shared/dashboardUi";
import { ReportAnalyticsPage } from "./ReportAnalyticsPage";
import { SAMPLE_PINNED, SAMPLE_RUNS, SAMPLE_SCHEDULES, SAMPLE_TODOS, type SampleRun } from "./sampleData";

const TONE = {
  red: { box: "border-red-100 bg-red-50/60", icon: "text-red-600", Icon: AlertOctagon },
  amber: { box: "border-amber-100 bg-amber-50/60", icon: "text-amber-600", Icon: AlertTriangle },
  emerald: { box: "border-emerald-100 bg-emerald-50/60", icon: "text-emerald-600", Icon: CheckCircle2 },
  blue: { box: "border-blue-100 bg-blue-50/60", icon: "text-blue-600", Icon: Info },
} as const;

export const RUN_STATUS: Record<SampleRun["status"], { label: string; color: BadgeColor }> = {
  READY: { label: "Ready", color: "emerald" },
  RUNNING: { label: "Running", color: "blue" },
  FAILED: { label: "Failed", color: "red" },
  EXPIRED: { label: "Expired", color: "slate" },
};

export const ReportOverviewView: React.FC = () => {
  const navigate = useNavigate();
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
        <CardHeader title="Needs your attention" subtitle="Your runs, files and schedules" />
        <ul className="space-y-2 px-4 pb-4 pt-3">
          {SAMPLE_TODOS.map((item) => {
            const tone = TONE[item.tone];
            return (
              <li key={item.id} className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5", tone.box)}>
                <tone.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.icon)} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
        <Card aria-label="Pinned reports" role="region">
          <CardHeader title="Pinned reports" subtitle="Run again in one click" />
          <ul className="divide-y divide-slate-100 px-4 pb-2 pt-2">
            {SAMPLE_PINNED.map((name) => (
              <li key={name} className="flex items-center justify-between gap-2 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm text-slate-900">
                  <Pin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate">{name}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.REPORT.TEMPLATES)}>
                  Run
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card aria-label="Upcoming schedules" role="region" className="xl:col-span-2">
          <CardHeader title="Upcoming schedules" subtitle="Next run of each scheduled report" />
          <ul className="divide-y divide-slate-100 px-4 pb-2 pt-2">
            {SAMPLE_SCHEDULES.map((schedule) => (
              <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{schedule.report}</p>
                  <p className="text-xs text-slate-500">
                    {schedule.cadence} · {schedule.recipients} recipients
                  </p>
                </div>
                {schedule.suspended ? (
                  <Badge color="amber" size="sm" icon={<Pause className="h-3 w-3" />}>
                    Suspended: {schedule.suspended}
                  </Badge>
                ) : (
                  <span className="text-xs tabular-nums text-slate-600">Next {schedule.nextRun}</span>
                )}
              </li>
            ))}
          </ul>
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
        <div className="px-4 pb-4 pt-3">
          <DataTable
            rows={SAMPLE_RUNS}
            getRowKey={(row) => row.id}
            onRowClick={() => navigate(ROUTES.REPORT.RUN_PREVIEW)}
            columns={[
              { id: "id", header: "Run", cell: (row) => <span className="font-medium text-slate-900">{row.id}</span> },
              { id: "report", header: "Report", cell: (row) => row.report },
              { id: "class", header: "Classification", cell: (row) => row.classification },
              { id: "format", header: "Format", cell: (row) => row.format },
              { id: "at", header: "Run at", cell: (row) => row.ranAt },
              {
                id: "status",
                header: "Status",
                cell: (row) => (
                  <Badge color={RUN_STATUS[row.status].color} size="sm">
                    {RUN_STATUS[row.status].label}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
      </Card>
    </ReportAnalyticsPage>
  );
};
