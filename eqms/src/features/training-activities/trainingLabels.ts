import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { dashboard } from "@/components/ui/breadcrumb/breadcrumbs/shared";

export const STATUS_LABEL: Record<string, string> = {
  RESERVED: "Waiting for approval",
  PLANNED: "Planned",
  NOTIFIED: "Notified",
  IN_PROGRESS: "In progress",
  PENDING_QA_CONFIRMATION: "Waiting for QA confirmation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
export const STATUS_COLOR: Record<string, "emerald" | "amber" | "red" | "slate" | "blue"> = {
  RESERVED: "slate",
  PLANNED: "blue",
  NOTIFIED: "blue",
  IN_PROGRESS: "amber",
  PENDING_QA_CONFIRMATION: "amber",
  COMPLETED: "emerald",
  CANCELLED: "red",
};
export const KIND_LABEL: Record<string, string> = {
  INITIAL: "Initial",
  PERIODIC: "Periodic",
  UNPLANNED: "Unplanned",
  RETRAINING: "Retraining / make-up",
  EXTERNAL: "External",
};
export const KIND_REASON_LABEL: Record<string, string> = {
  NEW_HIRE: "New hire",
  TRANSFER: "Transfer",
  NEW_SOP: "New SOP",
  SOP_VERSION: "New version of an SOP",
  CAPA: "CAPA",
  AUDIT_FINDING: "Audit finding",
  VISITOR: "Visitor",
  ABSENCE_RETURN: "Return after absence",
  ABSENT_MAKEUP: "Make-up for absence",
  FAILED_ASSESSMENT: "Failed assessment",
  OTHER: "Other",
};
export const METHOD_LABEL: Record<string, string> = { SELF_READING: "Self-reading", CLASSROOM: "Classroom training", HYBRID: "Hybrid training", PRACTICAL: "Practical training" };
export const ASSESSMENT_LABEL: Record<string, string> = {
  TEST: "Essay or multiple-choice test (APD.0009)",
  CHECKLIST: "Checklist test (APD.0009)",
  SELF_READING_CONFIRMATION: "Confirmation by Head of Department (APD.0108)",
};
/** SOP.0003 5.1.2: the way of assessment of each training method. Hybrid shares the cell of Classroom. */
export const ASSESSMENT_BY_METHOD: Record<string, string[]> = {
  SELF_READING: ["SELF_READING_CONFIRMATION"],
  CLASSROOM: ["TEST"],
  HYBRID: ["TEST"],
  PRACTICAL: ["CHECKLIST"],
};
export const PARTICIPANT_STATE_LABEL: Record<string, string> = {
  INVITED: "Invited", ATTENDED: "Attended", ONLINE: "Attended online", ABSENT: "Absent", READ_CONFIRMED: "Read and confirmed",
};
export const STEP_LABEL: Record<string, string> = {
  CONTENT_REVIEW: "Review of content and test",
  CONTENT_APPROVE: "Approval of content and test",
  ACTIVITY_COMPLETE: "QA confirmation of completion",
  MATRIX_APPROVE: "Approval of the training matrix",
  LEGACY_EVIDENCE_VERIFY: "Verification of the training evidence of an imported document",
  TRAINER_EXCEPTION: "Exception for a trainer who is not yet qualified",
  REQUIREMENT_REVIEW: "Review of the training requirement",
  REQUIREMENT_APPROVE: "Approval of the training requirement",
};
export const CONFIRMATION_LABEL: Record<string, string> = {
  ATTENDEE_LIST_PREPARED: "Attendee list confirmed",
  TRAINER_ATTENDANCE: "Attendance confirmed by the trainer",
  HEAD_SELF_READING: "Self-reading verified",
  CONTENT_REVIEWED: "Content reviewed",
  CONTENT_APPROVED: "Content approved",
  QA_COMPLETION: "Completion confirmed by QA",
};

export const when = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");
export const day = (value?: string | null) => (value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : "—");

export type TrainingPageKey = "myTraining" | "activities" | "matrices" | "requirements" | "jobs" | "specimen" | "records" | "compliance" | "numberLog" | "exports" | "legacy";

/**
 * The name of every page of Training Management, exactly as the menu calls it, and the menu group it sits in. Page titles and breadcrumbs take their text from
 * here and never from a number or a code: the code of a record is shown in the page, not in the title.
 */
export const TRAINING_PAGES: Record<TrainingPageKey, { title: string; group?: string; path: string }> = {
  myTraining: { title: "My Training", path: "/training-management/my-training" },
  requirements: { title: "Training Requirements", group: "Training Programme", path: "/training-management/requirements" },
  activities: { title: "Training Activities", group: "Training Programme", path: "/training-management/activities" },
  matrices: { title: "Training Matrices", group: "Training Programme", path: "/training-management/matrices" },
  jobs: { title: "Job Assignments", group: "Personnel Qualification", path: "/training-management/job-assignments" },
  specimen: { title: "Specimen Signatures", group: "Personnel Qualification", path: "/training-management/specimen-signatures" },
  records: { title: "Training Records", group: "Training Records & Compliance", path: "/training-management/records" },
  compliance: { title: "Training Compliance", group: "Training Records & Compliance", path: "/training-management/compliance" },
  numberLog: { title: "Training Number Register", group: "Training Records & Compliance", path: "/training-management/number-log" },
  exports: { title: "Training Record Exports", group: "Training Records & Compliance", path: "/training-management/record-exports" },
  legacy: { title: "Legacy Training Evidence", group: "Training Records & Compliance", path: "/training-management/legacy-evidence" },
};

/**
 * Breadcrumb of a page of Training Management: Dashboard, Training Management, the menu group, the page. A page that opens one record adds the name of the
 * page ("Training Activity Details"), with the list before it as a link.
 */
export function trainingBreadcrumbs(navigate: (path: string) => void, page: TrainingPageKey, detailTitle?: string): BreadcrumbItem[] {
  const entry = TRAINING_PAGES[page];
  return [
    dashboard(navigate),
    { label: "Training Management" },
    ...(entry.group ? [{ label: entry.group }] : []),
    ...(detailTitle
      ? [{ label: entry.title, onClick: () => navigate(entry.path) }, { label: detailTitle, isActive: true }]
      : [{ label: entry.title, isActive: true }]),
  ];
}

/** Hands a downloaded file to the browser. */
export function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
