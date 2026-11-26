import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { dashboard } from "@/components/ui/breadcrumb/breadcrumbs/shared";
import type { BadgeColor } from "@/components/ui/badge/Badge";
import { tr } from "@/i18n";
import { displayDate, displayDateTime } from "@/utils/format";
import { statusColors } from "@/components/ui/badge/statusColors";

/** Translates a label map when it is read, so every screen that uses it shows the active language. */
export function localized<T extends Record<string, string>>(map: T): T {
  return new Proxy(map, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "string" && typeof prop === "string" ? tr(value) : value;
    },
    getOwnPropertyDescriptor(target, prop) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      if (descriptor && typeof descriptor.value === "string") {
        return { ...descriptor, value: tr(descriptor.value) };
      }
      return descriptor;
    },
  });
}

export const STATUS_LABEL: Record<string, string> = localized({
  RESERVED: "Pending Document Approval",
  PLANNED: "Planned",
  PENDING_APPROVAL: "Pending Approval",
  NOTIFIED: "Notified",
  IN_PROGRESS: "In Progress",
  PENDING_QA_CONFIRMATION: "Pending QA Confirmation",
  COMPLETED: "Completed",
  CANCELLED: "Closed - Cancelled",
});
export const STATUS_COLOR = statusColors("RESERVED", "PLANNED", "PENDING_APPROVAL", "NOTIFIED", "IN_PROGRESS", "PENDING_QA_CONFIRMATION", "COMPLETED", "CANCELLED") as Record<string, BadgeColor>;
export const KIND_LABEL: Record<string, string> = localized({
  INITIAL: "Initial Training",
  PERIODIC: "Periodic Training",
  UNPLANNED: "Unplanned Training",
  RETRAINING: "Supplementary Training",
  EXTERNAL: "External Training",
  LEGACY: "Paper Training (Legacy Import)",
});
/** SOP.0003 5.1.2: the two kinds of external training. */
export const EXTERNAL_TYPE_LABEL: Record<string, string> = localized({ ACTIVE: "Active external training", PASSIVE: "Passive external training" });
export const EXTERNAL_TYPE_HINT: Record<string, string> = localized({
  ACTIVE: "From the need of the department: professional work, staff development, customer complaint.",
  PASSIVE: "From a request of the regulator, or an invitation of another company or brand.",
});
export const KIND_REASON_LABEL: Record<string, string> = localized({
  NEW_HIRE: "New hire",
  TRANSFER: "Transfer",
  NEW_SOP: "New SOP",
  SOP_VERSION: "New version of an SOP",
  CAPA: "CAPA",
  AUDIT_FINDING: "Audit finding",
  VISITOR: "Visitor",
  ABSENCE_RETURN: "Return after absence",
  ABSENT_MAKEUP: "Supplementary for absence",
  FAILED_ASSESSMENT: "Not qualified, retraining",
  OTHER: "Other",
});
export const METHOD_LABEL: Record<string, string> = localized({ SELF_READING: "Self-reading", CLASSROOM: "Classroom training", HYBRID: "Hybrid training", PRACTICAL: "Practical training" });
/** The colour of the badge of a training method, of a way of assessment and of a way of delivery, by the code the API sends (a code not listed is grey). */
export const METHOD_COLOR: Record<string, BadgeColor> = { SELF_READING: "violet", CLASSROOM: "blue", HYBRID: "cyan", PRACTICAL: "orange" };
export const ASSESSMENT_COLOR: Record<string, BadgeColor> = { TEST: "indigo", CHECKLIST: "teal", OBSERVATION: "lime", SELF_READING_CONFIRMATION: "pink" };
export const DELIVERY_COLOR: Record<string, BadgeColor> = { ELECTRONIC: "sky", PAPER: "yellow", MIXED: "fuchsia" };
export const ASSESSMENT_LABEL: Record<string, string> = localized({
  TEST: "Essay or multiple-choice test (APD.0009)",
  CHECKLIST: "Checklist test (APD.0009)",
  OBSERVATION: "Observation of actual operations (checklist APD.0009)",
  SELF_READING_CONFIRMATION: "Confirmation by Head of Department (APD.0108)",
});
/** SOP.0003 5.1.2: the way of assessment of each training method. Hybrid shares the cell of Classroom. */
export const ASSESSMENT_BY_METHOD: Record<string, string[]> = {
  SELF_READING: ["SELF_READING_CONFIRMATION"],
  CLASSROOM: ["TEST"],
  HYBRID: ["TEST"],
  PRACTICAL: ["CHECKLIST", "OBSERVATION"],
};
export const PARTICIPANT_STATE_LABEL: Record<string, string> = localized({
  INVITED: "Invited", ATTENDED: "Attended", ONLINE: "Online", ABSENT: "Absent", READ_CONFIRMED: "Read and confirmed",
});
/** How a person takes part in a training (V695): only a trainee takes the assessment. */
export const PARTICIPATION_ROLE_LABEL: Record<string, string> = localized({
  TRAINEE: "Trainee", ATTENDEE: "Attends, no assessment", NAME_ONLY: "Listed only, does not sign",
});
export const PARTICIPATION_ROLE_HELP: Record<string, string> = localized({
  TRAINEE: "Takes part and takes the assessment.",
  ATTENDEE: "Takes part and signs the attendance, but takes no assessment (for example a manager who attends). Written as attended.",
  NAME_ONLY: "Only listed and informed. Does not take the assessment and is not asked to sign. Written as attended.",
});
export const STEP_LABEL: Record<string, string> = localized({
  CONTENT_REVIEW: "Review of content and test",
  CONTENT_APPROVE: "Approval of content and test",
  ACTIVITY_COMPLETE: "QA confirmation of completion",
  MATRIX_APPROVE: "Approval of the training matrix",
  LEGACY_EVIDENCE_VERIFY: "Verification of the training evidence of an imported document",
  TRAINER_EXCEPTION: "Exception for a trainer who is not yet qualified",
  REQUIREMENT_REVIEW: "Review of the training requirement",
  REQUIREMENT_APPROVE: "Approval of the training requirement",
  REVIEW_CLOSE: "Closing of the training review",
});

