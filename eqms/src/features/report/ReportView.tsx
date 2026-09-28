import { ReportHistoryView } from "./history/ReportHistoryView";
import { ScheduledReportsView } from "./scheduled/ScheduledReportsView";
import { ReportTemplatesView } from "./templates/ReportTemplatesView";

export type ReportSection = "templates" | "history" | "scheduled";

/** Compatibility facade for callers that still select a report section programmatically. */
export function ReportView({ section }: { section: ReportSection }) {
  switch (section) {
    case "history":
      return <ReportHistoryView />;
    case "scheduled":
      return <ScheduledReportsView />;
    default:
      return <ReportTemplatesView />;
  }
}

export { ReportTemplatesView, ReportHistoryView, ScheduledReportsView };
