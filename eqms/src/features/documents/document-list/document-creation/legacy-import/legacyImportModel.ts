import type { SelectOption } from "@/components/ui/select/Select";
import type { LegacyImportTabId } from "../legacy-import-tabs/LegacyImportTabNavigation";
import { emptyLegacyTrainingEvidence, type LegacyTrainingEvidenceValue } from "../legacy-import-tabs/LegacyTrainingEvidence";

// The middle Revision workflow steps never run for Legacy Import -- every historical revision was
// already reviewed/approved outside the system.
export const SKIPPED_STEPS = [
  "Pending Review",
  "Pending Approval",
  "Pending Training",
  "Ready for Publishing",
];

export const LEGACY_TRAINING_NUMBER = /^[A-Za-z0-9/._-]{1,40}$/;
export const FIELD_LABEL = "text-xs sm:text-sm font-medium text-slate-700";
export const FIELD_INPUT =
  "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";
export const FIELD_TEXTAREA =
  "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";
export const FIELD_HINT = "text-xs text-slate-500 mt-1";
export const LANGUAGE_OPTIONS: SelectOption[] = [
  { label: "English", value: "English" },
  { label: "Vietnamese", value: "Vietnamese" },
];
export const MAX_BATCH_SECTIONS = 50;
export const CONFIRM_THRESHOLD = 10;

export const errorMessage = (error: unknown, fallback: string) =>
  (
    error as {
      response?: { data?: { error?: { message?: string }; message?: string } };
    }
  )?.response?.data?.error?.message ?? fallback;

export type DepartmentOption = SelectOption & { businessUnit?: string };
export type DocumentTypeOption = SelectOption & { shortCode?: string };
export type SubTypeOption = SelectOption & { documentTypeId?: string };
export type UserOption = { label: string; value: string };
export type FormTabId = LegacyImportTabId;

export interface DocumentFormState {
  documentNumberSuffix: string;
  documentName: string;
  titleLocalLanguage: string;
  documentType: string;
  documentSubType: string;
  businessUnit: string;
  department: string;
  language: string;
  legacyJustification: string;
  /** Controlled document template: Word (DOCX) only, no PDF, no training. */
  isTemplate: boolean;
  // Document-level Reviewer(s)/Approver -- NOT the per-revision "who reviewed/approved the paper
  // original" free-text fields below (those stay reference-only). These are real
  // DocumentWorkflowParticipant rows the same way an ordinary document's are, and without them
  // this document could never use Upgrade Revision afterward: copyWorkflowParticipantsFromDocument
  // requires exactly one real Approver (a GMP floor, DocumentService#validateApproverRules) and at
  // least one real Reviewer when Review is required, and Legacy Import is otherwise the only
  // document-creation path that never collects either -- once created ACTIVE with a revision
  // already attached, there is no other way to add them (DocumentAuthorizationService
  // #canEditInitialDocumentDraft only allows this for a still-DRAFT, revision-less document).
  reviewerIds: string[];
  approverId: string;
  periodicReviewCycle: string;
  periodicReviewNotification: string;
}

export const EMPTY_DOCUMENT_FORM: DocumentFormState = {
  documentNumberSuffix: "",
  documentName: "",
  titleLocalLanguage: "",
  documentType: "",
  documentSubType: "",
  businessUnit: "",
  department: "",
  language: "English",
  legacyJustification: "",
  isTemplate: false,
  reviewerIds: [],
  approverId: "",
  periodicReviewCycle: "",
  periodicReviewNotification: "",
};

export interface RevisionSection {
  key: string;
  revisionNumber: string;
  authorId: string;
  legacyHistoricalAuthoredDate: string;
  legacyHistoricalReviewerIds: string[];
  legacyHistoricalApproverId: string;
  legacyHistoricalReviewDate: string;
  legacyHistoricalApprovalDate: string;
  changeDescription: string;
  effectiveDate: string;
  // Maps directly onto DocumentRevisionRecord#trainingCompletionDate -- the same field the
  // ordinary Pending Training workflow step sets for any other revision, not a legacy-only field.
  trainingCompletionDate: string;
  // The number on the paper training record of this revision, typed by the person importing it (optional); never issued by the system.
  trainingNumber: string;
  file: File | null;
  fileError: string;
  noFileJustification: string;
  collapsed: boolean;
  // The paper training of the revision (Training Management): the persons trained, the scan (or the paper declared lost) and who verifies it.
  training: LegacyTrainingEvidenceValue;
  // What the system said about the Training Number typed: it joins evidence already on file (nothing is attached again), or it cannot be used.
  trainingNumberJoins: boolean;
  trainingNumberProblem: string;
}

let sectionKeySeed = 0;
const newSectionKey = () => `section-${++sectionKeySeed}`;

