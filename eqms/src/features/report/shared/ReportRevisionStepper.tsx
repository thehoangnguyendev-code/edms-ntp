import { WorkflowProgressStepper } from "@/components/ui/workflow-stepper/WorkflowProgressStepper";
import { useServerWorkflow } from "@/components/ui/workflow-stepper/useServerWorkflow";
import { reportTemplatesApi } from "@/services/api/reportTemplates";
import type { WorkflowProgress } from "@/types/document";

/**
 * The steps of a report template revision, shown with the same stepper as the revisions of a document (REPORT-TEMPLATE-REVISION-2026-10-14).
 * The server works the stepper out (the steps, the step of the revision, where an ended revision stood); this only draws it.
 * `isNew`: the template is being created and has no record yet, so the stepper of a new template is asked from the server.
 */
export function ReportRevisionStepper({ workflow, isNew = false }: { workflow?: WorkflowProgress | null; isNew?: boolean }) {
  const fresh = useServerWorkflow(isNew ? "report:TEMPLATE" : null, reportTemplatesApi.newWorkflow);
  return <WorkflowProgressStepper workflow={isNew ? fresh : workflow} />;
}