export const when = (value?: string | null) => (value ? displayDateTime(value) : "—");
/** What the e-signature modal shows before the person signs: the status the record is in now and the status it will be after the signature. */
export const statusChange = (from: string, to: string, action = tr("Update Status")) => [{ action, oldValue: from, newValue: to, category: "status" as const }];

export const day = (value?: string | null) => (value ? displayDate(`${value.slice(0, 10)}T00:00:00`) : "—");

export type TrainingPageKey = "myTasks" | "myRecords" | "activities" | "assessments" | "matrices" | "requirements" | "jobs" | "reviews" | "specimen" | "records" | "compliance" | "documentImpactAssessment" | "numberAllocationLog" | "exports" | "legacy";

/**
 * The name of every page of Training Management, exactly as the menu calls it, and the menu group it sits in. Page titles and breadcrumbs take their text from
 * here and never from a number or a code: the code of a record is shown in the page, not in the title.
 */
const TRAINING_PAGE_ENTRIES: Record<TrainingPageKey, { title: string; group?: string; path: string }> = {
  myTasks: { title: "My Tasks", group: "My Training", path: "/training-management/my-training/tasks" },
  myRecords: { title: "My Records", group: "My Training", path: "/training-management/my-training/records" },
  requirements: { title: "Training Requirements", group: "Training Programme", path: "/training-management/requirements" },
  activities: { title: "Training Activities", group: "Training Programme", path: "/training-management/activities" },
  assessments: { title: "Training Assessments", group: "Training Programme", path: "/training-management/assessments" },
  matrices: { title: "Training Matrix", group: "Training Programme", path: "/training-management/matrix" },
  documentImpactAssessment: { title: "Document Impact Assessment", group: "Training Programme", path: "/training-management/document-impact-assessment" },
  jobs: { title: "Job Assignments", group: "Personnel Qualification", path: "/training-management/job-assignments" },
  reviews: { title: "Training Reviews", group: "Personnel Qualification", path: "/training-management/personnel-reviews" },
  specimen: { title: "Specimen Signatures", group: "Personnel Qualification", path: "/training-management/specimen-signatures" },
  records: { title: "Training Records", group: "Training Records & Compliance", path: "/training-management/records" },
  compliance: { title: "Training Compliance", group: "Training Records & Compliance", path: "/training-management/compliance" },
  numberAllocationLog: { title: "Training Number Allocation Log", group: "Training Records & Compliance", path: "/training-management/number-allocation-log" },
  exports: { title: "Training Record Exports", group: "Training Records & Compliance", path: "/training-management/record-exports" },
  legacy: { title: "Legacy Training Evidence", group: "Training Records & Compliance", path: "/training-management/legacy-evidence" },
};

export const TRAINING_PAGES: Record<TrainingPageKey, { title: string; group?: string; path: string }> = new Proxy(TRAINING_PAGE_ENTRIES, {
  get(target, prop, receiver) {
    const entry = Reflect.get(target, prop, receiver);
    if (!entry || typeof entry !== "object") return entry;
    return { ...entry, title: tr(entry.title), group: entry.group ? tr(entry.group) : undefined };
  },
});

/**
 * Breadcrumb of a page of Training Management: Dashboard, Training Management, the menu group, the page. A page that opens one record adds the name of the
 * page ("Training Activity Details"), with the list before it as a link.
 */
export function trainingBreadcrumbs(navigate: (path: string) => void, page: TrainingPageKey, detailTitle?: string): BreadcrumbItem[] {
  const entry = TRAINING_PAGES[page];
  return [
    dashboard(navigate),
    { label: tr("Training Management") },
    ...(entry.group ? [{ label: entry.group }] : []),
    ...(detailTitle
      ? [{ label: entry.title, onClick: () => navigate(entry.path) }, { label: detailTitle, isActive: true }]
      : [{ label: entry.title, isActive: true }]),
  ];
}

/** A name written in a file name exactly as it is, only without the characters that a file name cannot hold (the department "Quản lý chất lượng" stays so). */
export function fileSafe(name: string) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
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