export const emptySection = (revisionNumber: string): RevisionSection => ({
  key: newSectionKey(),
  revisionNumber,
  authorId: "",
  legacyHistoricalAuthoredDate: "",
  legacyHistoricalReviewerIds: [],
  legacyHistoricalApproverId: "",
  legacyHistoricalReviewDate: "",
  legacyHistoricalApprovalDate: "",
  changeDescription: "",
  effectiveDate: "",
  trainingCompletionDate: "",
  trainingNumber: "",
  file: null,
  fileError: "",
  noFileJustification: "",
  collapsed: false,
  training: emptyLegacyTrainingEvidence(),
  trainingNumberJoins: false,
  trainingNumberProblem: "",
});

/**
 * Chronological validation for a section's 4 historical dates. These record when each step of
 * the paper process actually happened, so they must follow that process's real order (drafted ->
 * reviewed -> approved -> effective) and none of them can be in the future -- a "historical"
 * record dated tomorrow is a data-entry mistake, not a valid import. Cross-section ordering
 * (Revision Number / Effective Date strictly increasing across sections) is handled separately by
 * sectionOrderError/effectiveDateOrderError; this only checks a single section's own 4 dates
 * against each other and against today.
 */
/**
 * DateTimePicker (see components/ui/datetime-picker/DateTimePicker.tsx#handleApply) emits values
 * as "DD/MM/YYYY" (optionally " HH:mm"), never ISO -- `new Date(thatString)` is NOT safe to call
 * on it: JS engines parse non-ISO slash-separated strings as (locale-dependent) M/D/Y, so a value
 * like "09/08/2026" silently becomes September 8 instead of August 9, and one like "31/08/2026"
 * becomes an outright Invalid Date (month 31). Either way every `new Date(x).getTime()` comparison
 * against these values was previously wrong or NaN (NaN comparisons are always false, so bad
 * dates silently passed validation). This parses the real format directly.
 */
export const parseDateTimePickerValue = (value: string): number | null => {
  if (!value) return null;
  const match = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(year, month - 1, day, hh ? Number(hh) : 0, min ? Number(min) : 0, 0, 0);
  // Guards against e.g. "31/02/2026" silently rolling over into March.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
};

const FUTURE_DATE_ERROR = "Cannot be a future date.";
export const getSectionDateErrors = (
  section: RevisionSection,
): {
  authored: string | null;
  review: string | null;
  approval: string | null;
  effective: string | null;
  training: string | null;
} => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const todayTime = endOfToday.getTime();

  const authored = parseDateTimePickerValue(section.legacyHistoricalAuthoredDate);
  const review = parseDateTimePickerValue(section.legacyHistoricalReviewDate);
  const approval = parseDateTimePickerValue(section.legacyHistoricalApprovalDate);
  const effective = parseDateTimePickerValue(section.effectiveDate);
  const training = parseDateTimePickerValue(section.trainingCompletionDate);

  // Each field is checked against BOTH of its neighbors -- whichever of the two conflicting dates
  // the user edited last is the one that visibly turns red, instead of only ever blaming the
  // later field in the chain (which could sit far away from the one the user just changed).
  return {
    authored:
      authored !== null && authored > todayTime
        ? FUTURE_DATE_ERROR
        : authored !== null && review !== null && authored > review
          ? "Must be on or before the Historical Review Date."
          : null,
    review:
      review !== null && review > todayTime
        ? FUTURE_DATE_ERROR
        : review !== null && authored !== null && review < authored
          ? "Must be on or after the Authored Date."
          : review !== null && approval !== null && review > approval
            ? "Must be on or before the Historical Approval Date."
            : null,
    // Training (when required) sits BETWEEN Approval and Effective in the real chain -- the normal,
    // non-legacy lifecycle only reaches "Pending Training" after Approval, and only reaches
    // Effective after training completes, so a paper record claiming training finished before it
    // was even approved is a data-entry mistake, not a valid historical fact. When no training
    // date is present (training not required for this document), Approval/Effective fall back to
    // checking directly against each other, same as before.
    approval:
      approval !== null && approval > todayTime
        ? FUTURE_DATE_ERROR
        : approval !== null && review !== null && approval < review
          ? "Must be on or after the Historical Review Date."
          : approval !== null && training !== null && approval > training
            ? "Must be on or before the Historical Training Completion Date."
            : approval !== null && training === null && effective !== null && approval > effective
              ? "Must be on or before the Effective Date."
              : null,
    effective:
      effective !== null && effective > todayTime
        ? FUTURE_DATE_ERROR
        : effective !== null && training !== null && effective < training
          ? "Must be on or after the Historical Training Completion Date."
          : effective !== null && training === null && approval !== null && effective < approval
            ? "Must be on or after the Historical Approval Date."
            : null,
    training:
      training !== null && training > todayTime
        ? FUTURE_DATE_ERROR
        : training !== null && approval !== null && training < approval
          ? "Must be on or after the Historical Approval Date."
          : training !== null && effective !== null && training > effective
            ? "Must be on or before this revision's Effective Date."
            : null,
  };
};

export type UpdateSection = <K extends keyof RevisionSection>(key: string, field: K, value: RevisionSection[K]) => void;
