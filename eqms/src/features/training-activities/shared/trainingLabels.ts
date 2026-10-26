import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { dashboard } from "@/components/ui/breadcrumb/breadcrumbs/shared";
import { displayDate, displayDateTime } from "@/utils/format";

export const STATUS_LABEL: Record<string, string> = {
  RESERVED: "Pending Document Approval",
  PLANNED: "Planned",
  NOTIFIED: "Notified",
  IN_PROGRESS: "In progress",
  PENDING_QA_CONFIRMATION: "Pending QA Confirmation",
  COMPLETED: "Completed",
  CANCELLED: "Closed - Cancelled",
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
  INITIAL: "Initial Training",
  PERIODIC: "Periodic Training",
  UNPLANNED: "Unplanned Training",
  RETRAINING: "Supplementary Training",
  EXTERNAL: "External Training",
};
/** SOP.0003 5.1.2: the two kinds of external training. */
export const EXTERNAL_TYPE_LABEL: Record<string, string> = { ACTIVE: "Active external training", PASSIVE: "Passive external training" };
export const EXTERNAL_TYPE_HINT: Record<string, string> = {
  ACTIVE: "From the need of the department: professional work, staff development, customer complaint.",
  PASSIVE: "From a request of the regulator, or an invitation of another company or brand.",
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
  ABSENT_MAKEUP: "Supplementary for absence",
  FAILED_ASSESSMENT: "Failed assessment",
  OTHER: "Other",
};
export const METHOD_LABEL: Record<string, string> = { SELF_READING: "Self-reading", CLASSROOM: "Classroom training", HYBRID: "Hybrid training", PRACTICAL: "Practical training" };
export const ASSESSMENT_LABEL: Record<string, string> = {
  TEST: "Essay or multiple-choice test (APD.0009)",
  CHECKLIST: "Checklist test (APD.0009)",
  OBSERVATION: "Observation of actual operations (checklist APD.0009)",
  SELF_READING_CONFIRMATION: "Confirmation by Head of Department (APD.0108)",
};
/** SOP.0003 5.1.2: the way of assessment of each training method. Hybrid shares the cell of Classroom. */
export const ASSESSMENT_BY_METHOD: Record<string, string[]> = {
  SELF_READING: ["SELF_READING_CONFIRMATION"],
  CLASSROOM: ["TEST"],
  HYBRID: ["TEST"],
  PRACTICAL: ["CHECKLIST", "OBSERVATION"],
};
export const PARTICIPANT_STATE_LABEL: Record<string, string> = {
  INVITED: "Invited", ATTENDED: "Attended", ONLINE: "Online", ABSENT: "Absent", READ_CONFIRMED: "Read and confirmed",
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

export const when = (value?: string | null) => (value ? displayDateTime(value) : "—");
/** What the e-signature modal shows before the person signs: the status the record is in now and the status it will be after the signature. */
export const statusChange = (from: string, to: string, action = "Update Status") => [{ action, oldValue: from, newValue: to, category: "status" as const }];

export const day = (value?: string | null) => (value ? displayDate(`${value.slice(0, 10)}T00:00:00`) : "—");

export type TrainingPageKey = "myTraining" | "activities" | "assessments" | "matrices" | "requirements" | "jobs" | "reviews" | "specimen" | "records" | "compliance" | "documentTrainings" | "numberLog" | "exports" | "legacy";

/**
 * The name of every page of Training Management, exactly as the menu calls it, and the menu group it sits in. Page titles and breadcrumbs take their text from
 * here and never from a number or a code: the code of a record is shown in the page, not in the title.
 */
export const TRAINING_PAGES: Record<TrainingPageKey, { title: string; group?: string; path: string }> = {
  myTraining: { title: "My Training", path: "/training-management/my-training" },
  requirements: { title: "Training Requirements", group: "Training Programme", path: "/training-management/requirements" },
  activities: { title: "Training Activities", group: "Training Programme", path: "/training-management/activities" },
  assessments: { title: "Training Assessments", group: "Training Programme", path: "/training-management/assessments" },
  matrices: { title: "Training Matrix", group: "Training Programme", path: "/training-management/matrix" },
  documentTrainings: { title: "Document Trainings", group: "Training Programme", path: "/training-management/document-trainings" },
  jobs: { title: "Job Assignments", group: "Personnel Qualification", path: "/training-management/job-assignments" },
  reviews: { title: "Training Reviews", group: "Personnel Qualification", path: "/training-management/personnel-reviews" },
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
