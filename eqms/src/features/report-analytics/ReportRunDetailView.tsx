import React from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileText, Gavel, ListChecks, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form/FormSection";
import { useToast } from "@/components/ui/toast/Toast";
import { ROUTES } from "@/app/routes.constants";
import { dashboard } from "@/components/ui/breadcrumb/breadcrumbs/shared";
import { ReportAnalyticsPage } from "./ReportAnalyticsPage";
import { SAMPLE_RUN_DETAIL as RUN } from "./sampleData";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-2xs md:text-xs text-slate-500">{label}</dt>
    <dd className="mt-0.5 break-words text-xs sm:text-sm font-medium text-slate-900">{children}</dd>
  </div>
);

/** Evidence record of one report run: who ran what, on which data and definition, and the stored file with its checksum. */
export const ReportRunDetailView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const preview = (title: string) => () => showToast({ type: "info", title, message: "Design preview: nothing was sent to a server." });

  return (
    <ReportAnalyticsPage
      title={RUN.id}
      breadcrumbItems={(nav) => [
        dashboard(nav),
        { label: "Reports & Analytics" },
        { label: "Report Run History", onClick: () => nav(ROUTES.REPORT.HISTORY) },
        { label: RUN.id, isActive: true },
      ]}
      actions={
        <>
          <Button size="sm" variant="outline" onClick={preview("Run again")} className="gap-2 whitespace-nowrap">
            <RotateCcw className="h-4 w-4" /> Run again
          </Button>
          <Button size="sm" variant="outline-emerald" onClick={preview("Download")} className="gap-2 whitespace-nowrap">
            <Download className="h-4 w-4" /> Download
          </Button>
        </>
      }
    >
      <div className="space-y-4 md:space-y-6">
        <FormSection
          title="Identity"
          icon={<FileText className="h-4 w-4" />}
          description="A run is never edited. Running again creates a new run with its own number."
          headerRight={
            <Badge color="emerald" size="sm">
              Ready
            </Badge>
          }
        >
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Report">{RUN.report}</Field>
            <Field label="Classification">{RUN.classification}</Field>
            <Field label="Definition / layout version">{RUN.definitionVersion} / {RUN.layoutVersion}</Field>
            <Field label="Run by">{RUN.ranBy}</Field>
            <Field label="Run at">{RUN.ranAt}</Field>
            <Field label="Data as of">{RUN.dataAsOf}</Field>
            <Field label="Purpose">{RUN.reason}</Field>
          </dl>
        </FormSection>

        <FormSection title="Parameters" icon={<SlidersHorizontal className="h-4 w-4" />} description="Exactly what was chosen when the run started. Read only.">
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {RUN.parameters.map((p) => (
              <Field key={p.label} label={p.label}>
                {p.value}
              </Field>
            ))}
          </dl>
        </FormSection>

        <FormSection title="Output File" icon={<Gavel className="h-4 w-4" />} description="The checksum is checked again on every download.">
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="File">{RUN.file.name}</Field>
            <Field label="Size">{RUN.file.size}</Field>
            <Field label="Kept until">{RUN.file.expires}</Field>
            <div className="md:col-span-3">
              <Field label="SHA-256">
                <span className="font-mono text-xs break-all">{RUN.file.sha256}</span>
              </Field>
            </div>
            <Field label="Legal hold">{RUN.file.hold ? "On" : "None"}</Field>
          </dl>
          <div className="mt-4">
            <Button size="sm" variant="outline" onClick={preview("Legal hold")} className="gap-2">
              <Gavel className="h-4 w-4" /> Place legal hold
            </Button>
          </div>
        </FormSection>

        <FormSection title="Timeline" icon={<ListChecks className="h-4 w-4" />}>
          <ol className="space-y-2">
            {RUN.events.map((event) => (
              <li key={event.at} className="flex gap-3 text-xs sm:text-sm">
                <span className="w-20 shrink-0 tabular-nums text-slate-500">{event.at}</span>
                <span className="text-slate-900">{event.text}</span>
              </li>
            ))}
          </ol>
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => navigate(ROUTES.REPORT.HISTORY)}>
            Back to Report Runs
          </Button>
        </FormSection>
      </div>
    </ReportAnalyticsPage>
  );
};
