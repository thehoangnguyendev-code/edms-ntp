import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  X as XIcon,
  Loader2,
  Trash2,
  Upload,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { legacyImport as legacyImportBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { Badge } from "@/components/ui/badge/Badge";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Progress } from "@/components/ui/progress/Progress";
import { useToast } from "@/components/ui/toast";
import { ROUTES } from "@/app/routes.constants";
import { dictionaryApi } from "@/services/api/dictionary";
import { securityApi } from "@/services/api/security";
import { documentApi } from "@/services/api/documents";
import { settingsApi } from "@/services/api/settings";
import {
  REVISION_WORKFLOW_STEPS,
  DOCUMENT_WORKFLOW_STEPS,
} from "@/features/documents/shared/statusMapping";
import { formatDocumentTypeLookupLabel } from "@/features/documents/shared/documentTypeDisplay";
import { cn } from "@/components/ui/utils";
import {
  DocumentRelationships,
  type ParentDocument,
  type RelatedDocument,
} from "./new-tabs";
import { TrainingTab, validateTrainingTab, type TrainingConfig } from "./new-tabs/TrainingTab";
import { LegacyImportTabNavigation, type LegacyImportTabId } from "./legacy-import-tabs/LegacyImportTabNavigation";

// The middle Revision workflow steps never run for Legacy Import -- every historical revision was
// already reviewed/approved outside the system.
const SKIPPED_STEPS = [
  "Pending Review",
  "Pending Approval",
  "Pending Training",
  "Ready for Publishing",
];

const FIELD_LABEL = "text-xs sm:text-sm font-medium text-slate-700";
const FIELD_INPUT =
  "w-full h-9 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";
const FIELD_TEXTAREA =
  "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";
const FIELD_HINT = "text-xs text-slate-500 mt-1";
const LANGUAGE_OPTIONS: SelectOption[] = [
  { label: "English", value: "English" },
  { label: "Vietnamese", value: "Vietnamese" },
];
const MAX_BATCH_SECTIONS = 50;
const CONFIRM_THRESHOLD = 10;

const errorMessage = (error: unknown, fallback: string) =>
  (
    error as {
      response?: { data?: { error?: { message?: string }; message?: string } };
    }
  )?.response?.data?.error?.message ?? fallback;

type DepartmentOption = SelectOption & { businessUnit?: string };
type DocumentTypeOption = SelectOption & { shortCode?: string };
type SubTypeOption = SelectOption & { documentTypeId?: string };
type UserOption = { label: string; value: string };
type FormTabId = LegacyImportTabId;

