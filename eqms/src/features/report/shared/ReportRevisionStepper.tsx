import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";

/**
 * The steps of a report template revision, shown with the same stepper as the revisions of a document (REPORT-TEMPLATE-REVISION-2026-10-14):
 * Draft, Pending Approval, Effective, Obsoleted; a revision that was discarded ends at Closed - Cancelled.
 */
export const REPORT_REVISION_STEPS = ["Draft", "Pending Approval", "Effective", "Obsoleted", "Closed - Cancelled"] as const;

const STEP_OF_STATUS: Record<string, number> = { DRAFT: 0, PENDING_APPROVAL: 1, APPROVED: 2, EFFECTIVE: 2, OBSOLETE: 3, DISCARDED: 4 };

/** Where a discarded or obsoleted revision stopped before it ended, so the steps before are shown as done. */
const PROGRESS_BEFORE_END: Record<string, string> = { OBSOLETE: "Effective", DISCARDED: "Draft" };

/**
 * `status` is the machine status of the revision (DRAFT, PENDING_APPROVAL, EFFECTIVE, OBSOLETE, DISCARDED). For a template that was never approved the
 * approval status (DRAFT, PENDING_APPROVAL, APPROVED) is understood as well.
 */
export function ReportRevisionStepper({ status }: { status?: string | null }) {
  const key = String(status ?? "DRAFT");
  return <WorkflowStepper steps={REPORT_REVISION_STEPS} currentStepIndex={STEP_OF_STATUS[key] ?? 0} terminalProgressStep={PROGRESS_BEFORE_END[key]} />;
}

/** The status of the revision that matters on a template's screens: the one being written, else the effective one. */
export function latestRevisionStatus(template: {
  openRevision?: number | null;
  openRevisionStatus?: string | null;
  effectiveRevision?: number | null;
  approvalStatus?: string | null;
}): string {
  if (template.openRevision != null && template.openRevisionStatus) return template.openRevisionStatus;
  if (template.effectiveRevision != null) return "EFFECTIVE";
  return template.approvalStatus ?? "DRAFT";
}
