import React from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { DataTable } from "@/components/ui/table";
import { Card, CardHeader, KpiStrip } from "@/features/self-service/dashboard/shared/dashboardUi";
import { ActivityBarChart } from "@/features/self-service/dashboard/shared/ActivityBarChart";
import { BRAND_PRIMARY_HEX } from "@/styles/tokens";
import { ReportAnalyticsPage } from "./ReportAnalyticsPage";
import { SAMPLE_BY_TYPE, SAMPLE_DC_KPIS, SAMPLE_REVISIONS_BY_STAGE, SAMPLE_RUNS_PER_WEEK } from "./sampleData";

const SAMPLE_BADGE = (
  <Badge color="blue" size="sm">
    Sample
  </Badge>
);

const EFFECTIVE_BY_TYPE = SAMPLE_BY_TYPE.map((row) => ({ label: row.type, value: row.effective }));

export const ReportAnalyticsView: React.FC = () => (
  <ReportAnalyticsPage title="Quality Analytics">
    <KpiStrip
      label="Document Control indicators"
      cells={SAMPLE_DC_KPIS.map((k) => ({ title: k.title, accent: k.accent, value: k.value, footValue: k.foot, footLabel: k.footLabel }))}
    />
    <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
      <Card aria-label="Effective documents by type" role="region">
        <CardHeader title="Effective documents by type" subtitle="Document Control" badge={SAMPLE_BADGE} />
        <ActivityBarChart data={EFFECTIVE_BY_TYPE} color={BRAND_PRIMARY_HEX} valueLabel="Documents" showValues />
      </Card>
      <Card aria-label="Revisions in progress by stage" role="region">
        <CardHeader title="Revisions in progress by stage" subtitle="Revision workflow" badge={SAMPLE_BADGE} />
        <ActivityBarChart data={SAMPLE_REVISIONS_BY_STAGE} color={BRAND_PRIMARY_HEX} valueLabel="Revisions" showValues />
      </Card>
      <Card aria-label="Report runs per week" role="region" className="xl:col-span-2">
        <CardHeader title="Report runs per week" subtitle="Platform usage, last 6 weeks" badge={SAMPLE_BADGE} />
        <ActivityBarChart data={SAMPLE_RUNS_PER_WEEK} color={BRAND_PRIMARY_HEX} valueLabel="Runs" showValues />
      </Card>
    </div>
    <Card aria-label="Table view" role="region">
      <CardHeader title="Table view" subtitle="The same figures as the charts, for reading and printing" />
      <div className="px-4 pb-4 pt-3">
        <DataTable
          rows={SAMPLE_BY_TYPE}
          getRowKey={(row) => row.type}
          columns={[
            { id: "type", header: "Document type", cell: (row) => <span className="font-medium text-slate-900">{row.type}</span> },
            { id: "effective", header: "Effective", cell: (row) => row.effective },
            { id: "inRevision", header: "In revision", cell: (row) => row.inRevision },
            { id: "reviewDue", header: "Review due", cell: (row) => row.reviewDue },
          ]}
        />
      </div>
    </Card>
  </ReportAnalyticsPage>
);