interface DocumentFormState {
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

const EMPTY_DOCUMENT_FORM: DocumentFormState = {
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
  file: File | null;
  fileError: string;
  noFileJustification: string;
  collapsed: boolean;
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
  file: null,
  fileError: "",
  noFileJustification: "",
  collapsed: false,
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

const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className={FIELD_LABEL}>
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {hint && <p className={FIELD_HINT}>{hint}</p>}
  </div>
);

// Same "Choose File" button + hidden input + filename pattern used by UploadRevisionModal.tsx,
// reused here instead of a raw <input type="file"> so the UI stays visually consistent.
const SectionFileField: React.FC<{
  file: File | null;
  onChange: (file: File | null) => void;
  onOversize: (message: string) => void;
  maxFileSizeMB: number;
  /** A controlled document template is kept as its Word file, so only DOCX is accepted. */
  docxOnly?: boolean;
}> = ({ file, onChange, onOversize, maxFileSizeMB, docxOnly = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={
          docxOnly
            ? ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : ".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
        }
        onChange={(e) => {
          const nextFile = e.target.files?.[0] ?? null;
          if (nextFile && docxOnly && !nextFile.name.toLowerCase().endsWith(".docx")) {
            onOversize("A controlled document template accepts only a DOCX (Word) file.");
            e.target.value = "";
            return;
          }
          if (
            nextFile &&
            nextFile.size > Math.max(maxFileSizeMB, 1) * 1024 * 1024
          ) {
            onOversize(
              `Selected file exceeds the maximum allowed size of ${maxFileSizeMB} MB.`,
            );
            e.target.value = "";
            return;
          }
          onChange(nextFile);
        }}
        className="hidden"
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 w-full">
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          size="sm"
          className="gap-2 w-full sm:w-auto flex-shrink-0 whitespace-nowrap"
        >
          <Upload className="h-4 w-4" />
          Choose File
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
          {file ? file.name : "No file chosen"}
        </span>
        {file && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            title="Delete uploaded file"
            aria-label="Delete uploaded file"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Shown for the whole (single, atomic) import request, from the moment the e-signature is
 * confirmed until the response comes back -- the backend commits the document and every revision
 * in one transaction (see DocumentService#createLegacyImportDocumentAndRevisions), so there is no
 * real partial-progress signal to report and no partially-imported outcome to show: either every
 * revision below made it in, or (on any error) none did and the form reappears with the failure
 * cause. The bar therefore always slides rather than filling to a fabricated percentage.
 */
const LegacyImportProgressModal: React.FC<{
  isOpen: boolean;
  sectionCount: number;
  stage: string;
}> = ({ isOpen, sectionCount, stage }) => {
  if (!isOpen) return null;
  return (
    <FormModal
      isOpen={isOpen}
      onClose={() => undefined}
      title="Legacy Import processing"
      showFooter={false}
      size="md"
      className="max-w-md"
    >
      <div className="py-1">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-5 w-5 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900 flex-1">
            {stage || "Processing..."}
          </h3>
        </div>
        <p className="mb-4 text-xs sm:text-sm text-slate-500">
          Creating the document and importing {sectionCount > 1 ? `all ${sectionCount} historical revisions` : "the revision"} in a single all-or-nothing operation. This can take a while for many or large files -- please don't close this tab.
        </p>
        <Progress value={0} variant="emerald" size="md" indeterminate />
        <p className="mt-2.5 text-xs sm:text-sm text-slate-500">
          If anything fails, nothing is imported and you'll be brought back here with the exact issue to fix -- the document is never left half-imported.
        </p>
      </div>
    </FormModal>
  );
};

/**
 * Legacy Import: brings a document that already exists outside the system (e.g. a paper original)
 * straight in, publishing it directly as Effective without an electronic Review/Approval step. A
 * document may have had just one revision on paper, or several (e.g. 1.0 through 4.0) before being
 * digitized -- both cases are the SAME flow here: enter the most recent Revision Number and this
 * generates one section per historical revision (1 section when there was only ever one). Every
 * section but the last publishes straight to Obsoleted (superseded); only the last reaches
 * Effective. One electronic signature authorizes the whole import.
 */
export const LegacyImportView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const shouldReduceMotion = useReducedMotion();
  const collapseTransition = useMemo(
    () =>
      shouldReduceMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 90, damping: 16 },
    [shouldReduceMotion],
  );

  const [form, setForm] = useState<DocumentFormState>(EMPTY_DOCUMENT_FORM);
  const setField = <K extends keyof DocumentFormState>(
    key: K,
    value: DocumentFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const [documentTypeOptions, setDocumentTypeOptions] = useState<
    DocumentTypeOption[]
  >([]);
  const [businessUnitOptions, setBusinessUnitOptions] = useState<
    SelectOption[]
  >([]);
  const [departmentOptions, setDepartmentOptions] = useState<
    DepartmentOption[]
  >([]);
  const [subTypeOptions, setSubTypeOptions] = useState<SubTypeOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [maxFileSizeMB, setMaxFileSizeMB] = useState(25);
  const [serialNumberDigits, setSerialNumberDigits] = useState(4);
  const [revisionNumberSeed, setRevisionNumberSeed] = useState<"0.0.1" | "0.1">(
    "0.0.1",
  );

  useEffect(() => {
    let alive = true;
    settingsApi
      .getDocumentsOperationalConfig()
      .then((config) => {
        if (!alive) return;
        const typed = config as {
          maxFileSizeMB?: number;
          serialNumberDigits?: number;
          revisionNumberSeed?: string;
        };
        const maxSize = Number(typed?.maxFileSizeMB);
        if (Number.isFinite(maxSize) && maxSize > 0) setMaxFileSizeMB(maxSize);
        const digits = Number(typed?.serialNumberDigits);
        if (Number.isFinite(digits) && digits >= 1 && digits <= 9)
          setSerialNumberDigits(digits);
        if (typed?.revisionNumberSeed === "0.1") setRevisionNumberSeed("0.1");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const isTwoPartRevisionSeed = revisionNumberSeed === "0.1";
  const revisionNumberExample = isTwoPartRevisionSeed ? "4.0" : "4.0.0";
  const revisionNumberPattern = isTwoPartRevisionSeed
    ? /^\d+\.\d+$/
    : /^\d+\.\d+\.\d+$/;
  const isRevisionNumberFormatValid = (value: string) =>
    revisionNumberPattern.test(value.trim());
  const buildRevisionNumber = (major: number) =>
    isTwoPartRevisionSeed ? `${major}.0` : `${major}.0.0`;

  const documentNumberSuffixPattern = useMemo(
    () => new RegExp(`^\\d{${serialNumberDigits}}$`),
    [serialNumberDigits],
  );
  const documentNumberSuffixExample = useMemo(
    () => "7".padStart(serialNumberDigits, "0"),
    [serialNumberDigits],
  );
  const isDocumentNumberSuffixFormatValid = (value: string) =>
    documentNumberSuffixPattern.test(value.trim());

  const [numberCheck, setNumberCheck] = useState<{
    checking: boolean;
    available: boolean | null;
    forNumber: string;
  }>({ checking: false, available: null, forNumber: "" });

  const [relatedDocuments, setRelatedDocuments] = useState<RelatedDocument[]>(
    [],
  );
  const [correlatedDocuments, setCorrelatedDocuments] = useState<
    ParentDocument[]
  >([]);

  // Document-level, same field the normal New Document flow collects -- governs whether the LMS
  // must track training completions for this document going forward. Independent of whether
  // training already happened offline on paper before this document was brought into the system
  // (that historical fact, if you want it recorded, belongs in a section's "Change Description" or
  // the Migration Justification -- this checkbox is about future/ongoing training tracking).
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
    isRequired: false,
    trainingPeriodDays: null,
    reasonForSkippingTraining: "",
  });

  // A template is Word-only with no training obligation: keep the client state aligned with the
  // server rules (RevisionService#createLegacyImportRevisionsBatch) the moment it is switched on.
  useEffect(() => {
    if (!form.isTemplate) return;
    setTrainingConfig((current) =>
      current.isRequired || current.trainingPeriodDays || current.reasonForSkippingTraining
        ? { isRequired: false, trainingPeriodDays: null, reasonForSkippingTraining: "" }
        : current,
    );
    setActiveTab((tab) => (tab === "training" ? "document" : tab));
    setSections((current) =>
      current.some((section) => section.file && !section.file.name.toLowerCase().endsWith(".docx"))
        ? current.map((section) =>
            section.file && !section.file.name.toLowerCase().endsWith(".docx")
              ? {
                  ...section,
                  file: null,
                  fileError: "A controlled document template accepts only a DOCX (Word) file.",
                }
              : section,
          )
        : current,
    );
  }, [form.isTemplate]);

  // -- Revision section generation (1 section when the paper original only ever had one revision) --
  const [targetRevisionNumber, setTargetRevisionNumber] = useState("");
  const [sections, setSections] = useState<RevisionSection[]>([]);
  const [bulkConfirmed, setBulkConfirmed] = useState(false);

  const generateSections = () => {
    const trimmed = targetRevisionNumber.trim();
    if (!isRevisionNumberFormatValid(trimmed)) return;
    const major = parseInt(trimmed.split(".")[0], 10);
    if (!Number.isFinite(major) || major < 1) return;
    const count = Math.min(major, MAX_BATCH_SECTIONS);
    const next: RevisionSection[] = [];
    for (let i = 1; i <= count; i++) {
      const section = emptySection(buildRevisionNumber(i));
      // Only the first (oldest) revision starts expanded -- the rest stay collapsed regardless of
      // batch size, and the user opens whichever ones they need next themselves.
      section.collapsed = count > 1 && i !== 1;
      next.push(section);
    }
    setSections(next);
    setBulkConfirmed(false);
  };

  const updateSection = <K extends keyof RevisionSection>(
    key: string,
    field: K,
    value: RevisionSection[K],
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)),
    );
  };

  const toggleCollapsed = (key: string) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, collapsed: !s.collapsed } : s)),
    );
  };

  // Copies the first section's Author/Historical Reviewer(s)/Historical Approver onto every other
  // section -- a convenience for large batches, not a lock: every section (the first one included)
  // stays freely editable afterward, and re-clicking after changing the first section's values
  // re-applies the new ones.
  const applyFirstSectionRolesToRest = () => {
    setSections((prev) => {
      const first = prev[0];
      if (!first) return prev;
      return prev.map((s, i) =>
        i === 0
          ? s
          : {
              ...s,
              authorId: first.authorId,
              legacyHistoricalReviewerIds: [...first.legacyHistoricalReviewerIds],
              legacyHistoricalApproverId: first.legacyHistoricalApproverId,
            },
      );
    });
  };

  const [showSignature, setShowSignature] = useState(false);
  // Only surface inline field-level errors after the first failed attempt to sign -- otherwise
  // every required field would show red before the user has even started filling the form.
  const [showValidation, setShowValidation] = useState(false);
  const [activeTab, setActiveTab] = useState<FormTabId>("document");
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [types, businessUnits, departments, subTypes] = await Promise.all(
          [
            dictionaryApi.getDocumentTypes(),
            dictionaryApi.getBusinessUnits(),
            dictionaryApi.getDepartments(),
            dictionaryApi.getSubTypes(),
          ],
        );
        if (!alive) return;
        const businessUnitIdByName = new Map(
          businessUnits
            .filter((b) => b.isActive)
            .map((b) => [String(b.name).trim(), b.id]),
        );
        setDocumentTypeOptions(
          types
            .filter((t) => t.isActive)
            .map((t) => ({
              label: formatDocumentTypeLookupLabel(t.shortCode, t.name),
              value: t.id,
              shortCode: t.shortCode,
            })),
        );
        setBusinessUnitOptions(
          businessUnits
            .filter((b) => b.isActive)
            .map((b) => ({ label: b.name, value: b.id })),
        );
        setDepartmentOptions(
          departments
            .filter((d) => d.isActive)
            .map((d) => ({
              label: d.name,
              value: d.id,
              businessUnit:
                businessUnitIdByName.get(String(d.businessUnit).trim()) ||
                String(d.businessUnit || ""),
            })),
        );
        setSubTypeOptions(
          subTypes
            .filter((s) => s.isActive)
            .map((s) => ({
              label: s.name,
              value: s.id,
              documentTypeId: s.documentTypeId,
            })),
        );
      } catch (error) {
        showToast({
          type: "error",
          title: "Failed to load",
          message: errorMessage(
            error,
            "Unable to load Document Type / Business Unit / Department.",
          ),
        });
      } finally {
        if (alive) setLoadingLookups(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [showToast]);

  // Live server-side search for Document Type / Business Unit, on top of the small cached
  // full-list fetch above -- these dictionaries are tens-scale today, but typing now hits the
  // real paged/search endpoint instead of only filtering the already-loaded array, so the picker
  // stays correct (not silently capped) if either dictionary grows.
  const searchDocumentTypeOptions = useCallback(async (query: string) => {
    const page = await dictionaryApi.getDocumentTypesPage({ search: query, status: "Active", limit: 50 });
    return page.data.map((t) => ({
      label: formatDocumentTypeLookupLabel(t.shortCode, t.name),
      value: t.id,
    }));
  }, []);

  const searchBusinessUnitOptions = useCallback(async (query: string) => {
    const page = await dictionaryApi.getBusinessUnitsPage({ search: query, status: "Active", limit: 50 });
    return page.data.map((b) => ({ label: b.name, value: b.id }));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const results = await securityApi.getEligibleUsers(
          "documents.document.view",
          "",
        );
        if (!alive) return;
        setUserOptions(
          results.map((u) => ({
            label: `${u.employeeCode ? `${u.employeeCode} - ` : ""}${u.fullName} (${u.department})`,
            value: u.id,
          })),
        );
      } catch (error) {
        showToast({
          type: "error",
          title: "Failed to load",
          message: errorMessage(
            error,
            "Unable to load the user directory for Author / Reviewer / Approver.",
          ),
        });
      } finally {
        if (alive) setLoadingUsers(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [showToast]);

  // Stable reference (useCallback, no deps) is required here -- Select/MultiSelect's internal
  // debounced-search effect depends on this function's identity. A plain inline function gets
  // recreated on every LegacyImportView render (e.g. right after picking a reviewer updates
  // `sections` state), which re-triggers that effect and refetches/reopens the dropdown even
  // though the search query itself never changed -- the exact "dropdown reloads after selecting
  // someone" symptom this fixes.
  const searchUsers = useCallback(async (query: string) => {
    const results = await securityApi.getEligibleUsers(
      "documents.document.view",
      query,
    );
    return results.map((u) => ({
      label: `${u.employeeCode ? `${u.employeeCode} - ` : ""}${u.fullName} (${u.department})`,
      value: u.id,
    }));
  }, []);

  const filteredDepartmentOptions = useMemo(
    () =>
      form.businessUnit
        ? departmentOptions.filter(
            (d) => !d.businessUnit || d.businessUnit === form.businessUnit,
          )
        : [],
    [departmentOptions, form.businessUnit],
  );

  const subTypeOptionsForSelectedDocumentType = useMemo(
    () =>
      form.documentType
        ? subTypeOptions.filter((s) => s.documentTypeId === form.documentType)
        : [],
    [subTypeOptions, form.documentType],
  );

  const documentTypeName = useMemo(
    () =>
      documentTypeOptions.find((o) => o.value === form.documentType)?.label ??
      "",
    [documentTypeOptions, form.documentType],
  );

  const documentNumberPrefix = useMemo(() => {
    const shortCode = documentTypeOptions.find(
      (o) => o.value === form.documentType,
    )?.shortCode;
    return shortCode ? `${shortCode}.` : "";
  }, [documentTypeOptions, form.documentType]);
  const documentNumber = `${documentNumberPrefix}${form.documentNumberSuffix.trim()}`;
  const debouncedDocumentNumber = useDebounce(documentNumber, 400);

  useEffect(() => {
    if (
      !documentNumberPrefix ||
      !form.documentNumberSuffix.trim() ||
      !isDocumentNumberSuffixFormatValid(form.documentNumberSuffix)
    ) {
      setNumberCheck({ checking: false, available: null, forNumber: "" });
      return;
    }
    let alive = true;
    setNumberCheck((prev) => ({ ...prev, checking: true }));
    documentApi
      .checkLegacyDocumentNumberAvailable(debouncedDocumentNumber)
      .then((available) => {
        if (alive)
          setNumberCheck({
            checking: false,
            available,
            forNumber: debouncedDocumentNumber,
          });
      })
      .catch(() => {
        if (alive)
          setNumberCheck({
            checking: false,
            available: null,
            forNumber: debouncedDocumentNumber,
          });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDocumentNumber, documentNumberPrefix, serialNumberDigits]);

  const numberStatus =
    numberCheck.forNumber === documentNumber
      ? numberCheck
      : { checking: true, available: null, forNumber: documentNumber };
  const isDuplicateNumber =
    !numberStatus.checking && numberStatus.available === false;

  // Revision numbers must be strictly increasing across sections, matching the backend's own
  // validation -- checked live so a manual edit that breaks the order is caught before Submit.
  const sectionOrderError = useMemo(() => {
    for (let i = 1; i < sections.length; i++) {
      const prevValue = sections[i - 1].revisionNumber.trim();
      const curValue = sections[i].revisionNumber.trim();
      if (
        !isRevisionNumberFormatValid(prevValue) ||
        !isRevisionNumberFormatValid(curValue)
      )
        continue;
      const prevMajor = parseFloat(prevValue);
      const curMajor = parseFloat(curValue);
      if (curMajor <= prevMajor) {
        return `Revision numbers must be strictly increasing (section ${i + 1}: "${curValue}" must be greater than "${prevValue}").`;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const effectiveDateOrderError = useMemo(() => {
    for (let i = 1; i < sections.length; i++) {
      const prevTime = parseDateTimePickerValue(sections[i - 1].effectiveDate);
      const curTime = parseDateTimePickerValue(sections[i].effectiveDate);
      if (prevTime === null || curTime === null) continue;
      if (curTime <= prevTime) {
        return `Effective Date must be strictly increasing across revisions (section ${i + 1} must be after section ${i}).`;
      }
    }
    return null;
  }, [sections]);

  const missingField = useMemo((): {
    message: string;
    tab: FormTabId;
  } | null => {
    if (!form.documentType) return { message: "Document Type", tab: "document" };
    if (!form.documentNumberSuffix.trim())
      return { message: "Document Number", tab: "document" };
    if (!isDocumentNumberSuffixFormatValid(form.documentNumberSuffix)) {
      return {
        message: `Document Number (must be exactly ${serialNumberDigits} digit(s))`,
        tab: "document",
      };
    }
    if (isDuplicateNumber)
      return { message: "Document Number (already in use)", tab: "document" };
    if (numberStatus.checking)
      return {
        message: "Document Number (still checking availability)",
        tab: "document",
      };
    if (!form.documentName.trim())
      return { message: "Document Name", tab: "document" };
    if (!form.businessUnit)
      return { message: "Business Unit", tab: "document" };
    if (!form.department) return { message: "Department", tab: "document" };
    if (!form.legacyJustification.trim())
      return { message: "Migration Justification", tab: "document" };
    if (form.reviewerIds.length === 0)
      return { message: "Reviewer(s)", tab: "document" };
    if (!form.approverId)
      return { message: "Approver", tab: "document" };
    if (!form.periodicReviewCycle.trim())
      return { message: "Periodic Review Cycle", tab: "document" };
    if (!form.periodicReviewNotification.trim())
      return { message: "Periodic Review Notification", tab: "document" };
    if (!form.isTemplate) {
      const trainingValidation = validateTrainingTab(trainingConfig);
      if (!trainingValidation.isValid) {
        return {
          message: trainingConfig.isRequired
            ? "Training Period (Days)"
            : "Reason for skipping training",
          tab: "training",
        };
      }
    }
    if (sections.length === 0)
      return {
        message:
          "At least one revision section (enter the Revision Number and click Generate)",
        tab: "revisions",
      };
    if (sections.length > CONFIRM_THRESHOLD && !bulkConfirmed) {
      return {
        message: `Confirm creating ${sections.length} revisions (checkbox below the revision list)`,
        tab: "revisions",
      };
    }
    if (sectionOrderError) return { message: sectionOrderError, tab: "revisions" };
    if (effectiveDateOrderError)
      return { message: effectiveDateOrderError, tab: "revisions" };
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const isLast = i === sections.length - 1;
      if (
        !section.revisionNumber.trim() ||
        !isRevisionNumberFormatValid(section.revisionNumber)
      ) {
        return {
          message: `Revision Number for section ${i + 1} (must be in ${isTwoPartRevisionSeed ? "X.Y" : "X.Y.Z"} format)`,
          tab: "revisions",
        };
      }
      if (!section.authorId)
        return {
          message: `Author for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.legacyHistoricalAuthoredDate)
        return {
          message: `Authored Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (section.legacyHistoricalReviewerIds.length === 0)
        return {
          message: `Historical Reviewer(s) for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.legacyHistoricalReviewDate)
        return {
          message: `Historical Review Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.legacyHistoricalApproverId)
        return {
          message: `Historical Approver for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.legacyHistoricalApprovalDate)
        return {
          message: `Historical Approval Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      if (!section.effectiveDate)
        return {
          message: `Effective Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      {
        const dateErrors = getSectionDateErrors(section);
        if (dateErrors.authored)
          return { message: `Authored Date for revision ${section.revisionNumber} (${dateErrors.authored})`, tab: "revisions" };
        if (dateErrors.review)
          return { message: `Historical Review Date for revision ${section.revisionNumber} (${dateErrors.review})`, tab: "revisions" };
        if (dateErrors.approval)
          return { message: `Historical Approval Date for revision ${section.revisionNumber} (${dateErrors.approval})`, tab: "revisions" };
        if (dateErrors.effective)
          return { message: `Effective Date for revision ${section.revisionNumber} (${dateErrors.effective})`, tab: "revisions" };
      }
      if (form.isTemplate && !section.file) {
        return {
          message: `DOCX file for revision ${section.revisionNumber} -- required for every revision of a template`,
          tab: "revisions",
        };
      }
      if (!section.file && !section.noFileJustification.trim()) {
        return {
          message: `Source file or a "no file" justification for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      }
      if (section.fileError)
        return {
          message: `Source file for revision ${section.revisionNumber} (exceeds max size)`,
          tab: "revisions",
        };
      if (isLast && !section.file)
        return {
          message: `Source file for the most recent revision (${section.revisionNumber}) -- required`,
          tab: "revisions",
        };
      if (trainingConfig.isRequired && !section.trainingCompletionDate) {
        return {
          message: `Historical Training Completion Date for revision ${section.revisionNumber}`,
          tab: "revisions",
        };
      }
      if (trainingConfig.isRequired) {
        const trainingError = getSectionDateErrors(section).training;
        if (trainingError) {
          return {
            message: `Historical Training Completion Date for revision ${section.revisionNumber} (${trainingError})`,
            tab: "revisions",
          };
        }
      }
    }
    return null;
  }, [
    form,
    sections,
    trainingConfig,
    isDuplicateNumber,
    numberStatus.checking,
    serialNumberDigits,
    bulkConfirmed,
    sectionOrderError,
    effectiveDateOrderError,
    isTwoPartRevisionSeed,
  ]);

  const openSignature = () => {
    if (missingField) {
      setShowValidation(true);
      setActiveTab(missingField.tab);
      showToast({
        type: "error",
        title: "Missing information",
        // Most entries are bare noun phrases ("Document Type") that read naturally with " is
        // required." appended; the date chronology messages above are already complete sentences
        // (e.g. "... (Must be on or after the Authored Date.)"), so skip the suffix for those.
        message: /must be|cannot be/i.test(missingField.message)
          ? missingField.message
          : `${missingField.message} is required.`,
      });
      return;
    }
    setShowSignature(true);
  };

  const runImport = async (signatureToken: string) => {
    setSubmitting(true);
    try {
      setSubmitStage(
        sections.length > 1
          ? `Importing ${sections.length} historical revision(s)...`
          : "Importing the revision...",
      );
      // Document creation and the revision batch are sent as ONE request (one backend
      // transaction): if the batch half fails, the document half rolls back too, instead of
      // leaving an orphaned Draft that permanently holds this document number and blocks every
      // retry with "Document number already in use".
      const result = await documentApi.createLegacyImportDocumentAndRevisions(
        {
          documentName: form.documentName.trim(),
          titleLocalLanguage: form.titleLocalLanguage.trim() || undefined,
          documentType: form.documentType,
          subType: form.documentSubType || undefined,
          author: sections[sections.length - 1]?.authorId || "",
          businessUnit: form.businessUnit,
          department: form.department,
          language: form.language,
          description: form.legacyJustification.trim(),
          relatedDocumentIds: relatedDocuments.map((d) => d.id),
          correlatedDocumentIds: correlatedDocuments.map((d) => d.id),
          reviewerUserIds: form.reviewerIds,
          approverUserIds: form.approverId ? [form.approverId] : [],
          periodicReviewCycle: form.periodicReviewCycle ? Number.parseInt(form.periodicReviewCycle, 10) : undefined,
          periodicReviewNotification: form.periodicReviewNotification ? Number.parseInt(form.periodicReviewNotification, 10) : undefined,
          legacyDocumentNumber: documentNumber,
          legacyOriginalEffectiveDate: sections[0]?.effectiveDate || undefined,
          legacyJustification: form.legacyJustification.trim(),
          isTemplate: form.isTemplate,
          requiresTraining: form.isTemplate ? false : trainingConfig.isRequired,
          trainingPeriodDays: !form.isTemplate && trainingConfig.isRequired
            ? trainingConfig.trainingPeriodDays ?? undefined
            : undefined,
          reasonForSkippingTraining: form.isTemplate || trainingConfig.isRequired
            ? undefined
            : trainingConfig.reasonForSkippingTraining.trim() || undefined,
        },
        sections.map((section) => ({
          revisionNumber: section.revisionNumber.trim(),
          authorId: section.authorId || undefined,
          legacyHistoricalAuthoredDate:
            section.legacyHistoricalAuthoredDate || undefined,
          legacyHistoricalReviewers:
            section.legacyHistoricalReviewerIds
              .map((id) => userOptions.find((u) => u.value === id)?.label)
              .filter((label): label is string => Boolean(label))
              .join(", ") || undefined,
          legacyHistoricalApprover:
            userOptions.find(
              (u) => u.value === section.legacyHistoricalApproverId,
            )?.label || undefined,
          legacyHistoricalReviewDate:
            section.legacyHistoricalReviewDate || undefined,
          legacyHistoricalApprovalDate:
            section.legacyHistoricalApprovalDate || undefined,
          changeDescription: section.changeDescription.trim() || undefined,
          effectiveDate: section.effectiveDate,
          trainingCompletionDate:
            section.trainingCompletionDate || undefined,
          file: section.file,
          noFileJustification: section.noFileJustification.trim() || undefined,
        })),
        form.legacyJustification.trim(),
        signatureToken,
      );

      const publishedNumber =
        result.revisions[result.revisions.length - 1]?.documentNumber || documentNumber;
      showToast({
        type: "success",
        title: "Imported",
        message: `${publishedNumber} is now Effective${sections.length > 1 ? ` with ${sections.length} historical revision(s)` : ""}.`,
      });
      navigate(ROUTES.DOCUMENTS.ALL);
    } catch (error) {
      // The whole import is one all-or-nothing backend transaction (see the comment on
      // LegacyImportProgressModal): a failure here always means NOTHING was created -- never a
      // document left short some revisions -- so it's safe to just report the cause and let the
      // user fix it and resubmit from this same, still-filled-in form.
      showToast({
        type: "error",
        title: "Import failed -- nothing was created",
        message: errorMessage(
          error,
          "Unable to complete the Legacy Import. No document or revisions were saved; fix the issue below and try again.",
        ),
      });
      setSubmitting(false);
      setSubmitStage("");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <LegacyImportProgressModal isOpen={submitting} sectionCount={sections.length} stage={submitStage} />
      <PageHeader
        title="Legacy Import"
        breadcrumbItems={legacyImportBreadcrumb(navigate)}
        actions={
          <>
            <Button
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap"
              onClick={() => navigate(ROUTES.DOCUMENTS.ALL)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="default"
              className="whitespace-nowrap"
              onClick={openSignature}
              disabled={submitting}
            >
              Publish Document
            </Button>
          </>
        }
      />

      {activeTab === "document" && (
        <WorkflowStepper steps={DOCUMENT_WORKFLOW_STEPS} currentStepIndex={0} />
      )}
      {activeTab === "revisions" && (
        <div>
          <WorkflowStepper
            steps={REVISION_WORKFLOW_STEPS}
            currentStepIndex={0}
            skippedSteps={SKIPPED_STEPS}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <LegacyImportTabNavigation
          activeTab={activeTab}
          isTemplate={form.isTemplate}
          revisionCount={sections.length}
          onChange={setActiveTab}
        />

        <div className="p-4 md:p-5">
      {activeTab === "document" && (
      <div className="space-y-4 md:space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <Field label="Document Type" required>
            <Select
              value={form.documentType}
              onChange={(v) => {
                setField("documentType", String(v));
                setField("documentSubType", "");
              }}
              options={documentTypeOptions}
              onSearch={searchDocumentTypeOptions}
              isLoading={loadingLookups}
              placeholder="Select document type..."
            />
            {showValidation && !form.documentType && (
              <p className="text-xs text-red-600 mt-1">
                Document Type is required.
              </p>
            )}
          </Field>
          <Field
            label="Sub-Type"
          >
            <Select
              value={form.documentSubType}
              onChange={(v) => setField("documentSubType", String(v))}
              options={subTypeOptionsForSelectedDocumentType}
              placeholder={
                form.documentType
                  ? "Select sub-type (optional)..."
                  : "Select Document Type first"
              }
              disabled={!form.documentType}
            />
          </Field>
          <Field
            label="Document Number"
            hint={
              documentNumberPrefix
                ? `Digits of the Serial Number is set to ${serialNumberDigits} (Settings > Document Properties).`
                : undefined
            }
          >
            {(() => {
              const suffixHasValue =
                form.documentNumberSuffix.trim().length > 0;
              const isFormatInvalid =
                suffixHasValue &&
                !isDocumentNumberSuffixFormatValid(form.documentNumberSuffix);
              return (
                <>
                  <div className="flex items-center gap-2">
                    {documentNumberPrefix && (
                      <span className="shrink-0 h-9 px-3 inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 text-sm font-medium text-slate-600">
                        {documentNumberPrefix}
                      </span>
                    )}
                    <div className="relative flex-1">
                      <input
                        className={cn(
                          FIELD_INPUT,
                          "pr-8",
                          (isDuplicateNumber || isFormatInvalid) &&
                            "border-red-400 focus:ring-red-400 focus:border-red-400",
                        )}
                        value={form.documentNumberSuffix}
                        onChange={(e) =>
                          setField("documentNumberSuffix", e.target.value)
                        }
                        placeholder={
                          documentNumberPrefix
                            ? documentNumberSuffixExample
                            : "Select a Document Type first"
                        }
                        disabled={!form.documentType}
                        aria-invalid={isDuplicateNumber || isFormatInvalid}
                      />
                      {documentNumberPrefix &&
                        suffixHasValue &&
                        !isFormatInvalid && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            {numberStatus.checking ? (
                              <Loader2
                                className="h-4 w-4 animate-spin text-slate-400"
                                aria-label="Checking availability"
                              />
                            ) : numberStatus.available === true ? (
                              <Check
                                className="h-4 w-4 text-emerald-600"
                                aria-label="Available"
                              />
                            ) : numberStatus.available === false ? (
                              <XIcon
                                className="h-4 w-4 text-red-500"
                                aria-label="Already in use"
                              />
                            ) : null}
                          </span>
                        )}
                    </div>
                  </div>
                  {showValidation && !suffixHasValue && (
                    <p className="text-xs text-red-600 mt-1">
                      Document Number is required.
                    </p>
                  )}
                  {isFormatInvalid && (
                    <p className="text-xs text-red-600 mt-1">
                      Must be exactly {serialNumberDigits} digit(s), e.g. "
                      {documentNumberPrefix}
                      {documentNumberSuffixExample}".
                    </p>
                  )}
                  {!isFormatInvalid &&
                    suffixHasValue &&
                    !numberStatus.checking &&
                    numberStatus.available === false && (
                      <p className="text-xs text-red-600 mt-1">
                        "{documentNumber}" is already in use by another
                        document.
                      </p>
                    )}
                  {!isFormatInvalid &&
                    suffixHasValue &&
                    !numberStatus.checking &&
                    numberStatus.available === true && (
                      <p className="text-xs text-emerald-600 mt-1">
                        "{documentNumber}" is available.
                      </p>
                    )}
                </>
              );
            })()}
          </Field>
          <Field label="Document Name" required>
            <input
              className={FIELD_INPUT}
              value={form.documentName}
              onChange={(e) => setField("documentName", e.target.value)}
              placeholder="Document name as on the existing document"
            />
            {showValidation && !form.documentName.trim() && (
              <p className="text-xs text-red-600 mt-1">
                Document Name is required.
              </p>
            )}
          </Field>
          <div className="flex items-center gap-3">
            <label
              htmlFor="legacyIsTemplate"
              className="text-xs sm:text-sm font-medium text-slate-700"
            >
              Is Template?
            </label>
            <Checkbox
              id="legacyIsTemplate"
              checked={form.isTemplate}
              onChange={(checked) => setField("isTemplate", checked)}
            />
          </div>
          <Field label="Title in Local Language">
            <input
              className={FIELD_INPUT}
              value={form.titleLocalLanguage}
              onChange={(e) => setField("titleLocalLanguage", e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label="Business Unit" required>
            <Select
              value={form.businessUnit}
              onChange={(v) => {
                setField("businessUnit", String(v));
                setField("department", "");
              }}
              options={businessUnitOptions}
              onSearch={searchBusinessUnitOptions}
              isLoading={loadingLookups}
              placeholder="Select business unit..."
            />
            {showValidation && !form.businessUnit && (
              <p className="text-xs text-red-600 mt-1">
                Business Unit is required.
              </p>
            )}
          </Field>
          <Field label="Department" required>
            <Select
              value={form.department}
              onChange={(v) => setField("department", String(v))}
              options={filteredDepartmentOptions}
              isLoading={loadingLookups}
              placeholder={
                form.businessUnit
                  ? "Select department..."
                  : "Select Business Unit first"
              }
              disabled={!form.businessUnit}
            />
            {showValidation && !form.department && (
              <p className="text-xs text-red-600 mt-1">
                Department is required.
              </p>
            )}
          </Field>
          <Field
            label="Reviewer(s)"
            required
            hint="Who reviews this document going forward, starting with its NEXT revision (via Upgrade Revision) -- not the historical paper reviewer recorded per revision below."
          >
            <MultiSelect
              value={form.reviewerIds}
              onChange={(values) => setField("reviewerIds", values.map(String))}
              options={userOptions}
              isLoading={loadingUsers}
              onSearch={searchUsers}
              placeholder="Select reviewer(s)..."
            />
            {showValidation && form.reviewerIds.length === 0 && (
              <p className="text-xs text-red-600 mt-1">Reviewer(s) is required.</p>
            )}
          </Field>
          <Field
            label="Approver"
            required
            hint="Who approves this document going forward, starting with its NEXT revision -- not the historical paper approver recorded per revision below."
          >
            <Select
              value={form.approverId}
              onChange={(v) => setField("approverId", String(v))}
              options={userOptions}
              isLoading={loadingUsers}
              onSearch={searchUsers}
              placeholder="Select approver..."
            />
            {showValidation && !form.approverId && (
              <p className="text-xs text-red-600 mt-1">Approver is required.</p>
            )}
          </Field>
          <Field label="Periodic Review Cycle (Months)" required>
            <input
              type="number"
              min="1"
              className={FIELD_INPUT}
              value={form.periodicReviewCycle}
              onKeyDown={(e) => {
                if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
              }}
              onChange={(e) => setField("periodicReviewCycle", e.target.value)}
              placeholder="Enter review cycle in months"
            />
            {showValidation && !form.periodicReviewCycle.trim() && (
              <p className="text-xs text-red-600 mt-1">Periodic Review Cycle is required.</p>
            )}
          </Field>
          <Field label="Periodic Review Notification (Days)" required>
            <input
              type="number"
              min="1"
              className={FIELD_INPUT}
              value={form.periodicReviewNotification}
              onKeyDown={(e) => {
                if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
              }}
              onChange={(e) => setField("periodicReviewNotification", e.target.value)}
              placeholder="Enter notification days before review"
            />
            {showValidation && !form.periodicReviewNotification.trim() && (
              <p className="text-xs text-red-600 mt-1">Periodic Review Notification is required.</p>
            )}
          </Field>
          <div className="md:col-span-2">
            <Field label="Language">
              <Select
                value={form.language}
                onChange={(v) => setField("language", String(v))}
                options={LANGUAGE_OPTIONS}
                enableSearch={false}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              label="Migration Justification"
              required
            >
              <textarea
                rows={3}
                className={FIELD_TEXTAREA}
                value={form.legacyJustification}
                onChange={(e) =>
                  setField("legacyJustification", e.target.value)
                }
                placeholder="Migrated from Document Control paper archive, box #12"
              />
              {showValidation && !form.legacyJustification.trim() && (
                <p className="text-xs text-red-600 mt-1">
                  Migration Justification is required.
                </p>
              )}
            </Field>
          </div>
        </div>

        <DocumentRelationships
          currentDocumentId={null}
          relatedDocuments={relatedDocuments}
          onRelatedDocumentsChange={setRelatedDocuments}
          correlatedDocuments={correlatedDocuments}
          onCorrelatedDocumentsChange={setCorrelatedDocuments}
          documentType={documentTypeName}
        />
      </div>
      )}

      {activeTab === "training" && (
      <div className="space-y-4 md:space-y-5">
        <p className="text-xs sm:text-sm text-slate-500">
          Whether employees must complete training for this document going
          forward, tracked by the Training module -- independent of any
          training already done offline on paper before this document was
          brought into the system.
        </p>
        <TrainingTab
          data={trainingConfig}
          onChange={setTrainingConfig}
          validationError={
            showValidation
              ? validateTrainingTab(trainingConfig).errors
              : undefined
          }
        />
      </div>
      )}

      {activeTab === "revisions" && (
      <div className="space-y-4 md:space-y-5">
        <div>
          <label className={FIELD_LABEL}>
            Most Recent Revision Number
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              className={cn(
                FIELD_INPUT,
                "flex-1 min-w-0",
                targetRevisionNumber.trim() &&
                  !isRevisionNumberFormatValid(targetRevisionNumber) &&
                  "border-red-400 focus:ring-red-400 focus:border-red-400",
              )}
              value={targetRevisionNumber}
              onChange={(e) => setTargetRevisionNumber(e.target.value)}
              placeholder={`e.g. ${revisionNumberExample}`}
            />
            <Button
              type="button"
              variant="default"
              size="sm"
              className="whitespace-nowrap shrink-0"
              onClick={generateSections}
              disabled={!isRevisionNumberFormatValid(targetRevisionNumber)}
            >
              {sections.length > 0
                ? "Regenerate Sections"
                : "Generate Sections"}
            </Button>
          </div>
          <p className={FIELD_HINT}>
            Default Revision Number Format is set
            to {isTwoPartRevisionSeed ? "X.Y" : "X.Y.Z"} in System Administration &gt; Document Administration &gt;
            Document Properties.
          </p>
        </div>

        {sections.length > CONFIRM_THRESHOLD && (
          <WarningBanner
            variant="warning"
            title={`This will create ${sections.length} revisions`}
            description="Double-check the Revision Number is correct before continuing."
          />
        )}

        <div className="space-y-3">
          {sections.map((section, index) => {
            const isLast = index === sections.length - 1;
            const sectionDateErrors = getSectionDateErrors(section);
            return (
              <div
                key={section.key}
                // CSS-only "active section" highlight via :focus-within -- deliberately NOT
                // React state driven by onFocus/onBlur: that previously forced a re-render of
                // this whole (portal-based, click-outside-detecting) dropdown subtree on every
                // focus/blur, which could eat the very first click on a Select/MultiSelect
                // option (had to click twice to actually select a value). CSS has no such
                // re-render, so this can never race a click.
                className="group rounded-xl border border-slate-200 overflow-hidden transition-colors focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500"
              >
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-slate-50 border-slate-200 transition-colors group-focus-within:bg-emerald-50/60 group-focus-within:border-emerald-200">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(section.key)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    aria-expanded={!section.collapsed}
                  >
                    <motion.span
                      className="flex-shrink-0"
                      animate={{ rotate: section.collapsed ? -90 : 0 }}
                      transition={collapseTransition}
                    >
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </motion.span>
                    <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                      Revision {section.revisionNumber || index + 1}
                    </span>
                    {isLast ? (
                      <Badge color="emerald" size="xs">
                        Becomes Effective
                      </Badge>
                    ) : (
                      <Badge color="amber" size="xs">
                        Becomes Obsoleted
                      </Badge>
                    )}
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {!section.collapsed && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={collapseTransition}
                      className="overflow-hidden"
                    >
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <Field label="Revision Number" required>
                          <input
                            className={cn(
                              FIELD_INPUT,
                              section.revisionNumber.trim() &&
                                !isRevisionNumberFormatValid(
                                  section.revisionNumber,
                                ) &&
                                "border-red-400 focus:ring-red-400 focus:border-red-400",
                            )}
                            value={section.revisionNumber}
                            onChange={(e) =>
                              updateSection(
                                section.key,
                                "revisionNumber",
                                e.target.value,
                              )
                            }
                          />
                          {showValidation &&
                            !section.revisionNumber.trim() && (
                              <p className="text-xs text-red-600 mt-1">
                                Revision Number is required.
                              </p>
                            )}
                        </Field>
                        <Field
                          label="Effective Date"
                          required
                        >
                          <DateTimePicker
                            value={section.effectiveDate}
                            onChange={(v) =>
                              updateSection(section.key, "effectiveDate", v)
                            }
                            placeholder="Select date"
                          />
                          {showValidation && !section.effectiveDate && (
                            <p className="text-xs text-red-600 mt-1">
                              Effective Date is required.
                            </p>
                          )}
                          {sectionDateErrors.effective && (
                            <p className="text-xs text-red-600 mt-1">
                              {sectionDateErrors.effective}
                            </p>
                          )}
                        </Field>
                        <Field
                          label="Author"
                          required
                        >
                          <Select
                            value={section.authorId}
                            onChange={(v) =>
                              updateSection(section.key, "authorId", String(v))
                            }
                            options={userOptions}
                            isLoading={loadingUsers}
                            onSearch={searchUsers}
                            placeholder="Select author..."
                          />
                          {showValidation && !section.authorId && (
                            <p className="text-xs text-red-600 mt-1">
                              Author is required.
                            </p>
                          )}
                        </Field>
                        <Field
                          label="Authored Date"
                          required
                        >
                          <DateTimePicker
                            value={section.legacyHistoricalAuthoredDate}
                            onChange={(v) =>
                              updateSection(
                                section.key,
                                "legacyHistoricalAuthoredDate",
                                v,
                              )
                            }
                            placeholder="Select date"
                          />
                          {showValidation &&
                            !section.legacyHistoricalAuthoredDate && (
                              <p className="text-xs text-red-600 mt-1">
                                Authored Date is required.
                              </p>
                            )}
                          {sectionDateErrors.authored && (
                            <p className="text-xs text-red-600 mt-1">
                              {sectionDateErrors.authored}
                            </p>
                          )}
                        </Field>
                        <Field label="Historical Reviewer(s)" required>
                          <MultiSelect
                            value={section.legacyHistoricalReviewerIds}
                            onChange={(values) =>
                              updateSection(
                                section.key,
                                "legacyHistoricalReviewerIds",
                                values.map(String),
                              )
                            }
                            options={userOptions}
                            isLoading={loadingUsers}
                            onSearch={searchUsers}
                            placeholder="Select reviewer(s)..."
                          />
                          {showValidation &&
                            section.legacyHistoricalReviewerIds.length ===
                              0 && (
                              <p className="text-xs text-red-600 mt-1">
                                Historical Reviewer(s) is required.
                              </p>
                            )}
                        </Field>
                        <Field label="Historical Review Date" required>
                          <DateTimePicker
                            value={section.legacyHistoricalReviewDate}
                            onChange={(v) =>
                              updateSection(
                                section.key,
                                "legacyHistoricalReviewDate",
                                v,
                              )
                            }
                            placeholder="Select date"
                          />
                          {showValidation &&
                            !section.legacyHistoricalReviewDate && (
                              <p className="text-xs text-red-600 mt-1">
                                Historical Review Date is required.
                              </p>
                            )}
                          {sectionDateErrors.review && (
                            <p className="text-xs text-red-600 mt-1">
                              {sectionDateErrors.review}
                            </p>
                          )}
                        </Field>
                        <Field label="Historical Approver" required>
                          <Select
                            value={section.legacyHistoricalApproverId}
                            onChange={(v) =>
                              updateSection(
                                section.key,
                                "legacyHistoricalApproverId",
                                String(v),
                              )
                            }
                            options={userOptions}
                            isLoading={loadingUsers}
                            onSearch={searchUsers}
                            placeholder="Select approver..."
                          />
                          {showValidation &&
                            !section.legacyHistoricalApproverId && (
                              <p className="text-xs text-red-600 mt-1">
                                Historical Approver is required.
                              </p>
                            )}
                        </Field>
                        <Field label="Historical Approval Date" required>
                          <DateTimePicker
                            value={section.legacyHistoricalApprovalDate}
                            onChange={(v) =>
                              updateSection(
                                section.key,
                                "legacyHistoricalApprovalDate",
                                v,
                              )
                            }
                            placeholder="Select date"
                          />
                          {showValidation &&
                            !section.legacyHistoricalApprovalDate && (
                              <p className="text-xs text-red-600 mt-1">
                                Historical Approval Date is required.
                              </p>
                            )}
                          {sectionDateErrors.approval && (
                            <p className="text-xs text-red-600 mt-1">
                              {sectionDateErrors.approval}
                            </p>
                          )}
                        </Field>
                        {index === 0 && sections.length > 1 && (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
                            <p className="text-xs text-slate-600">
                              Applies this Author / Historical Reviewer(s) / Historical Approver to the other {sections.length - 1} revision(s) below. Every revision stays individually editable afterward.
                            </p>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="whitespace-nowrap shrink-0"
                              onClick={applyFirstSectionRolesToRest}
                              disabled={
                                !section.authorId ||
                                section.legacyHistoricalReviewerIds.length === 0 ||
                                !section.legacyHistoricalApproverId
                              }
                            >
                              Apply to all revisions
                            </Button>
                          </div>
                        )}
                        {trainingConfig.isRequired && (
                          <Field
                            label="Historical Training Completion Date"
                            required
                            hint="When employees completed training for this revision. Must be on or before this revision's Effective Date. Feeds the same Training tracking field a normal revision uses."
                          >
                            <DateTimePicker
                              value={section.trainingCompletionDate}
                              onChange={(v) =>
                                updateSection(
                                  section.key,
                                  "trainingCompletionDate",
                                  v,
                                )
                              }
                              placeholder="Select date"
                            />
                            {showValidation &&
                              !section.trainingCompletionDate && (
                                <p className="text-xs text-red-600 mt-1">
                                  Historical Training Completion Date is
                                  required.
                                </p>
                              )}
                            {sectionDateErrors.training && (
                              <p className="text-xs text-red-600 mt-1">
                                {sectionDateErrors.training}
                              </p>
                            )}
                          </Field>
                        )}
                        <div className="md:col-span-2">
                          <Field
                            label="Change Description"
                            hint="What changed in this revision, if known."
                          >
                            <textarea
                              rows={2}
                              className={FIELD_TEXTAREA}
                              value={section.changeDescription}
                              onChange={(e) =>
                                updateSection(
                                  section.key,
                                  "changeDescription",
                                  e.target.value,
                                )
                              }
                            />
                          </Field>
                        </div>
                        <div className="md:col-span-2">
                          <Field
                            label="Source File"
                            required={isLast || form.isTemplate}
                            hint={
                              section.fileError
                                ? undefined
                                : form.isTemplate
                                  ? `The DOCX (Word) file for this template revision. PDF is not accepted. Maximum file size: ${maxFileSizeMB} MB. Required for every revision.`
                                  : `The DOCX/PDF for this revision. Maximum file size: ${maxFileSizeMB} MB.${isLast ? " Required — this revision becomes Effective." : ""}`
                            }
                          >
                            <SectionFileField
                              file={section.file}
                              onChange={(file) => {
                                updateSection(section.key, "fileError", "");
                                updateSection(section.key, "file", file);
                              }}
                              onOversize={(message) => {
                                updateSection(section.key, "file", null);
                                updateSection(
                                  section.key,
                                  "fileError",
                                  message,
                                );
                              }}
                              maxFileSizeMB={maxFileSizeMB}
                              docxOnly={form.isTemplate}
                            />
                            {section.fileError && (
                              <p className="text-xs text-red-600 mt-1">
                                {section.fileError}
                              </p>
                            )}
                            {showValidation &&
                              !section.fileError &&
                              !section.file &&
                              (isLast || form.isTemplate) && (
                                <p className="text-xs text-red-600 mt-1">
                                  {form.isTemplate
                                    ? "A DOCX file is required for every revision of a template."
                                    : "Source file is required for the most recent revision."}
                                </p>
                              )}
                          </Field>
                          {!section.file && !isLast && !form.isTemplate && (
                            <div className="mt-2">
                              <Field
                                label="No File Justification"
                                required
                                hint="Required when no source file is attached (e.g. the original scan could not be located)."
                              >
                                <input
                                  className={FIELD_INPUT}
                                  value={section.noFileJustification}
                                  onChange={(e) =>
                                    updateSection(
                                      section.key,
                                      "noFileJustification",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Original scan not located in the paper archive"
                                />
                                {showValidation &&
                                  !section.noFileJustification.trim() && (
                                    <p className="text-xs text-red-600 mt-1">
                                      No File Justification is required.
                                    </p>
                                  )}
                              </Field>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {sections.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">
            No revision sections yet — enter a Revision Number above and click
            "Generate Sections".
          </p>
        )}

        {sections.length > CONFIRM_THRESHOLD && (
          <label className="mt-4 flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={bulkConfirmed}
              onChange={(e) => setBulkConfirmed(e.target.checked)}
            />
            <span>
              I confirm I want to create {sections.length} revisions for this
              document.
            </span>
          </label>
        )}
      </div>
      )}
        </div>
      </div>

      <ESignatureModal
        isOpen={showSignature}
        onClose={() => setShowSignature(false)}
        onConfirm={async (data: { signatureToken: string }) => {
          setShowSignature(false);
          await runImport(data.signatureToken);
        }}
        deferConfirm
        actionTitle="Confirm Legacy Import"
        meaningCode="LEGACY_DOCUMENT_IMPORT"
        meaningDisplayName="Legacy Document Import"
        targetDetails={{
          code: documentNumber,
          title: form.documentName,
          revision: sections[sections.length - 1]?.revisionNumber,
        }}
        changes={[
          {
            action: "Import and publish",
            oldValue: "Not in system",
            newValue: `Effective${sections.length > 1 ? ` (${sections.length} revision(s))` : ""}`,
            category: "status",
          },
        ]}
      />
    </div>
  );
};
